import {
  projectionIdentity,
  type NormalizedProjection,
} from '@/storage/normalizedState';
import { STORAGE_VERSION } from '@/storage/liftflowStorageCore';

export const LIFTFLOW_API_VERSION = 'v1';
export const LIFTFLOW_CLIENT_VERSION = '0.7.0';

export type ServerInfo = {
  serverId: string;
  name: string;
  serverVersion: string;
  apiVersion: string;
  minimumClientVersion: string;
  storageVersion: number;
  environment: 'development' | 'test' | 'production';
  capabilities: {
    authentication: boolean;
    backupImport: boolean;
    sync: boolean;
    webApp: boolean;
  };
};

export type AuthStatus = {
  serverId: string;
  serverName: string;
  setupRequired: boolean;
  authenticationAvailable: true;
};

export type ServerOwner = {
  id: string;
  username: string;
  displayName: string;
  createdAt: string;
};

export type SessionTokens = {
  tokenType: 'Bearer';
  accessToken: string;
  accessExpiresAt: string;
  refreshToken: string;
  refreshExpiresAt: string;
  owner: ServerOwner;
};

export type ServerDiscovery = {
  serverUrl: string;
  info: ServerInfo;
  auth: AuthStatus;
};

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT';
  body?: unknown;
  accessToken?: string;
  timeoutMs?: number;
};

export type ServerSnapshotCounts = {
  preferences: number;
  exercises: number;
  folders: number;
  templates: number;
  sessions: number;
  workoutExercises: number;
  workoutSets: number;
};

export type ServerDataSummary = {
  initialized: boolean;
  revision: number;
  storageVersion: number | null;
  projectionHash: string | null;
  updatedAt: string | null;
  rowCount: number;
  counts: ServerSnapshotCounts;
};

export type ServerSnapshotWriteResult = {
  ownerId: string;
  revision: number;
  storageVersion: number;
  projectionHash: string;
  updatedAt: string;
  rowCount: number;
  counts: ServerSnapshotCounts;
};

export type ServerSnapshot = ServerSnapshotWriteResult & {
  tables: NormalizedProjection;
};

export class ServerApiError extends Error {
  readonly status: number | null;
  readonly code: string;

  constructor(message: string, status: number | null, code: string) {
    super(message);
    this.name = 'ServerApiError';
    this.status = status;
    this.code = code;
  }
}

export function normalizeServerUrl(input: string) {
  let candidate = input.trim();
  if (!candidate) throw new ServerApiError('Enter your LiftFlow server address.', null, 'invalid_server_url');
  if (!/^[a-z][a-z\d+.-]*:\/\//i.test(candidate)) candidate = `http://${candidate}`;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new ServerApiError('Enter a valid server address such as http://192.168.1.50:8080.', null, 'invalid_server_url');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new ServerApiError('LiftFlow server addresses must use HTTP or HTTPS.', null, 'invalid_server_url');
  }
  if (parsed.username || parsed.password) {
    throw new ServerApiError('Do not include a username or password in the server address.', null, 'invalid_server_url');
  }
  parsed.search = '';
  parsed.hash = '';
  parsed.pathname = parsed.pathname.replace(/\/api\/v1\/?$/i, '').replace(/\/+$/, '');
  return parsed.toString().replace(/\/$/, '');
}

export function isClientVersionCompatible(clientVersion: string, minimumVersion: string) {
  const client = parseVersion(clientVersion);
  const minimum = parseVersion(minimumVersion);
  for (let index = 0; index < 3; index += 1) {
    if (client[index] > minimum[index]) return true;
    if (client[index] < minimum[index]) return false;
  }
  return true;
}

