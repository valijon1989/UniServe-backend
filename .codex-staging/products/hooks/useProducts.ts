"use client";

import { useEffect, useState } from "react";
import { getProducts, type Product } from "@/api/products";
import { useI18n } from "@/context/i18n";

interface PaginationState {
  page: number;
  limit: number;
  total?: number;
}

type Filters = Record<string, any>;

export function useProducts(initial: Filters = {}) {
  const { language } = useI18n();
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>(initial);
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    limit: 12
  });

  useEffect(() => {
    let active = true;
    setLoading(true);

    getProducts({ ...filters, ...pagination }, language)
      .then((res) => {
        if (!active) return;
        setItems(res.products);
        setPagination((p) => ({ ...p, total: res.total }));
      })
      .catch((err) => {
        console.error("Products load error", err);
        if (!active) return;
        setItems([]);
        setPagination((p) => ({ ...p, total: 0 }));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [filters, language, pagination.page, pagination.limit]);

  return { items, loading, filters, setFilters, pagination, setPagination };
}
