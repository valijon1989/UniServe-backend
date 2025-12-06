import { api } from "./client";

export interface TrendProduct {
  _id?: string;
  id?: string;
  title: string;
  description?: string;
  price?: number;
  currency?: string;
  images?: string[];
  likes?: number;
  views?: number;
  orders?: number;
  category?: string;
  createdBy?: {
    _id?: string;
    name?: string;
    username?: string;
    avatarUrl?: string;
  };
}

interface TrendResponse<T> {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  items: T[];
}

const normalizeTrend = <T extends { _id?: string; id?: string }>(data: any): TrendResponse<T> => {
  const items = (data?.items as T[]) || [];
  return {
    page: Number(data?.page) || 1,
    limit: Number(data?.limit) || items.length || 9,
    total: Number(data?.total) || items.length,
    totalPages: Number(data?.totalPages) || 1,
    items: items.map((item, idx) => ({
      ...item,
      id: item.id || item._id || String(idx)
    }))
  };
};

export async function getTrendingProducts(page = 1, limit = 9): Promise<TrendResponse<TrendProduct>> {
  const res = await api.get("/api/products/trending", { params: { page, limit } });
  return normalizeTrend<TrendProduct>(res.data);
}
