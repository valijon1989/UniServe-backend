"use client";

import {
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
  type MouseEventHandler,
  type ReactNode,
  type SVGProps
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { addCartItem, createBuyNowSession } from "@/api/commerce";
import { isDetailSaved, toggleDetailSaved } from "@/api/detailInteractions";
import type { Product } from "@/api/products";
import { buildProductSpecSnippet, buildSellerTrustSnippet, getShopCategoryMeta } from "@/data/shopTaxonomy";
import { useI18n } from "@/context/i18n";
import { BookmarkIcon, EyeIcon } from "@/components/listing/ListingActionIcons";
import { ProductActions } from "@/components/product-card/ProductActions";
import { ProductBadge, type ProductBadgeTone } from "@/components/product-card/ProductBadge";
import { ProductMetaRow } from "@/components/product-card/ProductMetaRow";
import { ProductPriceBlock } from "@/components/product-card/ProductPriceBlock";
import { buildLoginRedirect, isUnauthorizedApiError, sanitizeInternalRedirect } from "@/lib/authRedirect";
import { formatMoneyByLocale, resolveLocalizedText } from "@/lib/localization";
import { normalizeMarketplaceSubtitle, normalizeMarketplaceTitle } from "@/lib/marketplaceNaming";
import {
  formatProductDemandLabel,
  formatProductImageCountLabel,
  formatProductInstallmentLabel,
  formatProductReviewLabel,
  formatProductStockLabel,
  getProductDeliveryLabel
} from "@/lib/productsPresentation";
import { useAuthStore } from "@/store/auth";

interface ProductCardProps {
  data: Product;
  disableNavigation?: boolean;
  onCardClick?: () => void;
}

const productImageFallbacks = [
  "/fallback/product.png",
  "/images/products/bosh.png",
  "/images/placeholders/service.jpg"
];

const hashValue = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const resolveProductImage = (src: string | undefined, seed: number) => {
  const raw = (src || "").trim();
  if (!raw) return productImageFallbacks[seed % productImageFallbacks.length];
  if (!raw.startsWith("/images/remote/remote-")) return raw;

  const match = raw.match(/remote-(\d{4})\.jpg$/i);
  if (!match) return productImageFallbacks[seed % productImageFallbacks.length];
  const remoteNumber = Number(match[1]);
  const safeIndex = Number.isFinite(remoteNumber) ? remoteNumber % productImageFallbacks.length : seed % productImageFallbacks.length;
  return productImageFallbacks[safeIndex];
};

const isRecentProduct = (createdAt?: string) => {
  if (!createdAt) return false;
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return false;
  return Date.now() - created <= 1000 * 60 * 60 * 24 * 21;
};

function StarMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="m12 3.7 2.5 5 5.5.8-4 3.9.9 5.5L12 16.3 7.1 19l.9-5.5-4-3.9 5.5-.8 2.5-5Z" />
    </svg>
  );
}

function CheckMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="m5 12.5 4.1 4.1L19 6.8" />
    </svg>
  );
}

function BoltMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M13.4 2 5.8 13.1h4.9L9.9 22l8.3-11.1h-5L13.4 2Z" />
    </svg>
  );
}

function CubeMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="m12 3 7 4v10l-7 4-7-4V7l7-4Z" />
      <path d="m5 7 7 4 7-4" />
      <path d="M12 11v10" />
    </svg>
  );
}

