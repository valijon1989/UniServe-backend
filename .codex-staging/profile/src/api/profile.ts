import { AxiosError } from "axios";
import { api } from "./client";

export type UserRole = "USER" | "AGENT" | "ADMIN" | string;

export interface UserStats {
  followers: number;
  following: number;
  posts: number;
  listings: number;
}

export interface MyProfile {
  _id?: string;
  id?: string;
  name?: string;
  username?: string;
  email?: string;
  phone?: string;
  role?: UserRole;
  isVerified?: boolean;
  avatarUrl?: string;
  bio?: string;
  about?: string;
  location?: string;
  language?: string;
  languages?: string[];
  isPrivate?: boolean;
  stats?: UserStats;
}

export interface UpdateMyProfileInput {
  name?: string;
  username?: string;
  bio?: string;
  about?: string;
  phone?: string;
  location?: string;
  language?: string;
  languages?: string[];
  isPrivate?: boolean;
  avatarUrl?: string;
}

export interface AgentMeProfile {
  id?: string;
  kind?: AgentKind | string;
  serviceCategory?: string;
  socialServices?: string[];
  materialServices?: string[];
  serviceOfficeAddress?: string;
  serviceQualification?: string;
  categories: string[];
  pricing?: string;
  availability?: string;
  portfolio: string[];
  ratingAvg?: number;
  ratingCount?: number;
  verificationStatus?: string;
  ratingBreakdown?: {
    five: number;
    four: number;
    three: number;
    two: number;
    one: number;
  };
}

export interface UpdateAgentMeInput {
  categories?: string[];
  pricing?: string;
  availability?: string;
  portfolio?: string[];
}

export type AgentKind = "SERVICE" | "SELLER";

export interface AgentTypesResponse {
  kinds: Array<{ value: AgentKind; label?: string }>;
  categories: string[];
  categoryOptions?: Array<{
    value: string;
    label?: string;
    localizedName?: string;
    route?: string;
    mainCategory?: string;
  }>;
  defaults?: {
    kind?: AgentKind;
  };
}

export interface BecomeAgentInput {
  kind?: AgentKind | string;
  serviceCategory?: string;
  socialServices?: string[];
  materialServices?: string[];
  serviceOfficeAddress?: string;
  serviceQualification?: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const unwrapPayload = <T = Record<string, unknown>>(input: any): T => {
  if (input?.data && typeof input.data === "object") return input.data as T;
  if (input?.user && typeof input.user === "object") return input.user as T;
  if (input?.item && typeof input.item === "object") return input.item as T;
  return input as T;
};

const isNotFoundError = (error: unknown) => {
  return error instanceof AxiosError && error.response?.status === 404;
};

const isHttpStatusError = (error: unknown, statuses: number[]) => {
  return error instanceof AxiosError && Boolean(error.response?.status && statuses.includes(error.response.status));
};

const extractAxiosMessage = (error: unknown) => {
  if (!(error instanceof AxiosError)) return "";
  const data = error.response?.data as any;
  if (typeof data === "string" && data.trim()) return data.trim();
  if (data && typeof data.message === "string" && data.message.trim()) return data.message.trim();
  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    const first = data.errors.find((item: unknown) => typeof item === "string" && item.trim());
    if (typeof first === "string") return first.trim();
  }
  return "";
};

let avatarUploadUnavailable = false;
let extendedProfileFieldsUnsupported = false;

const defaultAgentKinds: AgentTypesResponse["kinds"] = [
  { value: "SERVICE", label: "Service Agent" },
  { value: "SELLER", label: "Seller Agent" }
];

const defaultAgentCategories = [
  "consulting",
  "translation",
  "legal",
  "delivery",
  "taxi",
  "education",
  "construction",
  "products"
];

const normalizeLanguageList = (input: UpdateMyProfileInput) => {
  if (Array.isArray(input.languages)) {
    return Array.from(
      new Set(
        input.languages
          .map((item) => String(item || "").trim())
          .filter(Boolean)
      )
    );
  }

  if (typeof input.language === "string") {
    return Array.from(
      new Set(
        input.language
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      )
    );
  }

  return undefined;
};

