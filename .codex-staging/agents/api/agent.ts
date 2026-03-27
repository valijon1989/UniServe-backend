import { api } from "./client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api";
const API_ORIGIN = API_URL.replace(/\/api\/?$/, "");

const normalizeMediaUrl = (value?: string) => {
  if (!value) return value;
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed) || /^data:/i.test(trimmed) || /^blob:/i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/api/")) return `${API_ORIGIN}${trimmed}`;
  return trimmed;
};

const normalizeUserAvatar = <T extends { avatarUrl?: string } | undefined>(user: T): T => {
  if (!user) return user;
  return {
    ...user,
    avatarUrl: normalizeMediaUrl(user.avatarUrl)
  };
};

export interface Listing {
  _id?: string;
  id?: string;
  ownerId?: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  category: string;
  type?: string;
  imageUrl?: string;
  images?: Array<{ id?: string; url: string }>;
  tags?: string[];
  location?: string;
  status?: ListingStatus;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;
}

export type ListingStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED" | "SOLD";
export type MyListingsSort = "updated" | "newest";

export interface MyListingsParams {
  status?: ListingStatus;
  q?: string;
  page?: number;
  limit?: number;
  sort?: MyListingsSort;
}

export interface MyListingsResponse {
  items: Listing[];
  page: number;
  limit: number;
  total: number;
}

export interface TopAgent {
  _id?: string;
  id?: string;
  name?: string;
  avatarUrl?: string;
  rating?: number;
  score?: number;
  weeklyScore?: number;
  weeklyListingsCount?: number;
  weeklyListingsOrders?: number;
  weeklyListingsViews?: number;
  listingsOrders?: number;
  listingsViews?: number;
  posts?: number;
  verifiedByAdmin?: boolean;
  faceIdVerified?: boolean;
  kind?: "SELLER" | "SERVICE";
  serviceCategory?: string;
  snippet?: string;
  stats?: {
    orders?: number;
    views?: number;
    likes?: number;
    listingsOrders?: number;
    listingsViews?: number;
  };
  user?: {
    _id?: string;
    name?: string;
    username?: string;
    avatarUrl?: string;
    bio?: string;
    region?: string;
    postsCount?: number;
  };
}

export type AgentListParams = {
  active?: boolean;
  sort?: "recent" | "oldest" | "likes" | "views" | "rating";
  page?: number;
  limit?: number;
  search?: string;
  verified?: 1 | 0;
  withListings?: 1 | 0;
};

export interface AgentListItem {
  _id?: string;
  id?: string;
  name?: string;
  nickname?: string;
  username?: string;
  avatarUrl?: string;
  kindLabel?: string | null;
  serviceCategory?: string | null;
  serviceCategoryLabel?: string | null;
  serviceCategoryMeta?: {
    displayName?: string | null;
  } | null;
  rating?: number;
  views?: number;
  likes?: number;
  active?: boolean;
  status?: string | boolean;
  onlineStatus?: string | boolean;
  availability?: string | boolean;
  verifiedByAdmin?: boolean;
  isVerified?: boolean;
  listingsCount?: number;
  productsCount?: number;
  servicesCount?: number;
  kind?: "SELLER" | "SERVICE";
  completedJobs?: number;
  jobsDone?: number;
  responseTime?: number;
  responseMinutes?: number;
  complaintRate?: number;
  cancelRate?: number;
  lastActiveAt?: string;
  lastActive?: string;
  updatedAt?: string;
  createdAt?: string;
  hourlyRate?: number | string;
  priceHourly?: number | string;
  price?: number | string;
  rate?: number | string;
  currency?: string;
  priceCurrency?: string;
  region?: string;
  socialServices?: string[];
  materialServices?: string[];
  user?: {
    _id?: string;
    name?: string;
    username?: string;
    avatarUrl?: string;
    isVerified?: boolean;
    bio?: string;
    region?: string;
    postsCount?: number;
    updatedAt?: string;
    createdAt?: string;
  };
}

export interface AgentListingCard {
  id: string;
  type: "product" | "service" | "education" | "construction" | "taxi";
  title?: string;
  imageUrl?: string;
}

