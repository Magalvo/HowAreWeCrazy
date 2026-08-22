export async function requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const body = await response.json() as T & { error?: string };
  if (!response.ok) {
    throw new Error(body.error || "Room request failed");
  }
  return body;
}