const shouldFallbackToBaseProfilePatch = (error: unknown) => {
  if (!(error instanceof AxiosError)) return false;
  if (error.response?.status !== 400) return false;

  const data = error.response?.data as any;
  const message = extractAxiosMessage(error).toLowerCase();
  const errors = Array.isArray(data?.errors) ? data.errors : [];

  const blockedFieldNames = ["phone", "location", "language", "languages", "city", "locale", "phonenumber"];
  const blockedFieldKeywords = ["not allowed", "forbidden", "unknown field", "invalid field", "cannot", "allowed fields"];

  const messageHasBlockedField = blockedFieldNames.some((field) => message.includes(field.toLowerCase()));
  const messageHasBlockedKeyword = blockedFieldKeywords.some((keyword) => message.includes(keyword));
  if (messageHasBlockedField && messageHasBlockedKeyword) return true;

  for (const item of errors) {
    if (!item) continue;
    const asString = typeof item === "string" ? item : JSON.stringify(item);
    const lower = asString.toLowerCase();
    const hasField = blockedFieldNames.some((field) => lower.includes(field.toLowerCase()));
    const hasKeyword = blockedFieldKeywords.some((keyword) => lower.includes(keyword));
    if (hasField && hasKeyword) return true;
  }

  return false;
};

const buildAvatarUploadEndpoints = () => {
  const raw = process.env.NEXT_PUBLIC_AVATAR_UPLOAD_ENDPOINTS?.trim();
  if (!raw) {
    return ["/users/me/avatar", "/media/avatar", "/users/avatar"];
  }

  const parsed = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return Array.from(new Set(parsed));
};

