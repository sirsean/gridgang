import {
  discordDisplayName,
  exchangeDiscordCode,
  fetchDiscordCurrentUser,
} from "./discord";
import {
  buildOAuthStateCookie,
  buildSessionCookie,
  clearOAuthStateCookie,
  clearSessionCookie,
  randomOAuthState,
  readDiscordUserIdFromRequest,
  readOAuthStateFromRequest,
} from "./session";
import type { WorkerEnv } from "./types";

function jsonResponse(
  data: unknown,
  status = 200,
  extra?: HeadersInit,
): Response {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
  });
  if (extra) {
    new Headers(extra).forEach((value, key) => {
      headers.append(key, value);
    });
  }
  return new Response(JSON.stringify(data), { status, headers });
}

function redirectResponse(location: string, headers?: Headers): Response {
  const h = headers ?? new Headers();
  h.set("Location", location);
  return new Response(null, { status: 302, headers: h });
}

function requireEnv(env: WorkerEnv): Response | null {
  if (
    !env.DISCORD_CLIENT_ID ||
    !env.DISCORD_CLIENT_SECRET ||
    !env.SESSION_SECRET
  ) {
    return jsonResponse(
      {
        error:
          "Server is missing DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, or SESSION_SECRET.",
      },
      500,
    );
  }
  return null;
}

export async function handleApi(
  request: Request,
  env: WorkerEnv,
): Promise<Response> {
  const envErr = requireEnv(env);
  if (envErr) {
    return envErr;
  }

  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/api/auth/discord" && request.method === "GET") {
    return handleDiscordStart(request, env);
  }

  if (path === "/api/auth/callback" && request.method === "GET") {
    return handleDiscordCallback(request, env);
  }

  if (path === "/api/auth/logout" && request.method === "POST") {
    const headers = new Headers();
    headers.append("Set-Cookie", clearSessionCookie(request));
    return jsonResponse({ ok: true }, 200, headers);
  }

  if (path === "/api/me" && request.method === "GET") {
    return handleMe(request, env);
  }

  if (path === "/api/leaderboard" && request.method === "GET") {
    return handleLeaderboard(request, env);
  }

  if (path === "/api/scores" && request.method === "POST") {
    return handlePostScore(request, env);
  }

  return jsonResponse({ error: "Not found" }, 404);
}

function handleDiscordStart(request: Request, env: WorkerEnv): Response {
  const state = randomOAuthState();
  const authorize = new URL("https://discord.com/oauth2/authorize");
  authorize.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
  authorize.searchParams.set("redirect_uri", callbackUrl(request));
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("scope", "identify");
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("prompt", "consent");

  const headers = new Headers();
  headers.append("Set-Cookie", buildOAuthStateCookie(request, state));
  return redirectResponse(authorize.toString(), headers);
}