export async function discoverServer(input: string): Promise<ServerDiscovery> {
  const serverUrl = normalizeServerUrl(input);
  const info = await requestJson<ServerInfo>(serverUrl, '/api/v1/server-info');
  if (info.apiVersion !== LIFTFLOW_API_VERSION) {
    throw new ServerApiError(
      `This server uses API ${info.apiVersion}; LiftFlow ${LIFTFLOW_CLIENT_VERSION} requires ${LIFTFLOW_API_VERSION}.`,
      null,
      'unsupported_api_version',
    );
  }
  if (!isClientVersionCompatible(LIFTFLOW_CLIENT_VERSION, info.minimumClientVersion)) {
    throw new ServerApiError(
      `Update LiftFlow before connecting. This server requires app version ${info.minimumClientVersion} or newer.`,
      null,
      'client_update_required',
    );
  }
  if (!info.capabilities.authentication) {
    throw new ServerApiError('This server has not been upgraded to LF-035 authentication.', null, 'authentication_unavailable');
  }
  const auth = await requestJson<AuthStatus>(serverUrl, '/api/v1/auth/status');
  if (auth.serverId !== info.serverId) {
    throw new ServerApiError('The server identity changed during connection. Try again.', null, 'server_identity_mismatch');
  }
  return { serverUrl, info, auth };
}

export function setupOwner(discovery: ServerDiscovery, input: {
  serverName: string;
  displayName: string;
  username: string;
  password: string;
  deviceName: string;
}) {
  return requestJson<SessionTokens>(discovery.serverUrl, '/api/v1/auth/setup', {
    method: 'POST',
    body: input,
  });
}

export function loginOwner(discovery: ServerDiscovery, input: {
  username: string;
  password: string;
  deviceName: string;
}) {
  return requestJson<SessionTokens>(discovery.serverUrl, '/api/v1/auth/login', {
    method: 'POST',
    body: input,
  });
}

export function refreshOwnerSession(serverUrl: string, refreshToken: string, deviceName: string) {
  return requestJson<SessionTokens>(serverUrl, '/api/v1/auth/refresh', {
    method: 'POST',
    body: { refreshToken, deviceName },
  });
}

export function getCurrentOwner(serverUrl: string, accessToken: string) {
  return requestJson<ServerOwner>(serverUrl, '/api/v1/auth/me', { accessToken });
}

export function logoutOwner(serverUrl: string, accessToken: string) {
  return requestJson<{ signedOut: true }>(serverUrl, '/api/v1/auth/logout', {
    method: 'POST',
    accessToken,
  });
}

export function getServerDataSummary(serverUrl: string, accessToken: string) {
  return requestJson<ServerDataSummary>(serverUrl, '/api/v1/data/summary', { accessToken });
}

export function getServerSnapshot(serverUrl: string, accessToken: string) {
  return requestJson<ServerSnapshot>(serverUrl, '/api/v1/data/snapshot', { accessToken });
}

export function replaceServerSnapshot(
  serverUrl: string,
  accessToken: string,
  projection: NormalizedProjection,
  baseRevision?: number,
) {
  return requestJson<ServerSnapshotWriteResult>(serverUrl, '/api/v1/data/snapshot', {
    method: 'PUT',
    accessToken,
    body: {
      storageVersion: STORAGE_VERSION,
      projectionHash: projectionIdentity(projection),
      ...(baseRevision === undefined ? {} : { baseRevision }),
      tables: projection,
    },
    timeoutMs: 30_000,
  });
}

async function requestJson<T>(serverUrl: string, path: string, options: RequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 8000);
  try {
    const response = await fetch(`${serverUrl}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
    const payload = await readJson(response);
    if (!response.ok) {
      const detail = isRecord(payload) && isRecord(payload.detail) ? payload.detail : null;
      const message = detail && typeof detail.message === 'string'
        ? detail.message
        : `LiftFlow server returned HTTP ${response.status}.`;
      const code = detail && typeof detail.code === 'string' ? detail.code : 'server_request_failed';
      throw new ServerApiError(message, response.status, code);
    }
    return payload as T;
  } catch (error) {
    if (error instanceof ServerApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ServerApiError('The LiftFlow server did not respond in time.', null, 'server_timeout');
    }
    throw new ServerApiError(
      'LiftFlow could not reach that server. Check the address, Docker, and network connection.',
      null,
      'server_unreachable',
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {};
  }
}

function parseVersion(version: string): [number, number, number] {
  const match = version.trim().match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return [0, 0, 0];
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