const tryGetByPaths = async <T = any>(paths: string[]): Promise<T> => {
  let lastError: unknown = null;
  for (const path of paths) {
    try {
      const response = await api.get(path);
      return unwrapPayload<T>(response.data);
    } catch (error) {
      if (isNotFoundError(error)) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }
  if (lastError) throw lastError;
  throw new Error("Resource topilmadi");
};

const tryPatchByPaths = async <T = any>(paths: string[], payload: Record<string, unknown>): Promise<T> => {
  let lastError: unknown = null;
  for (const path of paths) {
    try {
      const response = await api.patch(path, payload);
      return unwrapPayload<T>(response.data);
    } catch (error) {
      if (isNotFoundError(error)) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }
  if (lastError) throw lastError;
  throw new Error("Resource patch endpoint topilmadi");
};

const normalizeStats = (raw: Record<string, any>): UserStats => {
  const stats = raw?.stats && typeof raw.stats === "object" ? raw.stats : {};
  const followersSource = raw.followersCount ?? raw.followers ?? stats.followers;
  const followingSource = raw.followingCount ?? raw.following ?? stats.following;
  const postsSource = raw.postsCount ?? raw.posts ?? stats.posts;
  const listingsSource = raw.listingsCount ?? raw.listings ?? stats.listings;

  const followers = Array.isArray(followersSource) ? followersSource.length : toNumber(followersSource, 0);
  const following = Array.isArray(followingSource) ? followingSource.length : toNumber(followingSource, 0);
  const posts = Array.isArray(postsSource) ? postsSource.length : toNumber(postsSource, 0);
  const listings = Array.isArray(listingsSource) ? listingsSource.length : toNumber(listingsSource, 0);

  return {
    followers,
    following,
    posts,
    listings
  };
};

const normalizeMyProfile = (input: any): MyProfile => {
  const raw = unwrapPayload<Record<string, any>>(input) || {};
  const languages = Array.isArray(raw.languages)
    ? raw.languages.map((item: unknown) => String(item).trim()).filter(Boolean)
    : typeof raw.language === "string"
      ? raw.language
          .split(",")
          .map((item: string) => item.trim())
          .filter(Boolean)
      : [];

  return {
    _id: raw._id || raw.id,
    id: raw.id || raw._id,
    name: raw.name,
    username: raw.username || raw.nick,
    email: raw.email,
    phone: raw.phone || raw.phoneNumber,
    role: raw.role,
    isVerified: Boolean(raw.isVerified ?? raw.verified ?? false),
    avatarUrl: raw.avatarUrl || raw.avatar,
    bio: raw.bio || raw.about || raw.description,
    about: raw.about || raw.bio || raw.description,
    location: raw.location || raw.region || raw.city,
    language: typeof raw.language === "string" ? raw.language : languages.join(", "),
    languages,
    isPrivate: Boolean(raw.isPrivate ?? raw.privateProfile ?? false),
    stats: normalizeStats(raw)
  };
};

const normalizeAgentProfile = (input: any): AgentMeProfile => {
  const raw = unwrapPayload<Record<string, any>>(input) || {};
  const categories = Array.isArray(raw.categories)
    ? raw.categories.map((x) => String(x))
    : typeof raw.categories === "string"
      ? raw.categories
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean)
      : [];

  const portfolio = Array.isArray(raw.portfolio)
    ? raw.portfolio.map((x) => String(x))
    : Array.isArray(raw.portfolioUrls)
      ? raw.portfolioUrls.map((x) => String(x))
      : [];

  return {
    id: String(raw.id || raw._id || ""),
    kind: raw.kind,
    serviceCategory: typeof raw.serviceCategory === "string" ? raw.serviceCategory : undefined,
    socialServices: Array.isArray(raw.socialServices) ? raw.socialServices.map((x) => String(x)) : [],
    materialServices: Array.isArray(raw.materialServices) ? raw.materialServices.map((x) => String(x)) : [],
    serviceOfficeAddress: typeof raw.serviceOfficeAddress === "string" ? raw.serviceOfficeAddress : undefined,
    serviceQualification: typeof raw.serviceQualification === "string" ? raw.serviceQualification : undefined,
    categories,
    pricing: raw.pricing || raw.priceModel || raw.priceRange || "",
    availability: raw.availability || raw.schedule || "",
    portfolio,
    ratingAvg: toNumber(raw.ratingAvg ?? raw.rating ?? raw.ratingAverage, 0),
    ratingCount: toNumber(raw.ratingCount ?? raw.reviewsCount ?? 0, 0),
    verificationStatus: typeof raw.adminStatus === "string" ? raw.adminStatus : typeof raw.verificationStatus === "string" ? raw.verificationStatus : undefined,
    ratingBreakdown: {
      five: toNumber(raw.ratingBreakdown?.five ?? raw.ratings?.five ?? raw.stars?.[5], 0),
      four: toNumber(raw.ratingBreakdown?.four ?? raw.ratings?.four ?? raw.stars?.[4], 0),
      three: toNumber(raw.ratingBreakdown?.three ?? raw.ratings?.three ?? raw.stars?.[3], 0),
      two: toNumber(raw.ratingBreakdown?.two ?? raw.ratings?.two ?? raw.stars?.[2], 0),
      one: toNumber(raw.ratingBreakdown?.one ?? raw.ratings?.one ?? raw.stars?.[1], 0)
    }
  };
};

export async function getMyProfile(): Promise<MyProfile> {
  const raw = await tryGetByPaths<Record<string, any>>(["/users/me", "/auth/me"]);
  return normalizeMyProfile(raw);
}

export async function updateMyProfile(input: UpdateMyProfileInput): Promise<MyProfile> {
  const basePayload: Record<string, unknown> = {};
  const extendedPayload: Record<string, unknown> = {};
  const normalizedLanguages = normalizeLanguageList(input);

  if (typeof input.name === "string") basePayload.name = input.name.trim();
  if (typeof input.username === "string") basePayload.username = input.username.trim();
  if (typeof input.bio === "string") basePayload.bio = input.bio.trim();
  if (!basePayload.bio && typeof input.about === "string") basePayload.bio = input.about.trim();
  if (typeof input.isPrivate === "boolean") basePayload.isPrivate = input.isPrivate;

  if (typeof input.phone === "string") extendedPayload.phone = input.phone.trim();
  if (typeof input.location === "string") extendedPayload.location = input.location.trim();
  if (normalizedLanguages) {
    extendedPayload.languages = normalizedLanguages;
    extendedPayload.language = normalizedLanguages.join(", ");
  } else if (typeof input.language === "string") {
    extendedPayload.language = input.language.trim();
  }

  const hasBasePayload = Object.keys(basePayload).length > 0;
  const hasExtendedPayload = Object.keys(extendedPayload).length > 0;

  if (hasExtendedPayload && !extendedProfileFieldsUnsupported) {
    try {
      const raw = await tryPatchByPaths<Record<string, any>>(["/users/me", "/auth/me"], {
        ...basePayload,
        ...extendedPayload
      });
      return normalizeMyProfile(raw);
    } catch (error) {
      if (!shouldFallbackToBaseProfilePatch(error)) {
        throw error;
      }
      extendedProfileFieldsUnsupported = true;
    }
  }

  // Avatar is always updated via POST /users/me/avatar.
  // If backend rejects extended contact fields, fallback keeps base profile fields savable.
  if (!hasBasePayload) {
    return getMyProfile();
  }

  const raw = await tryPatchByPaths<Record<string, any>>(["/users/me", "/auth/me"], basePayload);
  return normalizeMyProfile(raw);
}

export async function uploadAvatar(file: File): Promise<string> {
  if (avatarUploadUnavailable) {
    const error = new Error("avatar-upload-unavailable");
    (error as Error & { code?: string }).code = "AVATAR_UPLOAD_UNAVAILABLE";
    throw error;
  }

  const makeFormData = (fieldName: string) => {
    const formData = new FormData();
    formData.append(fieldName, file);
    return formData;
  };

  const getFieldCandidates = (endpoint: string) => {
    const normalized = endpoint.toLowerCase();
    if (normalized.includes("/users/me/avatar")) return ["avatar"];
    if (normalized.includes("/media/avatar")) return ["avatar", "file", "image"];
    if (normalized.includes("/users/avatar")) return ["avatar", "file", "image"];
    return ["avatar", "file", "image"];
  };

  const endpoints = buildAvatarUploadEndpoints();
  if (endpoints.length === 0) {
    const error = new Error("avatar-upload-unavailable");
    (error as Error & { code?: string }).code = "AVATAR_UPLOAD_UNAVAILABLE";
    throw error;
  }

  let lastError: unknown = null;
  let endpointMissing = false;

  for (const endpoint of endpoints) {
    const fields = getFieldCandidates(endpoint);

    for (const fieldName of fields) {
      try {
        const response = await api.post(endpoint, makeFormData(fieldName));

        const raw = unwrapPayload<Record<string, any>>(response.data) || {};
        const url = raw.avatarUrl || raw.url || raw.fileUrl || raw.path || raw.location;
        if (url) {
          avatarUploadUnavailable = false;
          return String(url);
        }
      } catch (error) {
        if (isHttpStatusError(error, [404, 405])) {
          lastError = error;
          endpointMissing = true;
          break;
        }

        // Primary endpoint exists but rejected payload -> stop and surface real backend message.
        if (endpoint.toLowerCase().includes("/users/me/avatar")) {
          throw error;
        }

        if (isHttpStatusError(error, [400])) {
          const message = extractAxiosMessage(error).toLowerCase();
          const isWrongField =
            message.includes("upload field must be named avatar") ||
            message.includes("avatar image is required") ||
            message.includes("invalid avatar upload") ||
            message.includes("unexpected field");

          if (isWrongField) {
            lastError = error;
            continue;
          }
        }

        throw error;
      }
    }
  }

  if (endpointMissing) {
    avatarUploadUnavailable = true;
  }

  if (lastError) throw lastError;
  throw new Error("Avatar upload endpoint topilmadi");
}

export async function checkUsernameAvailability(username: string): Promise<boolean | null> {
  const clean = username.trim();
  if (clean.length < 3) return null;

  const endpoints = [
    { path: "/users/check-username", params: { username: clean } },
    { path: "/auth/check-username", params: { username: clean } }
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await api.get(endpoint.path, { params: endpoint.params });
      const raw = unwrapPayload<Record<string, any>>(response.data) || {};
      if (typeof raw.available === "boolean") return raw.available;
      if (typeof raw.isAvailable === "boolean") return raw.isAvailable;
      if (typeof raw.taken === "boolean") return !raw.taken;
      if (typeof raw.exists === "boolean") return !raw.exists;
    } catch (error) {
      if (isNotFoundError(error)) continue;
      throw error;
    }
  }

  return null;
}

