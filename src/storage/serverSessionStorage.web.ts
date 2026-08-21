import type { ServerInfo, ServerOwner } from '@/lib/serverApi';

const SERVER_SESSION_KEY = 'liftflow.server-session.v1';

export type StoredServerSession = {
  version: 1;
  serverUrl: string;
  serverInfo: ServerInfo;
  owner: ServerOwner;
  accessToken: string;
  accessExpiresAt: string;
  refreshToken: string;
  refreshExpiresAt: string;
};

export async function loadServerSession(): Promise<StoredServerSession | null> {
  const raw = globalThis.localStorage?.getItem(SERVER_SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredServerSession;
    return parsed.version === 1 ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveServerSession(session: StoredServerSession) {
  globalThis.localStorage?.setItem(SERVER_SESSION_KEY, JSON.stringify(session));
}

export async function clearServerSession() {
  globalThis.localStorage?.removeItem(SERVER_SESSION_KEY);
}