export interface AgentDetail {
  _id?: string;
  id?: string;
  name?: string;
  nickname?: string;
  username?: string;
  avatarUrl?: string;
  rating?: number;
  views?: number;
  likes?: number;
  region?: string;
  regionDetail?: string;
  bio?: string;
  verifiedByAdmin?: boolean;
  isVerified?: boolean;
  listingsCount?: number;
  listings?: {
    listingCards?: AgentListingCard[];
  };
}

export interface AgentReview {
  _id?: string;
  id?: string;
  user?: {
    name?: string;
    username?: string;
    avatarUrl?: string;
  };
  rating: number;
  comment: string;
  createdAt?: string;
}

export async function getAgents(params: AgentListParams) {
  const res = await api.get("/agents", { params });
  const payload = res.data || {};
  const rawItems: AgentListItem[] =
    payload.items ||
    payload.agents?.items ||
    payload.agents?.data ||
    payload.agents ||
    payload.data?.items ||
    payload.data?.agents ||
    payload.data ||
    payload.results ||
    [];
  const items: AgentListItem[] = rawItems.map((item) => ({
    ...item,
    avatarUrl: normalizeMediaUrl(item.avatarUrl),
    user: normalizeUserAvatar(item.user)
  }));
  return {
    items,
    total:
      payload.total ??
      payload.count ??
      payload.agents?.total ??
      payload.data?.total ??
      payload.results?.total ??
      items.length
  };
}

export async function getAgentById(agentId: string): Promise<AgentDetail | null> {
  const res = await api.get(`/agents/${agentId}`);
  const payload = res.data || null;
  if (!payload) return null;
  const rawAgent = payload.agent || payload;
  const user = rawAgent?.user || rawAgent?.userProfile || rawAgent?.account || rawAgent?.owner;
  const profile = rawAgent?.profile || rawAgent?.agentProfile || rawAgent?.details;
  const base = user || rawAgent || {};
  const profileData = profile || rawAgent || {};
  const listings = payload.listings || rawAgent?.listings || {};
  const listingCards = (listings.listingCards || []).map((card: any) => ({
    ...card,
    id: String(card.id || card._id || ""),
    imageUrl: card.imageUrl || card.image || card.images?.[0]
  }));
  const listingsCount =
    typeof listings.listingsCount === "number"
      ? listings.listingsCount
      : listingCards.length ||
        (listings.products?.length || 0) +
          (listings.services?.length || 0) +
          (listings.educationListings?.length || 0) +
          (listings.constructionListings?.length || 0) +
          (listings.taxiListings?.length || 0);

  return {
    id: base._id || rawAgent?._id,
    _id: base._id || rawAgent?._id,
    name: base.name || rawAgent?.name,
    nickname: rawAgent?.nickname,
    username: base.username || rawAgent?.username,
    avatarUrl: normalizeMediaUrl(base.avatarUrl || rawAgent?.avatarUrl),
    rating: profileData.rating ?? rawAgent?.rating,
    views: profileData.profileViews ?? rawAgent?.views,
    likes: profileData.profileLikes ?? rawAgent?.likes,
    region: base.region || rawAgent?.region,
    regionDetail: rawAgent?.regionDetail,
    bio: base.bio || rawAgent?.bio,
    verifiedByAdmin: profileData.verifiedByAdmin ?? rawAgent?.verifiedByAdmin,
    isVerified: base.isVerified ?? rawAgent?.isVerified,
    listingsCount,
    listings: {
      ...listings,
      listingCards
    }
  };
}

export async function getAgentReviews(agentId: string): Promise<AgentReview[]> {
  const res = await api.get(`/agents/${agentId}/reviews`);
  const raw: AgentReview[] = res.data?.items || res.data?.reviews || res.data || [];
  return raw.map((review) => ({
    ...review,
    user: normalizeUserAvatar(review.user)
  }));
}

export async function createAgentReview(
  agentId: string,
  payload: { rating: number; comment: string }
): Promise<AgentReview> {
  const res = await api.post(`/agents/${agentId}/reviews`, payload);
  return res.data;
}

const normalizeListingStatus = (value: unknown): ListingStatus => {
  if (typeof value !== "string") return "DRAFT";
  const status = value.toUpperCase();
  if (status === "ACTIVE" || status === "PAUSED" || status === "ARCHIVED" || status === "SOLD") {
    return status;
  }
  return "DRAFT";
};