export async function getMyAgentProfile(): Promise<AgentMeProfile | null> {
  try {
    const raw = await tryGetByPaths<Record<string, any>>(["/agents/me"]);
    return normalizeAgentProfile(raw);
  } catch (error) {
    if (isNotFoundError(error)) return null;
    throw error;
  }
}

export async function getAgentTypes(): Promise<AgentTypesResponse> {
  try {
    const raw = await tryGetByPaths<Record<string, any>>(["/agents/types"]);
    const kindsRaw = Array.isArray(raw?.kinds) ? raw.kinds : [];
    const categoriesRaw = Array.isArray(raw?.categories) ? raw.categories : [];
    const categoryOptionsRaw = Array.isArray(raw?.categoryOptions) ? raw.categoryOptions : [];

    const kinds = kindsRaw
      .map((item) => {
        const value = String(item?.value || "").toUpperCase();
        if (value !== "SERVICE" && value !== "SELLER") return null;
        return {
          value: value as AgentKind,
          label: typeof item?.label === "string" ? item.label : undefined
        };
      })
      .filter(Boolean) as AgentTypesResponse["kinds"];

    const categories = categoriesRaw.map((item) => String(item).trim().toLowerCase()).filter(Boolean);
    const categoryOptions = categoryOptionsRaw
      .map((item) => {
        const value = String(item?.value || "").trim().toLowerCase();
        if (!value) return null;
        return {
          value,
          label: typeof item?.label === "string" ? item.label : undefined,
          localizedName: typeof item?.localizedName === "string" ? item.localizedName : undefined,
          route: typeof item?.route === "string" ? item.route : undefined,
          mainCategory: typeof item?.mainCategory === "string" ? item.mainCategory : undefined
        };
      })
      .filter(Boolean) as NonNullable<AgentTypesResponse["categoryOptions"]>;
    const defaultKindValue = String(raw?.defaults?.kind || "").toUpperCase();
    const defaults =
      defaultKindValue === "SERVICE" || defaultKindValue === "SELLER"
        ? ({ kind: defaultKindValue as AgentKind } satisfies AgentTypesResponse["defaults"])
        : undefined;

    return {
      kinds: kinds.length ? kinds : defaultAgentKinds,
      categories: categories.length ? Array.from(new Set(categories)) : defaultAgentCategories,
      categoryOptions: categoryOptions.length ? categoryOptions : undefined,
      defaults
    };
  } catch {
    return {
      kinds: defaultAgentKinds,
      categories: defaultAgentCategories,
      categoryOptions: undefined,
      defaults: { kind: "SERVICE" }
    };
  }
}

