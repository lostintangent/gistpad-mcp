/**
 * A typed fetch client for the GitHub Gists API.
 * Replaces axios with native fetch (Node.js 22+).
 */

export interface FetchClientConfig {
  baseURL: string;
  headers: Record<string, string>;
}

export interface FetchClient {
  get<T>(path: string, options?: { params?: Record<string, string | number> }): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  patch<T>(path: string, body?: unknown): Promise<T>;
  put(path: string): Promise<void>;
  delete(path: string): Promise<void>;
}

/**
 * Creates a typed fetch client with a base URL and default headers.
 * Provides axios-like API using native fetch.
 */
export function createFetchClient(config: FetchClientConfig): FetchClient {
  const { baseURL, headers } = config;

  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
    params?: Record<string, string | number>,
  ): Promise<T> {
    let url = `${baseURL}${path}`;

    if (params) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        searchParams.set(key, String(value));
      }
      url += `?${searchParams.toString()}`;
    }

    const response = await fetch(url, {
      method,
      headers: {
        ...headers,
        ...(body !== undefined && { "Content-Type": "application/json" }),
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    // For DELETE and PUT requests that return no content
    if (response.status === 204 || response.headers.get("content-length") === "0") {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  return {
    get<T>(path: string, options?: { params?: Record<string, string | number> }): Promise<T> {
      return request<T>("GET", path, undefined, options?.params);
    },

    post<T>(path: string, body?: unknown): Promise<T> {
      return request<T>("POST", path, body);
    },

    patch<T>(path: string, body?: unknown): Promise<T> {
      return request<T>("PATCH", path, body);
    },

    async put(path: string): Promise<void> {
      await request<void>("PUT", path);
    },

    async delete(path: string): Promise<void> {
      await request<void>("DELETE", path);
    },
  };
}