async function handleDiscordCallback(
  request: Request,
  env: WorkerEnv,
): Promise<Response> {
  const url = new URL(request.url);
  const err = url.searchParams.get("error");
  if (err) {
    const desc = url.searchParams.get("error_description") ?? err;
    const headers = new Headers();
    headers.append("Set-Cookie", clearOAuthStateCookie(request));
    return redirectResponse(
      `/?auth_error=${encodeURIComponent(desc)}`,
      headers,
    );
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const stored = readOAuthStateFromRequest(request);

  const headers = new Headers();
  headers.append("Set-Cookie", clearOAuthStateCookie(request));

  if (!code || !state || !stored || stored !== state) {
    return redirectResponse("/?auth_error=invalid_state", headers);
  }

  try {
    const redirectUri = callbackUrl(request);
    const tokens = await exchangeDiscordCode(
      code,
      redirectUri,
      env.DISCORD_CLIENT_ID,
      env.DISCORD_CLIENT_SECRET,
    );
    const user = await fetchDiscordCurrentUser(tokens.access_token);
    const displayName = discordDisplayName(user);
    const now = new Date().toISOString();

    await env.DB.prepare(
      `INSERT INTO players (discord_user_id, display_name, avatar_hash, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(discord_user_id) DO UPDATE SET
         display_name = excluded.display_name,
         avatar_hash = excluded.avatar_hash,
         updated_at = excluded.updated_at`,
    )
      .bind(user.id, displayName, user.avatar, now)
      .run();

    headers.append(
      "Set-Cookie",
      await buildSessionCookie(request, env, user.id),
    );
    return redirectResponse("/", headers);
  } catch {
    return redirectResponse("/?auth_error=oauth_failed", headers);
  }
}

function callbackUrl(request: Request): string {
  const url = new URL(request.url);
  return `${url.origin}/api/auth/callback`;
}

async function handleMe(
  request: Request,
  env: WorkerEnv,
): Promise<Response> {
  const uid = await readDiscordUserIdFromRequest(request, env);
  if (!uid) {
    return jsonResponse({ user: null });
  }

  const row = await env.DB.prepare(
    "SELECT discord_user_id, display_name, avatar_hash FROM players WHERE discord_user_id = ?",
  )
    .bind(uid)
    .first<{
      discord_user_id: string;
      display_name: string;
      avatar_hash: string | null;
    }>();

  if (!row) {
    return jsonResponse({ user: null });
  }

  return jsonResponse({
    user: {
      displayName: row.display_name,
      avatarUrl: buildDiscordAvatarUrl(row.discord_user_id, row.avatar_hash),
    },
  });
}

async function handleLeaderboard(
  request: Request,
  env: WorkerEnv,
): Promise<Response> {
  const url = new URL(request.url);
  const dock = url.searchParams.get("dock") ?? "";
  if (!isValidDock(dock)) {
    return jsonResponse({ error: "Invalid dock" }, 400);
  }

  const res = await env.DB.prepare(
    `SELECT s.score, s.played_at, p.discord_user_id, p.display_name AS player_name, p.avatar_hash
     FROM scores s
     INNER JOIN players p ON p.discord_user_id = s.discord_user_id
     WHERE s.dock = ?
     ORDER BY s.score DESC, s.played_at ASC
     LIMIT 10`,
  )
    .bind(dock)
    .all<{
      score: number;
      played_at: string;
      discord_user_id: string;
      player_name: string;
      avatar_hash: string | null;
    }>();

  const entries = (res.results ?? []).map((r) => ({
    score: r.score,
    playedAt: r.played_at,
    playerName: r.player_name,
    avatarUrl: buildDiscordAvatarUrl(r.discord_user_id, r.avatar_hash),
  }));

  return jsonResponse({ dock, entries });
}

async function handlePostScore(
  request: Request,
  env: WorkerEnv,
): Promise<Response> {
  const uid = await readDiscordUserIdFromRequest(request, env);
  if (!uid) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  if (!body || typeof body !== "object") {
    return jsonResponse({ error: "Invalid body" }, 400);
  }

  const rec = body as Record<string, unknown>;
  const dock = rec.dock;
  const score = rec.score;
  const playedAtRaw = rec.playedAt;

  if (typeof dock !== "string" || !isValidDock(dock)) {
    return jsonResponse({ error: "Invalid dock" }, 400);
  }

  if (typeof score !== "number" || !Number.isFinite(score)) {
    return jsonResponse({ error: "Invalid score" }, 400);
  }

  const rounded = Math.round(score);
  if (rounded < -99_999_999 || rounded > 99_999_999) {
    return jsonResponse({ error: "Score out of range" }, 400);
  }

  let playedAt: string;
  if (playedAtRaw === undefined) {
    playedAt = new Date().toISOString();
  } else if (typeof playedAtRaw === "string" && Number.isFinite(Date.parse(playedAtRaw))) {
    playedAt = new Date(playedAtRaw).toISOString();
  } else {
    return jsonResponse({ error: "Invalid playedAt" }, 400);
  }

  await env.DB.prepare(
    `INSERT INTO scores (dock, discord_user_id, score, played_at)
     VALUES (?, ?, ?, ?)`,
  )
    .bind(dock, uid, rounded, playedAt)
    .run();

  return jsonResponse({ ok: true });
}

function isValidDock(dock: string): boolean {
  return /^[a-zA-Z0-9_-]{1,32}$/.test(dock);
}

function buildDiscordAvatarUrl(
  discordUserId: string,
  avatarHash: string | null,
): string | null {
  if (!avatarHash) {
    return null;
  }
  const ext = avatarHash.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${discordUserId}/${avatarHash}.${ext}?size=64`;
}