export async function becomeAgent(input: BecomeAgentInput): Promise<Record<string, any>> {
  const payload: Record<string, unknown> = {};

  if (typeof input.kind === "string" && input.kind.trim()) payload.kind = input.kind.trim();
  if (typeof input.serviceCategory === "string" && input.serviceCategory.trim()) {
    payload.serviceCategory = input.serviceCategory.trim();
  }
  if (Array.isArray(input.socialServices)) payload.socialServices = input.socialServices;
  if (Array.isArray(input.materialServices)) payload.materialServices = input.materialServices;
  if (typeof input.serviceOfficeAddress === "string" && input.serviceOfficeAddress.trim()) {
    payload.serviceOfficeAddress = input.serviceOfficeAddress.trim();
  }
  if (typeof input.serviceQualification === "string" && input.serviceQualification.trim()) {
    payload.serviceQualification = input.serviceQualification.trim();
  }

  const response = await api.post("/agents/become", payload);
  return unwrapPayload<Record<string, any>>(response.data) || {};
}

export async function updateMyAgentType(input: BecomeAgentInput): Promise<Record<string, any>> {
  const payload: Record<string, unknown> = {};

  if (typeof input.kind === "string" && input.kind.trim()) payload.kind = input.kind.trim();
  if (typeof input.serviceCategory === "string" && input.serviceCategory.trim()) {
    payload.serviceCategory = input.serviceCategory.trim();
  }
  if (Array.isArray(input.socialServices)) payload.socialServices = input.socialServices;
  if (Array.isArray(input.materialServices)) payload.materialServices = input.materialServices;
  if (typeof input.serviceOfficeAddress === "string" && input.serviceOfficeAddress.trim()) {
    payload.serviceOfficeAddress = input.serviceOfficeAddress.trim();
  }
  if (typeof input.serviceQualification === "string" && input.serviceQualification.trim()) {
    payload.serviceQualification = input.serviceQualification.trim();
  }

  const response = await api.patch("/agents/me/type", payload);
  return unwrapPayload<Record<string, any>>(response.data) || {};
}

