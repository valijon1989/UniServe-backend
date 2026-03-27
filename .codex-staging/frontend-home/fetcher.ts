const INTERNAL_FALLBACK_PREFIXES = ["/api/services", "/api/service-categories"];

const canRetryWithAppRoute = (url: string) =>
  INTERNAL_FALLBACK_PREFIXES.some((prefix) => url === prefix || url.startsWith(`${prefix}?`) || url.startsWith(`${prefix}/`));

export async function fetcher<T = any>(url: string): Promise<T> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL;
  const shouldPrefix = apiBase && url.startsWith("/api/");
  const finalUrl = shouldPrefix ? `${apiBase}${url.replace(/^\/api/, "")}` : url;
  const res = await fetch(finalUrl);
  if (res.ok) {
    return res.json() as Promise<T>;
  }

  if (shouldPrefix && finalUrl !== url && canRetryWithAppRoute(url)) {
    const fallbackRes = await fetch(url, { cache: "no-store" });
    if (fallbackRes.ok) {
      return fallbackRes.json() as Promise<T>;
    }
  }

  throw new Error(`Request failed: ${res.status}`);
}

export function toQuery(params: Record<string, string | number | null | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") return;
    search.set(key, String(value));
  });
  return search.toString();
}
