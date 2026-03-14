import { env } from "@flaris/env/web";
import { admin } from "better-auth/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: env.NEXT_PUBLIC_SERVER_URL,
  plugins: [admin()],
});
