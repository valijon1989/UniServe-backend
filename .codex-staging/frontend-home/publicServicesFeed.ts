import { client } from "@/api/client";
import { toQuery } from "@/lib/fetcher";

type QueryValue = string | number | null | undefined;
type QueryParams = Record<string, QueryValue>;

type PublicServiceFeedResult = {
  data: any;
  source: "backend" | "app-api";
};

const buildRelativeApiUrl = (params: QueryParams) => {
  const query = toQuery(params);
  return query ? `/api/services?${query}` : "/api/services";
};

const fetchFromAppApi = async (params: QueryParams) => {
  const response = await fetch(buildRelativeApiUrl(params), {
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
};

export async function fetchPublicServicesFeed(params: QueryParams): Promise<PublicServiceFeedResult> {
  try {
    const response = await client.get("/services", {
      params,
      headers: { "X-Skip-Auth": "1" }
    });
    return {
      data: response.data,
      source: "backend"
    };
  } catch (error) {
    if (typeof window === "undefined") throw error;
    return {
      data: await fetchFromAppApi(params),
      source: "app-api"
    };
  }
}

export async function fetchTrendingServicesFeed(
  params: QueryParams & { limit?: number; page?: number }
): Promise<PublicServiceFeedResult> {
  try {
    const response = await client.get("/services/trending", {
      params,
      headers: { "X-Skip-Auth": "1" }
    });
    return {
      data: response.data,
      source: "backend"
    };
  } catch (error) {
    if (typeof window === "undefined") throw error;
    const limit = typeof params.limit === "number" ? params.limit : 12;
    const page = typeof params.page === "number" ? params.page : 1;
    return {
      data: await fetchFromAppApi({
        limit,
        cursor: Math.max(0, (page - 1) * limit),
        sort: "popular"
      }),
      source: "app-api"
    };
  }
}
