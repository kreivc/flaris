import alchemy from "alchemy";
import { KVNamespace, Queue, Worker } from "alchemy/cloudflare";
import { D1Database } from "alchemy/cloudflare";
import { config } from "dotenv";

config({ path: "./.env" });
config({ path: "../../apps/server/.env" });

const isDeploy = process.env.DEPLOY === "true";

const stageArgIndex = process.argv.indexOf("--stage");
const stageArg =
  stageArgIndex !== -1 && process.argv[stageArgIndex + 1] ? process.argv[stageArgIndex + 1] : null;

const envSuffix = isDeploy ? ".prod" : "";

const stage = stageArg ?? "dev";

if (stageArg) {
  config({ path: `./.env.${stage}` });
  config({ path: `../../apps/web/.env.${stage}` });
  config({ path: `../../apps/server/.env.${stage}` });
} else {
  config({ path: `./.env${envSuffix}` });
  config({ path: `../../apps/web/.env${envSuffix}` });
  config({ path: `../../apps/server/.env${envSuffix}` });
}

const app = await alchemy("flaris");

const db = await D1Database("database", {
  name: `${app.name}-${stage}-database`,
  migrationsDir: "../../packages/db/src/migrations",
  adopt: true,
});

const kv = await KVNamespace("kv", {
  title: `${app.name}-${stage}-kv`,
  adopt: true,
});

export const queue = await Queue("queue", {
  name: `${app.name}-${stage}-queue`,
  adopt: true,
});

export const server = await Worker("server", {
  name: `${app.name}-${stage}-server`,
  adopt: true,
  cwd: "../../apps/server",
  entrypoint: "src/index.ts",
  compatibility: "node",
  bindings: {
    DB: db,
    KV: kv,
    QUEUE: queue,
    CORS_ORIGIN: alchemy.env.CORS_ORIGIN!,
    NODE_ENV: alchemy.env.NODE_ENV!,
    BETTER_AUTH_SECRET: alchemy.secret.env.BETTER_AUTH_SECRET!,
    BETTER_AUTH_URL: alchemy.env.BETTER_AUTH_URL!,
    GOOGLE_CLIENT_ID: alchemy.secret.env.GOOGLE_CLIENT_ID!,
    GOOGLE_CLIENT_SECRET: alchemy.secret.env.GOOGLE_CLIENT_SECRET!,
  },
  dev: {
    port: 3000,
  },
});

console.log(`Server -> ${server.url}`);

await app.finalize();
