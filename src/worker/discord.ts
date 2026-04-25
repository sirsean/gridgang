type DiscordTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
};

type DiscordUser = {
  id: string;
  username: string;
  discriminator: string;
  global_name: string | null;
  avatar: string | null;
};

export async function exchangeDiscordCode(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string,
): Promise<DiscordTokenResponse> {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });

  const res = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord token exchange failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<DiscordTokenResponse>;
}

export async function fetchDiscordCurrentUser(
  accessToken: string,
): Promise<DiscordUser> {
  const res = await fetch("https://discord.com/api/v10/users/@me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord /users/@me failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<DiscordUser>;
}

export function discordDisplayName(user: DiscordUser): string {
  const g = user.global_name?.trim();
  if (g) {
    return g;
  }
  const u = user.username?.trim();
  if (u && user.discriminator && user.discriminator !== "0") {
    return `${u}#${user.discriminator}`;
  }
  if (u) {
    return u;
  }
  return user.id;
}
