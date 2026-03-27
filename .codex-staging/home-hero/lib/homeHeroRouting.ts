export type HomeHeroPrimaryAction = "services" | "register";

export type HomeHeroCategoryKey =
  | "consulting"
  | "translation"
  | "legal"
  | "psychology"
  | "sport"
  | "product";

type HomeHeroRouteConfig = {
  pathname: string;
  query?: Record<string, string>;
};

export const HOME_HERO_PRIMARY_ROUTES: Record<HomeHeroPrimaryAction, HomeHeroRouteConfig> = {
  services: {
    pathname: "/agents",
    query: { view: "services" }
  },
  register: {
    pathname: "/agents/register"
  }
};

export const HOME_HERO_CATEGORY_ROUTES: Record<HomeHeroCategoryKey, HomeHeroRouteConfig> = {
  consulting: {
    pathname: "/agents",
    query: { category: "consulting" }
  },
  translation: {
    pathname: "/agents",
    query: { category: "translation" }
  },
  legal: {
    pathname: "/agents",
    query: { category: "legal" }
  },
  psychology: {
    pathname: "/agents",
    query: { category: "psychology" }
  },
  sport: {
    pathname: "/agents",
    query: { category: "sport" }
  },
  product: {
    pathname: "/products"
  }
};

const withQuery = (pathname: string, query?: Record<string, string>) => {
  const searchParams = new URLSearchParams();
  Object.entries(query || {}).forEach(([key, value]) => {
    if (!value) return;
    searchParams.set(key, value);
  });
  const queryString = searchParams.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
};

export const getHomeHeroPrimaryHref = (action: HomeHeroPrimaryAction) =>
  withQuery(HOME_HERO_PRIMARY_ROUTES[action].pathname, HOME_HERO_PRIMARY_ROUTES[action].query);

export const getHomeHeroCategoryHref = (category: HomeHeroCategoryKey) =>
  withQuery(HOME_HERO_CATEGORY_ROUTES[category].pathname, HOME_HERO_CATEGORY_ROUTES[category].query);

export const buildHomeHeroSearchHref = (query: string) =>
  withQuery("/search", {
    q: query.trim(),
    type: "all"
  });
