import * as SecureStore from 'expo-secure-store';

import type { ServerInfo, ServerOwner } from '@/lib/serverApi';

const SERVER_SESSION_KEY = 'liftflow.server-session.v1';
const secureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

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
  const raw = await SecureStore.getItemAsync(SERVER_SESSION_KEY, secureStoreOptions);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredServerSession;
    return parsed.version === 1 ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveServerSession(session: StoredServerSession) {
  await SecureStore.setItemAsync(SERVER_SESSION_KEY, JSON.stringify(session), secureStoreOptions);
}

export async function clearServerSession() {
  await SecureStore.deleteItemAsync(SERVER_SESSION_KEY, secureStoreOptions);
}
