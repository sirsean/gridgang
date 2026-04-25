export type WorkerEnv = {
  ASSETS: Fetcher;
  DB: D1Database;
  DISCORD_CLIENT_ID: string;
  DISCORD_CLIENT_SECRET: string;
  SESSION_SECRET: string;
};
