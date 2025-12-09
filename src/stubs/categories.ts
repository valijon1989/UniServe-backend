import { Request, Response } from "express";

export const categoriesHandler = (_req: Request, res: Response) => {
  return res.json({
    categories: [
      { _id: "oziq-ovqat", slug: "oziq-ovqat", name: "Oziq-ovqat", icon: "ri-restaurant-line" },
      { _id: "elektronika", slug: "elektronika", name: "Elektronika", icon: "ri-smartphone-line" },
      { _id: "gozallik", slug: "gozallik", name: "Go'zallik", icon: "ri-magic-line" },
      { _id: "avto-texnika", slug: "avto-texnika", name: "Avtomabil va texnika", icon: "ri-car-line" },
      { _id: "maishiy-uskunalar", slug: "maishiy-uskunalar", name: "Maishiy uskunalar", icon: "ri-home-gear-line" },
      { _id: "kiyim-kechak", slug: "kiyim-kechak", name: "Kiyim-kechak", icon: "ri-t-shirt-line" }
    ]
  });
};
