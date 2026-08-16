import type {
  ApiKey,
  ApiKeyCreated,
  ChatSession,
  Document,
  Member,
  Message,
  TokenPair,
  User,
  Workspace,
  WorkspaceStats,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// Tokens live in localStorage -- this is a real browser app the user
// runs on their own machine (not a Claude artifact sandbox), so
// localStorage is the standard, appropriate choice here.
const ACCESS_TOKEN_KEY = "rag_access_token";
const REFRESH_TOKEN_KEY = "rag_refresh_token";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(tokens: TokenPair) {
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  // Deduplicate concurrent refresh attempts -- if several requests
  // 401 at once, only one refresh call should actually fire.
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;

    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) {
      clearTokens();
      return false;
    }

    const tokens: TokenPair = await res.json();
    setTokens(tokens);
    return true;
  })();

  const result = await refreshPromise;
  refreshPromise = null;
  return result;
}

async function apiFetch(path: string, options: RequestInit = {}, retry = true): Promise<Response> {
  const token = getAccessToken();
  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401 && retry) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return apiFetch(path, options, false);
    }
  }

  return res;
}

async function apiJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, body.detail || "Request failed");
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

function jsonBody(data: unknown): RequestInit {
  return { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) };
}

// --- Auth ---
export const auth = {
  register: (email: string, password: string, full_name?: string) =>
    apiJson<User>("/auth/register", jsonBody({ email, password, full_name })),

  login: async (email: string, password: string) => {
    const tokens = await apiJson<TokenPair>("/auth/login", jsonBody({ email, password }));
    setTokens(tokens);
    return tokens;
  },

  me: () => apiJson<User>("/auth/me"),

  logout: async () => {
    const refreshToken = getRefreshToken();
    clearTokens();
    if (refreshToken) {
      await fetch(`${API_URL}/auth/logout`, {
        ...jsonBody({ refresh_token: refreshToken }),
      }).catch(() => {});
    }
  },
};

// --- Workspaces ---
export const workspaces = {
  list: () => apiJson<Workspace[]>("/workspaces"),
  create: (name: string) => apiJson<Workspace>("/workspaces", jsonBody({ name })),
  get: (id: string) => apiJson<Workspace>(`/workspaces/${id}`),
  members: (id: string) => apiJson<Member[]>(`/workspaces/${id}/members`),
  invite: (id: string, email: string, role: string) =>
    apiJson<Member>(`/workspaces/${id}/members`, jsonBody({ email, role })),
};

// --- Documents ---
export const documents = {
  list: (workspaceId: string) => apiJson<Document[]>(`/workspaces/${workspaceId}/documents`),
  upload: async (workspaceId: string, file: File): Promise<Document> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await apiFetch(`/workspaces/${workspaceId}/documents`, { method: "POST", body: formData });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ detail: res.statusText }));
      throw new ApiError(res.status, body.detail || "Upload failed");
    }
    return res.json();
  },
  delete: (workspaceId: string, documentId: string) =>
    apiJson<void>(`/workspaces/${workspaceId}/documents/${documentId}`, { method: "DELETE" }),
};

// --- Chat ---
export const chat = {
  listSessions: (workspaceId: string) => apiJson<ChatSession[]>(`/workspaces/${workspaceId}/chat/sessions`),
  createSession: (workspaceId: string, title?: string) =>
    apiJson<ChatSession>(`/workspaces/${workspaceId}/chat/sessions`, jsonBody({ title })),
  getMessages: (workspaceId: string, sessionId: string) =>
    apiJson<Message[]>(`/workspaces/${workspaceId}/chat/sessions/${sessionId}/messages`),
  deleteSession: (workspaceId: string, sessionId: string) =>
    apiJson<void>(`/workspaces/${workspaceId}/chat/sessions/${sessionId}`, { method: "DELETE" }),

  // Streaming responses need manual fetch + ReadableStream parsing --
  // the browser's EventSource API can't send custom Authorization
  // headers, which we need for JWT auth.
  sendMessageStream: async (
    workspaceId: string,
    sessionId: string,
    content: string,
    callbacks: {
      onSources?: (sources: Message["sources"]) => void;
      onDelta?: (delta: string) => void;
      onDone?: () => void;
      onError?: (message: string) => void;
    }
  ) => {
    const res = await apiFetch(`/workspaces/${workspaceId}/chat/sessions/${sessionId}/messages`, jsonBody({ content }));

    if (!res.ok || !res.body) {
      const body = await res.json().catch(() => ({ detail: "Failed to send message" }));
      callbacks.onError?.(body.detail || "Failed to send message");
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const event = JSON.parse(line.slice(6));

        if (event.type === "sources") callbacks.onSources?.(event.sources);
        else if (event.type === "content") callbacks.onDelta?.(event.delta);
        else if (event.type === "done") callbacks.onDone?.();
        else if (event.type === "error") callbacks.onError?.(event.message);
      }
    }
  },
};

// --- API Keys ---
export const apiKeys = {
  list: (workspaceId: string) => apiJson<ApiKey[]>(`/workspaces/${workspaceId}/api-keys`),
  create: (workspaceId: string, name: string) =>
    apiJson<ApiKeyCreated>(`/workspaces/${workspaceId}/api-keys`, jsonBody({ name })),
  revoke: (workspaceId: string, keyId: string) =>
    apiJson<void>(`/workspaces/${workspaceId}/api-keys/${keyId}`, { method: "DELETE" }),
};

// --- Admin ---
export const admin = {
  stats: (workspaceId: string) => apiJson<WorkspaceStats>(`/workspaces/${workspaceId}/admin/stats`),
};
