import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

// Load stage from STAGE env variable (e.g., STAGE=smiless)
const stage = process.env.STAGE ?? null;

const envPath = stage ? `../../apps/server/.env.${stage}` : "../../apps/server/.env";

dotenv.config({ path: envPath });

console.log(`Using environment file: ${envPath}`);

const PUSH_CREDENTIALS = {
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? "",
    databaseId: process.env.CLOUDFLARE_DATABASE_ID ?? "",
    token: process.env.CLOUDFLARE_API_TOKEN ?? "",
  },
  tablesFilter: ["/^(?!.*_cf_KV).*$/"], // only on prod push/seed
};

// If run via CLI (i.e., process.argv contains 'drizzle-kit'), populate credentials
const isDrizzleCli = process.argv.some((arg) => arg.includes("drizzle-kit"));
const isStudio = process.argv.some((arg) => arg.includes("studio"));
const isPush = process.argv.some((arg) => arg.includes("push"));
const isMigrate = process.argv.some((arg) => arg.includes("migrate"));
const isLocal = process.env.DRIZZLE_LOCAL === "true";

// Get local SQLite file path for local operations
// Path is relative from packages/db to root .alchemy directory
const getLocalDbPath = () => {
  // Get the directory of this config file
  const configDir = dirname(fileURLToPath(import.meta.url));
  // Go up two levels to project root, then to .alchemy directory
  const dbDir = join(configDir, "../../.alchemy/miniflare/v3/d1/miniflare-D1DatabaseObject");
  try {
    // Ensure directory exists for fresh DBs
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }
    const files = readdirSync(dbDir);
    const sqliteFile = files.find((file) => file.endsWith(".sqlite"));
    if (sqliteFile) {
      return join(dbDir, sqliteFile);
    }
    // No sqlite file yet — return a default path so push/migrate can create it
    return join(dbDir, "local.sqlite");
  } catch {
    // Directory doesn't exist or can't read
  }
  return null;
};

const useLocal = (isStudio || isPush || isMigrate) && isLocal;
const localDbPath = useLocal ? getLocalDbPath() : null;

const LOCAL_CREDENTIALS = localDbPath
  ? {
      dbCredentials: {
        url: localDbPath,
      },
    }
  : {};

// Determine which credentials to use
let credentials = {};
if (useLocal && localDbPath) {
  credentials = LOCAL_CREDENTIALS;
} else if (isDrizzleCli) {
  credentials = PUSH_CREDENTIALS;
}

export default defineConfig({
  schema: "./src/schema",
  // out: "./src/migrations", // disable migration we use push
  // DOCS: https://orm.drizzle.team/docs/guides/d1-http-with-drizzle-kit
  dialect: "sqlite",
  // Only set driver for D1 HTTP, omit for local SQLite files (auto-detected from url)
  ...(useLocal && localDbPath ? {} : { driver: "d1-http" }),
  ...credentials,
});
