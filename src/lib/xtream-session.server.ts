/**
 * Encrypted-cookie session helpers for Xtream account overrides.
 *
 * Session shape:
 *   { override?: { username, password } }
 *
 * When `override` is present, all Xtream calls use those credentials.
 * Otherwise the shared default credentials from env are used.
 */
import { useSession } from "@tanstack/react-start/server";
import { getDefaultCreds, type XtreamCreds } from "./xtream.server";

interface XtreamSessionData {
  override?: { username: string; password: string; serverUrl?: string };
}

function config() {
  const password = process.env.SESSION_SECRET;
  if (!password) throw new Error("SESSION_SECRET is not set");
  return {
    password,
    name: "liontv-session",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "lax" as const,
      path: "/",
    },
  };
}

export async function getSession() {
  return useSession<XtreamSessionData>(config());
}

/** Resolve effective creds: user override if present, else shared default. */
export async function resolveCreds(): Promise<{
  creds: XtreamCreds;
  isOverride: boolean;
}> {
  const session = await getSession();
  const override = session.data.override;
  if (override) {
    return {
      isOverride: true,
      creds: {
        serverUrl:
          override.serverUrl?.replace(/\/+$/, "") ||
          process.env.XTREAM_SERVER_URL?.replace(/\/+$/, "") ||
          "",
        username: override.username,
        password: override.password,
      },
    };
  }
  return { isOverride: false, creds: getDefaultCreds() };
}

export async function setOverride(username: string, password: string, serverUrl?: string) {
  const session = await getSession();
  await session.update({ override: { username, password, serverUrl } });
}

export async function clearOverride() {
  const session = await getSession();
  await session.update({ override: undefined });
}
