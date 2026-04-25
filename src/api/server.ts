export type RemoteLeaderboardEntry = {
  score: number;
  playedAt: string;
  playerName: string;
  avatarUrl: string | null;
};

export async function fetchRemoteLeaderboard(
  dock: string,
): Promise<RemoteLeaderboardEntry[] | null> {
  try {
    const res = await fetch(
      `/api/leaderboard?${new URLSearchParams({ dock })}`,
      { credentials: "same-origin" },
    );
    if (!res.ok) {
      return null;
    }
    const data = (await res.json()) as {
      entries?: RemoteLeaderboardEntry[];
    };
    if (!data.entries || !Array.isArray(data.entries)) {
      return null;
    }
    return data.entries;
  } catch {
    return null;
  }
}

export type MeUser = {
  displayName: string;
  avatarUrl: string | null;
};

export async function fetchMe(): Promise<MeUser | null> {
  try {
    const res = await fetch("/api/me", { credentials: "same-origin" });
    if (!res.ok) {
      return null;
    }
    const data = (await res.json()) as {
      user: MeUser | null;
    };
    if (!data.user?.displayName) {
      return null;
    }
    return data.user;
  } catch {
    return null;
  }
}

export async function submitRemoteScore(
  dock: string,
  score: number,
  playedAt: string,
): Promise<boolean> {
  try {
    const res = await fetch("/api/scores", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dock, score, playedAt }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function logout(): Promise<void> {
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
    });
  } catch {
    // Best-effort sign-out.
  }
}