function QuickActionButton({
  label,
  onClick,
  active = false,
  children
}: {
  label: string;
  onClick: MouseEventHandler<HTMLButtonElement>;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full border shadow-sm backdrop-blur transition ${
        active
          ? "border-rose-200 bg-rose-50/95 text-rose-600"
          : "border-white/30 bg-white/88 text-slate-700 hover:bg-white"
      }`}
    >
      {children}
    </button>
  );
}

export default function ProductCard({ data, disableNavigation = false, onCardClick }: ProductCardProps) {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const { t, language } = useI18n();
  const [pendingAction, setPendingAction] = useState<"cart" | "buy" | null>(null);
  const [saved, setSaved] = useState(false);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const tp = (key: string, fallback: string) => {
    const value = t(key);
    return value && value !== key ? value : fallback;
  };

  const productId = data._id || data.id || "";
  const routeIdentifier = data.slug || data.id || data._id || "";
  const routeHref = data.route || data.card?.route || (routeIdentifier ? `/products/${routeIdentifier}` : "");
  const seed = (routeIdentifier || productId || data.name || data.title || "").toString();
  const hash = useMemo(() => hashValue(seed), [seed]);
  const currentPath = sanitizeInternalRedirect(
    `${pathname}${searchParams?.toString() ? `?${searchParams.toString()}` : ""}`,
    "/"
  );

  const redirectToLogin = (message: string) => {
    toast.error(message);
    router.push(buildLoginRedirect(currentPath));
  };

  const handleOpen = () => {
    if (typeof window !== "undefined" && (productId || routeIdentifier)) {
      try {
        const payload = JSON.stringify(data);
        Array.from(new Set([productId, routeIdentifier].filter(Boolean))).forEach((key) => {
          window.sessionStorage.setItem(`product-preview-${key}`, payload);
        });
      } catch {
        // Ignore storage failures in private browsing or restricted environments.
      }
    }

    if (disableNavigation) {
      onCardClick?.();
      return;
    }
    if (onCardClick) {
      onCardClick();
      return;
    }
    if (routeHref) {
      router.push(routeHref);
    }
  };

  const handleCardKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    handleOpen();
  };

  const title =
    normalizeMarketplaceTitle(
      resolveLocalizedText(
        data.titleLocalized || data.nameLocalized || data.localized?.title || data.localized?.name,
        language
      ) ||
        data.name ||
        data.title,
      tp("products.card.fallback.title", "Product")
    );

  const description =
    normalizeMarketplaceSubtitle(
      resolveLocalizedText(data.descriptionLocalized || data.localized?.description, language) || data.description,
      tp("products.card.fallback.description", "No short description available yet.")
    );

  const priceValue = typeof data.price === "number" ? data.price : null;
  const oldPriceValue = typeof data.oldPrice === "number" ? data.oldPrice : null;
  const price =
    priceValue !== null
      ? formatMoneyByLocale(priceValue, data.currency || "USD", language)
      : tp("products.card.price.contact", "Contact for price");
  const oldPrice =
    oldPriceValue !== null ? formatMoneyByLocale(oldPriceValue, data.currency || "USD", language) : null;

  const rating = data.rating?.avg ?? 0;
  const ratingCount = data.rating?.count ?? 0;
  const stats = data.stats || {
    views: data.views ?? 0,
    likes: data.likes ?? 0,
    purchases: data.orders ?? 0
  };
  const soldCount = stats.purchases ?? data.orders ?? 0;
  const viewCount = stats.views ?? data.views ?? 0;
  const categoryMeta = getShopCategoryMeta(data.category);
  const categoryLabel = resolveLocalizedText(categoryMeta.label, language);
  const categoryShortLabel = resolveLocalizedText(categoryMeta.shortLabel, language);
  const specSnippet = buildProductSpecSnippet(data, language);
  const trustSnippet = buildSellerTrustSnippet(data, language);
  const sellerName =
    data.seller?.name ||
    data.vendor?.name ||
    data.createdBy?.name ||
    data.agent?.name ||
    data.createdBy?.username ||
    data.vendor?.username ||
    "";
  const brandLabel = data.brand || sellerName || categoryShortLabel || categoryLabel;
  const eyebrow = [brandLabel, categoryShortLabel && categoryShortLabel !== brandLabel ? categoryShortLabel : ""]
    .filter(Boolean)
    .join(" / ");
  const subtitle = specSnippet.slice(0, 2).join(" · ") || description;
  const deliveryKeys = ["fast", "tomorrow", "standard"] as const;
  const deliveryKey =
    (data.shippingInfo?.deliveryType as (typeof deliveryKeys)[number] | undefined) || deliveryKeys[hash % deliveryKeys.length];
  const deliveryLabel =
    data.shippingInfo?.deliveryLabel ||
    data.card?.logistics?.deliveryLabel ||
    getProductDeliveryLabel(deliveryKey, language);

  const stockCount = typeof data.stock === "number" ? data.stock : null;
  const isOutOfStock = stockCount !== null && stockCount <= 0;
  const isLimitedStock = stockCount !== null ? stockCount > 0 && stockCount <= 6 : hash % 6 === 0;
  const isFreeDelivery = (priceValue ?? 0) >= 100 || hash % 2 === 0;
  const isBestSeller = soldCount >= 40 || hash % 5 === 0;
  const isVerifiedSeller =
    Boolean(sellerName) && ((data.vendor?.rating ?? data.seller?.rating ?? rating) >= 4.6 || ratingCount >= 80);
  const isNew = isRecentProduct(data.createdAt) || (!data.createdAt && hash % 7 === 0);
  const installmentLabel =
    priceValue && priceValue >= 60
      ? formatProductInstallmentLabel(priceValue / 12, data.currency || "USD", language)
      : null;
  const discount =
    priceValue !== null && oldPriceValue !== null && oldPriceValue > priceValue
      ? Math.round(((oldPriceValue - priceValue) / oldPriceValue) * 100)
      : null;

  const imageCandidates = useMemo(() => {
    const seen = new Set<string>();
    return [data.thumbnail, ...(data.images || [])]
      .map((src) => resolveProductImage(src, hash))
      .filter((src) => {
        if (!src || seen.has(src)) return false;
        seen.add(src);
        return true;
      });
  }, [data.images, data.thumbnail, hash]);

  const primaryImage = imageCandidates[0] || productImageFallbacks[hash % productImageFallbacks.length];
  const secondaryImage = imageCandidates[1] || null;
  const imageCount = imageCandidates.length;
  const imageCountLabel = formatProductImageCountLabel(imageCount, language) || null;
  const stockLabel = formatProductStockLabel({ stockCount, isOutOfStock, isLimitedStock }, language);

  const savedKey = productId || seed;
  const saveActionLabel = saved
    ? tp("products.card.action.unsave", "Remove product from saved")
    : tp("products.card.action.save", "Save product");
  const quickViewLabel = tp("products.card.action.quickView", "Quick view");

  useEffect(() => {
    if (!savedKey) return;
    setSaved(isDetailSaved("product", savedKey));
  }, [savedKey]);

  const addToCart: MouseEventHandler<HTMLButtonElement> = async (event) => {
    event.stopPropagation();
    if (!productId || isOutOfStock) return;
    if (!isHydrated) return;
    if (!isAuthenticated) {
      redirectToLogin(tp("products.card.toast.login_cart", "Please sign in to add products to your cart."));
      return;
    }

    try {
      setPendingAction("cart");
      await addCartItem({ productId, qty: 1, product: data });
      toast((instance) => (
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-100">
            {tp("products.card.toast.added", "Added to cart")}
          </span>
          <button
            type="button"
            className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-slate-900"
            onClick={() => {
              toast.dismiss(instance.id);
              router.push("/cart");
            }}
          >
            {tp("products.card.action.go_to_cart", "Go to cart")}
          </button>
        </div>
      ));
    } catch (error: unknown) {
      if (isUnauthorizedApiError(error)) {
        redirectToLogin(tp("products.card.toast.session_cart", "Your session is required to use the cart."));
        return;
      }
      toast.error(
        (error as { message?: string })?.message || tp("products.card.toast.cart_error", "Could not add the product to cart.")
      );
    } finally {
      setPendingAction(null);
    }
  };

  const buyNow: MouseEventHandler<HTMLButtonElement> = async (event) => {
    event.stopPropagation();
    if (!productId || isOutOfStock) return;
    if (!isHydrated) return;
    if (!isAuthenticated) {
      redirectToLogin(tp("products.card.toast.login_checkout", "Please sign in to continue with checkout."));
      return;
    }

    try {
      setPendingAction("buy");
      const session = await createBuyNowSession({ productId, qty: 1, product: data });
      router.push(`/checkout?mode=buynow&sid=${encodeURIComponent(session.sid)}`);
    } catch (error: unknown) {
      if (isUnauthorizedApiError(error)) {
        redirectToLogin(
          tp("products.card.toast.session_checkout", "Your session is required to continue with checkout.")
        );
        return;
      }
      toast.error(
        (error as { message?: string })?.message || tp("products.card.toast.checkout_error", "Could not start checkout.")
      );
    } finally {
      setPendingAction(null);
    }
  };

  const handleToggleSaved: MouseEventHandler<HTMLButtonElement> = (event) => {
    event.stopPropagation();
    if (!savedKey) return;
    const next = toggleDetailSaved("product", savedKey);
    setSaved(next);
    toast.success(
      next
        ? tp("products.card.toast.saved", "Product saved")
        : tp("products.card.toast.unsaved", "Product removed from saved")
    );
  };

  const handleQuickView: MouseEventHandler<HTMLButtonElement> = (event) => {
    event.stopPropagation();
    handleOpen();
  };

  const badgeItems: Array<{ key: string; label: string; tone: ProductBadgeTone } | null> = [
    discount !== null ? { key: "discount", label: `-${discount}%`, tone: "discount" as const } : null,
    isNew ? { key: "new", label: tp("products.card.badge.new", "New"), tone: "dark" as const } : null,
    isBestSeller
      ? {
          key: "bestseller",
          label: tp("products.card.badge.best_seller", "Best seller"),
          tone: "warning" as const
        }
      : null,
    isFreeDelivery
      ? {
          key: "free-delivery",
          label: tp("products.card.badge.free_delivery", "Free delivery"),
          tone: "success" as const
        }
      : null,
    isVerifiedSeller
      ? {
          key: "verified",
          label: tp("products.card.badge.verified_seller", "Verified seller"),
          tone: "info" as const
        }
      : null,
    isLimitedStock && !isOutOfStock
      ? {
          key: "limited",
          label: tp("products.card.badge.limitedStock", "Limited stock"),
          tone: "danger" as const
        }
      : null,
    deliveryKey === "fast"
      ? {
          key: "shipping",
          label: tp("products.card.badge.fastShipping", "Fast shipping"),
          tone: "info" as const
        }
      : null
  ];

  const supportLabel = sellerName ? `${trustSnippet} · ${sellerName}` : trustSnippet;

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={handleCardKeyDown}
      aria-label={title}
      className="group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-[1.85rem] border border-slate-200/85 bg-white/96 shadow-[0_20px_44px_rgba(15,23,42,0.08)] transition duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-[0_28px_56px_rgba(15,23,42,0.12)] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(226,232,240,0.95),_rgba(241,245,249,0.9)_48%,_rgba(226,232,240,0.86))]">
        <img
          src={primaryImage}
          alt={title}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = productImageFallbacks[hash % productImageFallbacks.length];
          }}
        />
        {secondaryImage ? (
          <img
            src={secondaryImage}
            alt={title}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover opacity-0 transition duration-500 group-hover:scale-[1.06] group-hover:opacity-100"
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = primaryImage;
            }}
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/22 via-transparent to-transparent opacity-70" />

        <div className="absolute left-3 top-3 flex max-w-[72%] flex-wrap gap-2">
          {badgeItems.slice(0, 4).map((badge) =>
            badge ? <ProductBadge key={badge.key} label={badge.label} tone={badge.tone} /> : null
          )}
        </div>

        <div className="absolute right-3 top-3 flex flex-col gap-2">
          <QuickActionButton label={saveActionLabel} onClick={handleToggleSaved} active={saved}>
            <BookmarkIcon className="h-4.5 w-4.5" filled={saved} />
          </QuickActionButton>
          <QuickActionButton label={quickViewLabel} onClick={handleQuickView}>
            <EyeIcon className="h-4.5 w-4.5" />
          </QuickActionButton>
        </div>

        <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2">
          <ProductBadge label={categoryLabel || categoryShortLabel} tone="dark" className="max-w-[62%]" />
          {imageCountLabel ? <ProductBadge label={imageCountLabel} tone="neutral" /> : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="space-y-2">
          <p className="line-clamp-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{eyebrow}</p>
          <h3 className="line-clamp-2 text-[1.05rem] font-black leading-tight tracking-tight text-slate-950">{title}</h3>
          <p className="line-clamp-1 text-sm text-slate-600">{subtitle}</p>
        </div>

        <div className="space-y-2">
          <ProductMetaRow
            items={[
              {
                key: "rating",
                label:
                  rating > 0
                    ? `${rating.toFixed(1)}`
                    : tp("products.card.badge.new", "New"),
                icon: (
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                    <StarMark className="h-2.5 w-2.5" />
                  </span>
                ),
                tone: "warning"
              },
              {
                key: "reviews",
                label: formatProductReviewLabel(ratingCount, language),
                tone: "muted"
              },
              {
                key: "demand",
                label: formatProductDemandLabel(soldCount, viewCount, language),
                icon: (
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                    {soldCount > 0 ? <CubeMark className="h-2.5 w-2.5" /> : <EyeIcon className="h-2.5 w-2.5" />}
                  </span>
                ),
                tone: "neutral"
              }
            ]}
          />

          <ProductMetaRow
            items={[
              isVerifiedSeller
                ? {
                    key: "verified",
                    label: tp("products.card.badge.verified_seller", "Verified seller"),
                    icon: (
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                        <CheckMark className="h-2.5 w-2.5" />
                      </span>
                    ),
                    tone: "info" as const
                  }
                : {
                    key: "trust",
                    label: trustSnippet,
                    tone: "muted" as const
                  },
              {
                key: "stock",
                label: stockLabel,
                icon: (
                  <span
                    className={`inline-flex h-4 w-4 items-center justify-center rounded-full ${
                      isOutOfStock
                        ? "bg-rose-100 text-rose-700"
                        : isLimitedStock
                          ? "bg-amber-100 text-amber-700"
                          : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {isOutOfStock ? <CubeMark className="h-2.5 w-2.5" /> : <CheckMark className="h-2.5 w-2.5" />}
                  </span>
                ),
                tone: isOutOfStock ? "danger" : isLimitedStock ? "warning" : "success"
              },
              {
                key: "delivery",
                label: isFreeDelivery ? tp("products.card.badge.free_delivery", "Free delivery") : deliveryLabel,
                icon: (
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                    <BoltMark className="h-2.5 w-2.5" />
                  </span>
                ),
                tone: isFreeDelivery || deliveryKey === "fast" ? "success" : "neutral"
              }
            ]}
          />
        </div>

        <ProductPriceBlock
          label={tp("products.card.price.label", "Price")}
          currentPrice={price}
          oldPrice={oldPrice}
          discountLabel={discount !== null ? `-${discount}%` : null}
          installmentLabel={installmentLabel}
          supportingLabel={supportLabel}
        />

        <ProductActions
          addToCartLabel={tp("products.card.action.add_to_cart", "Add to cart")}
          buyNowLabel={tp("products.card.action.buy_now", "Buy now")}
          loadingCartLabel={tp("products.card.action.loadingCart", "Adding...")}
          loadingBuyLabel={tp("products.card.action.loadingBuy", "Opening...")}
          onAddToCart={addToCart}
          onBuyNow={buyNow}
          pendingAction={pendingAction}
          disabled={!productId || isOutOfStock}
        />
      </div>
    </div>
  );
}