export async function updateMyAgentProfile(input: UpdateAgentMeInput): Promise<AgentMeProfile> {
  const payload: Record<string, unknown> = {};

  if (Array.isArray(input.categories)) payload.categories = input.categories;
  if (typeof input.pricing === "string") payload.pricing = input.pricing;
  if (typeof input.availability === "string") payload.availability = input.availability;
  if (Array.isArray(input.portfolio)) payload.portfolio = input.portfolio;

  const raw = await tryPatchByPaths<Record<string, any>>(["/agents/me"], payload);
  return normalizeAgentProfile(raw);
}

export async function changeMyPassword(input: ChangePasswordInput): Promise<void> {
  const payload = {
    currentPassword: input.currentPassword,
    oldPassword: input.currentPassword,
    newPassword: input.newPassword,
    password: input.newPassword
  };

  const endpoints = ["/users/me/password", "/auth/change-password"];
  let lastError: unknown = null;

  for (const endpoint of endpoints) {
    try {
      await api.post(endpoint, payload);
      return;
    } catch (error) {
      if (isNotFoundError(error)) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }

  if (lastError) throw lastError;
}

export async function requestSoftDelete(): Promise<void> {
  const candidates: Array<{
    method: "post" | "patch";
    path: string;
    payload: Record<string, unknown>;
  }> = [
    { method: "post", path: "/users/me/soft-delete", payload: {} },
    { method: "post", path: "/users/me/delete", payload: { soft: true } },
    { method: "patch", path: "/users/me", payload: { isDeleted: true, status: "DISABLED" } }
  ];

  let lastError: unknown = null;

  for (const candidate of candidates) {
    try {
      if (candidate.method === "post") {
        await api.post(candidate.path, candidate.payload);
      } else {
        await api.patch(candidate.path, candidate.payload);
      }
      return;
    } catch (error) {
      if (isNotFoundError(error)) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }

  if (lastError) throw lastError;
}

export const extractApiErrorMessage = (error: unknown, fallback = "Xatolik yuz berdi") => {
  if (error instanceof AxiosError) {
    const data = error.response?.data as any;
    if (typeof data === "string" && data.trim()) return data;
    if (typeof data?.message === "string" && data.message.trim()) return data.message;
    if (Array.isArray(data?.errors) && data.errors.length > 0) {
      const first = data.errors[0];
      if (typeof first === "string") return first;
      if (typeof first?.message === "string") return first.message;
    }
  }

  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
};
