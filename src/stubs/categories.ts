import { Request, Response } from "express";
import { buildMarketplaceBreadcrumbs, buildMarketplaceFilterSchema, buildMarketplaceLanding, listMarketplaceCategories } from "../services/categoryTaxonomy";
import { buildSearchUiHints, getUiIconSpec, listMarketplaceSortOptions, UI_ICON_LIBRARY } from "../services/marketplaceUiCatalog";

export const categoriesHandler = (req: Request, res: Response) => {
  const categories = listMarketplaceCategories(req.locale).map((category) => ({
    _id: category.slug,
    slug: category.slug,
    name: category.displayName,
    localizedName: category.name,
    icon: category.icon,
    iconMeta: getUiIconSpec(category.slug as any, req.locale, category.displayName),
    route: category.route,
    breadcrumbs: buildMarketplaceBreadcrumbs(category, null, req.locale),
    filterSchema: buildMarketplaceFilterSchema(category, null, req.locale),
    sortOptions: listMarketplaceSortOptions(req.locale),
    subcategories: category.subcategories.map((subcategory) => ({
      slug: subcategory.slug,
      name: subcategory.displayName,
      localizedName: subcategory.name,
      route: subcategory.route,
      filters: subcategory.filters || [],
      filterSchema: buildMarketplaceFilterSchema(category, subcategory, req.locale),
      iconMeta: getUiIconSpec("subcategory", req.locale, subcategory.displayName)
    }))
  }));

  return res.json({
    iconLibrary: UI_ICON_LIBRARY,
    ui: buildSearchUiHints(req.locale),
    categories
  });
};

export const categoryLandingHandler = (req: Request, res: Response) => {
  const { main, subcategory } = req.params;
  const landing = buildMarketplaceLanding(main, subcategory, req.locale);
  if (!landing) {
    return res.status(404).json({ message: "Category not found" });
  }

  return res.json({
    iconLibrary: UI_ICON_LIBRARY,
    ui: buildSearchUiHints(req.locale),
    ...landing
  });
};