const normalizeListing = (item: any): Listing => {
  const normalizedId = String(item?._id || item?.id || "");
  const rawImages = Array.isArray(item?.images) ? item.images : [];
  const normalizedImages = rawImages
    .map((entry: any) => {
      const rawUrl = typeof entry === "string" ? entry : entry?.url || entry?.src;
      const normalizedUrl = normalizeMediaUrl(rawUrl);
      if (!normalizedUrl) return null;
      return {
        id: typeof entry === "string" ? undefined : entry?.id || entry?._id,
        url: normalizedUrl
      };
    })
    .filter(Boolean) as Array<{ id?: string; url: string }>;
  const fallbackImage = normalizeMediaUrl(
    item?.imageUrl || item?.image || item?.coverImageUrl || item?.coverImage || rawImages[0]?.url || rawImages[0]
  );
  const imageUrl = fallbackImage || normalizedImages[0]?.url || "";

  return {
    ...item,
    _id: normalizedId || undefined,
    id: normalizedId || undefined,
    title: typeof item?.title === "string" ? item.title : "",
    description: typeof item?.description === "string" ? item.description : "",
    price: typeof item?.price === "number" ? item.price : Number(item?.price || 0) || 0,
    currency: typeof item?.currency === "string" && item.currency.trim() ? item.currency : "USD",
    category:
      (typeof item?.category === "string" && item.category.trim()) ||
      (typeof item?.type === "string" && item.type.trim()) ||
      "SERVICE",
    imageUrl,
    images: normalizedImages.length ? normalizedImages : imageUrl ? [{ url: imageUrl }] : [],
    status: normalizeListingStatus(item?.status)
  };
};

const extractListingsPayload = (payload: any) => {
  if (!payload) {
    return { rawItems: [], page: 1, limit: 12, total: 0 };
  }
  const rawItems =
    payload.items ||
    payload.listings?.items ||
    payload.listings ||
    payload.data?.items ||
    payload.data?.listings ||
    payload.data ||
    [];
  const page = Number(payload.page || payload.pagination?.page || payload.meta?.page || payload.data?.page || 1) || 1;
  const limit =
    Number(payload.limit || payload.pagination?.limit || payload.meta?.limit || payload.data?.limit || 12) || 12;
  const total =
    Number(payload.total || payload.pagination?.total || payload.meta?.total || payload.count || rawItems.length) || 0;
  return {
    rawItems: Array.isArray(rawItems) ? rawItems : [],
    page,
    limit,
    total
  };
};

const isHttpErrorWithStatus = (error: unknown, statuses: number[]) => {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return typeof status === "number" && statuses.includes(status);
};

export async function getMyListings(params: MyListingsParams = {}): Promise<MyListingsResponse> {
  const res = await api.get("/agent/listings", { params });
  const payload = extractListingsPayload(res.data || {});
  const items = payload.rawItems.map((item: any) => normalizeListing(item));
  return {
    items,
    page: payload.page,
    limit: payload.limit,
    total: payload.total
  };
}

export async function createListing(input: Listing): Promise<Listing> {
  const res = await api.post("/agent/listings", input);
  return normalizeListing(res.data?.item || res.data?.listing || res.data);
}

export async function updateListing(id: string, input: Partial<Listing>): Promise<Listing> {
  try {
    const res = await api.patch(`/agent/listings/${id}`, input);
    return normalizeListing(res.data?.item || res.data?.listing || res.data);
  } catch (error) {
    if (!isHttpErrorWithStatus(error, [404, 405])) {
      throw error;
    }
    const res = await api.put(`/agent/listings/${id}`, input);
    return normalizeListing(res.data?.item || res.data?.listing || res.data);
  }
}

export async function updateListingStatus(id: string, status: ListingStatus): Promise<Listing> {
  const res = await api.patch(`/agent/listings/${id}/status`, { status });
  return normalizeListing(res.data?.item || res.data?.listing || res.data);
}

export async function deleteListing(id: string): Promise<void> {
  await api.delete(`/agent/listings/${id}`);
}

export async function getTopAgents(limit = 20): Promise<TopAgent[]> {
  const res = await api.get("/agents/top", { params: { limit } });
  const agents: TopAgent[] = res.data?.agents || res.data?.items || res.data || [];
  return agents.map((a, idx) => ({
    ...a,
    id: a.id || a._id || String(idx),
    avatarUrl: normalizeMediaUrl(a.avatarUrl),
    user: normalizeUserAvatar(a.user)
  }));
}
