import Constants from 'expo-constants';
import { Platform } from 'react-native';
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  discoverServer,
  getCurrentOwner,
  loginOwner,
  logoutOwner,
  refreshOwnerSession,
  ServerApiError,
  type ServerDiscovery,
  type SessionTokens,
  setupOwner,
} from '@/lib/serverApi';
import {
  clearServerSession,
  loadServerSession,
  saveServerSession,
  type StoredServerSession,
} from '@/storage/serverSessionStorage';

export type ServerConnectionStatus = 'loading' | 'connected' | 'checking' | 'offline' | 'disconnected';

type SetupInput = {
  serverName: string;
  displayName: string;
  username: string;
  password: string;
};

type LoginInput = {
  username: string;
  password: string;
};

type ServerConnectionContextValue = {
  ready: boolean;
  session: StoredServerSession | null;
  connectionStatus: ServerConnectionStatus;
  lastConnectionError: string | null;
  deviceName: string;
  discover: (serverUrl: string) => Promise<ServerDiscovery>;
  setup: (discovery: ServerDiscovery, input: SetupInput) => Promise<void>;
  login: (discovery: ServerDiscovery, input: LoginInput) => Promise<void>;
  checkConnection: () => Promise<void>;
  signOut: () => Promise<void>;
};

const ServerConnectionContext = createContext<ServerConnectionContextValue | null>(null);

export function ServerConnectionProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<StoredServerSession | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ServerConnectionStatus>('loading');
  const [lastConnectionError, setLastConnectionError] = useState<string | null>(null);
  const deviceName = useMemo(() => buildDeviceName(), []);

  const commitSession = useCallback(async (
    discovery: ServerDiscovery,
    tokens: SessionTokens,
  ) => {
    const next: StoredServerSession = {
      version: 1,
      serverUrl: discovery.serverUrl,
      serverInfo: { ...discovery.info, name: discovery.auth.serverName },
      owner: tokens.owner,
      accessToken: tokens.accessToken,
      accessExpiresAt: tokens.accessExpiresAt,
      refreshToken: tokens.refreshToken,
      refreshExpiresAt: tokens.refreshExpiresAt,
    };
    await saveServerSession(next);
    setSession(next);
    setConnectionStatus('connected');
    setLastConnectionError(null);
  }, []);

  const validateStoredSession = useCallback(async (stored: StoredServerSession) => {
    setConnectionStatus('checking');
    try {
      const discovery = await discoverServer(stored.serverUrl);
      if (discovery.info.serverId !== stored.serverInfo.serverId) {
        await clearServerSession();
        setSession(null);
        setConnectionStatus('disconnected');
        setLastConnectionError('The server at this address has a different identity. Sign in again to continue.');
        return;
      }
      try {
        const owner = await getCurrentOwner(stored.serverUrl, stored.accessToken);
        const refreshed: StoredServerSession = {
          ...stored,
          serverInfo: { ...discovery.info, name: discovery.auth.serverName },
          owner,
        };
        await saveServerSession(refreshed);
        setSession(refreshed);
        setConnectionStatus('connected');
        setLastConnectionError(null);
      } catch (error) {
        if (!(error instanceof ServerApiError) || error.status !== 401) throw error;
        const tokens = await refreshOwnerSession(stored.serverUrl, stored.refreshToken, deviceName);
        await commitSession(discovery, tokens);
      }
    } catch (error) {
      if (error instanceof ServerApiError && error.status === 401) {
        await clearServerSession();
        setSession(null);
        setConnectionStatus('disconnected');
        setLastConnectionError('Your saved LiftFlow login expired. Sign in again.');
        return;
      }
      setSession(stored);
      setConnectionStatus('offline');
      setLastConnectionError(errorMessage(error));
    }
  }, [commitSession, deviceName]);

  useEffect(() => {
    let active = true;
    void loadServerSession()
      .then(async (stored) => {
        if (!active) return;
        if (!stored) {
          setConnectionStatus('disconnected');
          return;
        }
        setSession(stored);
        await validateStoredSession(stored);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setConnectionStatus('disconnected');
        setLastConnectionError(errorMessage(error));
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [validateStoredSession]);

  const discover = useCallback(async (serverUrl: string) => {
    setLastConnectionError(null);
    return discoverServer(serverUrl);
  }, []);

  const setup = useCallback(async (discovery: ServerDiscovery, input: SetupInput) => {
    const tokens = await setupOwner(discovery, { ...input, deviceName });
    const updatedDiscovery: ServerDiscovery = {
      ...discovery,
      info: { ...discovery.info, name: input.serverName.trim() },
      auth: { ...discovery.auth, serverName: input.serverName.trim(), setupRequired: false },
    };
    await commitSession(updatedDiscovery, tokens);
  }, [commitSession, deviceName]);

  const login = useCallback(async (discovery: ServerDiscovery, input: LoginInput) => {
    const tokens = await loginOwner(discovery, { ...input, deviceName });
    await commitSession(discovery, tokens);
  }, [commitSession, deviceName]);

  const checkConnection = useCallback(async () => {
    if (!session) return;
    await validateStoredSession(session);
  }, [session, validateStoredSession]);

  const signOut = useCallback(async () => {
    const current = session;
    if (current) {
      try {
        await logoutOwner(current.serverUrl, current.accessToken);
      } catch {
        // Local sign-out must still succeed when the private server is offline.
      }
    }
    await clearServerSession();
    setSession(null);
    setConnectionStatus('disconnected');
    setLastConnectionError(null);
  }, [session]);

  const value = useMemo<ServerConnectionContextValue>(() => ({
    ready,
    session,
    connectionStatus,
    lastConnectionError,
    deviceName,
    discover,
    setup,
    login,
    checkConnection,
    signOut,
  }), [
    ready,
    session,
    connectionStatus,
    lastConnectionError,
    deviceName,
    discover,
    setup,
    login,
    checkConnection,
    signOut,
  ]);

  return <ServerConnectionContext.Provider value={value}>{children}</ServerConnectionContext.Provider>;
}

export function useServerConnection() {
  const value = useContext(ServerConnectionContext);
  if (!value) throw new Error('useServerConnection must be used inside ServerConnectionProvider.');
  return value;
}

function buildDeviceName() {
  const appVersion = Constants.expoConfig?.version ?? '0.7.0';
  if (Platform.OS === 'web') return `LiftFlow Web ${appVersion}`;
  if (Platform.OS === 'ios') return `LiftFlow iPhone ${appVersion}`;
  if (Platform.OS === 'android') return `LiftFlow Android ${appVersion}`;
  return `LiftFlow ${Platform.OS} ${appVersion}`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'LiftFlow could not reach the selected server.';
}
