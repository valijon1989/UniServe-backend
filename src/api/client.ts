type Primitive = string | number | boolean | null | undefined;

type QueryValue = Primitive | Primitive[];

export interface ApiRequestConfig {
  params?: Record<string, QueryValue>;
  headers?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
}

export interface ApiResponse<T = unknown> {
  data: T;
  status: number;
  headers: Headers;
}

const port = Number(process.env.PORT || 5001);
const defaultBaseUrl = `http://localhost:${port}`;

const resolveBaseUrl = () => {
  const raw = process.env.API_BASE_URL || process.env.BACKEND_ORIGIN || process.env.SERVER_URL || defaultBaseUrl;
  return raw.replace(/\/+$/, "");
};

const appendQueryParams = (url: URL, params?: Record<string, QueryValue>) => {
  if (!params) return;
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (entry === undefined || entry === null) return;
        url.searchParams.append(key, String(entry));
      });
      return;
    }
    url.searchParams.set(key, String(value));
  });
};

const buildUrl = (path: string, params?: Record<string, QueryValue>) => {
  if (!path) throw new Error("API path is required");

  const hasProtocol = /^https?:\/\//i.test(path);
  const normalizedPath = hasProtocol ? path : `${resolveBaseUrl()}/${path.replace(/^\/+/, "")}`;
  const url = new URL(normalizedPath);
  appendQueryParams(url, params);
  return url.toString();
};

const parseResponseBody = async (res: Response): Promise<unknown> => {
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return res.json();
  }
  const text = await res.text();
  return text ? { message: text } : null;
};

const request = async <T = unknown>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  config: ApiRequestConfig = {}
): Promise<ApiResponse<T>> => {
  const { params, headers = {}, body, signal } = config;
  const url = buildUrl(path, params);
  const requestHeaders: Record<string, string> = { ...headers };

  const init: RequestInit = {
    method,
    headers: requestHeaders,
    signal
  };

  if (body !== undefined && body !== null && method !== "GET") {
    init.body = typeof body === "string" ? body : JSON.stringify(body);
    if (!("Content-Type" in requestHeaders) && !("content-type" in requestHeaders)) {
      requestHeaders["Content-Type"] = "application/json";
    }
  }

  const res = await fetch(url, init);
  const data = (await parseResponseBody(res)) as T;

  if (!res.ok) {
    const error = new Error(
      (typeof data === "object" && data && "message" in data ? String((data as any).message) : "") ||
        `Request failed with status ${res.status}`
    );
    (error as any).status = res.status;
    (error as any).data = data;
    throw error;
  }

  return {
    data,
    status: res.status,
    headers: res.headers
  };
};

export const api = {
  get: <T = unknown>(path: string, config?: ApiRequestConfig) => request<T>("GET", path, config),
  post: <T = unknown>(path: string, body?: unknown, config?: ApiRequestConfig) =>
    request<T>("POST", path, { ...(config || {}), body }),
  put: <T = unknown>(path: string, body?: unknown, config?: ApiRequestConfig) =>
    request<T>("PUT", path, { ...(config || {}), body }),
  patch: <T = unknown>(path: string, body?: unknown, config?: ApiRequestConfig) =>
    request<T>("PATCH", path, { ...(config || {}), body }),
  delete: <T = unknown>(path: string, config?: ApiRequestConfig) => request<T>("DELETE", path, config)
};
