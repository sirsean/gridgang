import type { WorkerEnv } from "./types";

const SESSION_COOKIE = "gg_session";
const OAUTH_STATE_COOKIE = "gg_oauth_state";
const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30;
const OAUTH_STATE_MAX_AGE_SEC = 600;

function secureCookieFlag(request: Request): string {
  const url = new URL(request.url);
  return url.protocol === "https:" ? "; Secure" : "";
}

function hexHmac(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  return crypto.subtle
    .importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    )
    .then((key) => crypto.subtle.sign("HMAC", key, enc.encode(message)))
    .then((buf) =>
      [...new Uint8Array(buf)]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
    );
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function buildSessionCookie(
  request: Request,
  env: WorkerEnv,
  discordUserId: string,
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SEC;
  const body = `${discordUserId}.${exp}`;
  const sig = await hexHmac(env.SESSION_SECRET, body);
  const value = `${encodeURIComponent(discordUserId)}.${exp}.${sig}`;
  const secure = secureCookieFlag(request);
  return `${SESSION_COOKIE}=${value}; HttpOnly; Path=/; Max-Age=${SESSION_MAX_AGE_SEC}; SameSite=Lax${secure}`;
}

export async function readDiscordUserIdFromRequest(
  request: Request,
  env: WorkerEnv,
): Promise<string | null> {
  const raw = getCookie(request, SESSION_COOKIE);
  if (!raw) {
    return null;
  }
  const parts = raw.split(".");
  if (parts.length !== 3) {
    return null;
  }
  const [uidEnc, expStr, sig] = parts;
  let discordUserId: string;
  try {
    discordUserId = decodeURIComponent(uidEnc);
  } catch {
    return null;
  }
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) {
    return null;
  }
  const body = `${discordUserId}.${exp}`;
  const expected = await hexHmac(env.SESSION_SECRET, body);
  if (!timingSafeEqual(sig, expected)) {
    return null;
  }
  if (!/^\d{5,32}$/.test(discordUserId)) {
    return null;
  }
  return discordUserId;
}

export function clearSessionCookie(request: Request): string {
  const secure = secureCookieFlag(request);
  return `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${secure}`;
}

export function buildOAuthStateCookie(request: Request, state: string): string {
  const secure = secureCookieFlag(request);
  return `${OAUTH_STATE_COOKIE}=${state}; HttpOnly; Path=/api/auth; Max-Age=${OAUTH_STATE_MAX_AGE_SEC}; SameSite=Lax${secure}`;
}

export function clearOAuthStateCookie(request: Request): string {
  const secure = secureCookieFlag(request);
  return `${OAUTH_STATE_COOKIE}=; HttpOnly; Path=/api/auth; Max-Age=0; SameSite=Lax${secure}`;
}

export function readOAuthStateFromRequest(request: Request): string | null {
  return getCookie(request, OAUTH_STATE_COOKIE);
}

function getCookie(request: Request, name: string): string | null {
  const header = request.headers.get("Cookie");
  if (!header) {
    return null;
  }
  const parts = header.split(";").map((c) => c.trim());
  const prefix = `${name}=`;
  for (const part of parts) {
    if (part.startsWith(prefix)) {
      return part.slice(prefix.length);
    }
  }
  return null;
}

export function randomOAuthState(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}
