import { Router } from "express";
import { buildMarketplaceFilterSchema, listMarketplaceSections } from "../services/categoryTaxonomy";
import { getUiIconSpec, listMarketplaceSortOptions, UI_ICON_LIBRARY } from "../services/marketplaceUiCatalog";

const router = Router();

router.get("/", (req, res) => {
  res.json(
    listMarketplaceSections(["services", "consulting", "digital_services", "courses"], req.locale).map((category) => ({
        slug: category.slug,
        name: category.displayName,
        localizedName: category.name,
        route: category.route,
        iconLibrary: UI_ICON_LIBRARY,
        iconMeta: getUiIconSpec(category.slug as any, req.locale, category.displayName),
        sortOptions: listMarketplaceSortOptions(req.locale),
        children: category.subcategories.map((subcategory) => ({
          slug: subcategory.slug,
          name: subcategory.displayName,
          localizedName: subcategory.name,
          route: subcategory.route,
          filters: subcategory.filters || [],
          filterSchema: buildMarketplaceFilterSchema(category, subcategory, req.locale),
          iconMeta: getUiIconSpec("subcategory", req.locale, subcategory.displayName)
        }))
      }))
  );
});

export default router;
