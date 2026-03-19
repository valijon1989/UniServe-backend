import * as assert from "node:assert/strict";
import { test } from "node:test";
import mongoose from "mongoose";
import { getCart } from "../src/controllers/cartController";
import { Cart } from "../src/models/Cart";
import { Product } from "../src/models/Product";
import { findStrictProductByIdentifier } from "../src/services/productLookup";

type ResponseState = {
  statusCode: number;
  payload: any;
};

const createResponse = () => {
  const state: ResponseState = { statusCode: 200, payload: null };
  const res: any = {
    status(code: number) {
      state.statusCode = code;
      return res;
    },
    json(payload: any) {
      state.payload = payload;
      return res;
    }
  };
  return { res, state };
};

test("findStrictProductByIdentifier unknown slug uchun fallback product qaytarmaydi", async () => {
  const originalFindOne = (Product as any).findOne;

  try {
    const calls: any[] = [];
    (Product as any).findOne = async (filter: any) => {
      calls.push(filter);
      if (filter?.status === "ACTIVE") {
        return { _id: new mongoose.Types.ObjectId(), title: "Fallback product" };
      }
      return null;
    };

    const product = await findStrictProductByIdentifier("unknown-product-slug");

    assert.equal(product, null);
    assert.equal(calls.some((filter) => filter?.status === "ACTIVE"), false);
  } finally {
    (Product as any).findOne = originalFindOne;
  }
});

test("getCart real product snapshotlarini qaytaradi va cartni sync qiladi", async () => {
  const originalCartFindOne = (Cart as any).findOne;
  const originalProductFind = (Product as any).find;

  try {
    const productId = new mongoose.Types.ObjectId("65f000000000000000000333");
    let saveCalled = false;

    const fakeCart: any = {
      items: [
        {
          productId,
          qty: 2,
          priceSnapshot: 0,
          titleSnapshot: "Product",
          imageSnapshot: "https://cdn.example.com/old.png"
        }
      ],
      async save() {
        saveCalled = true;
      }
    };

    (Cart as any).findOne = async () => fakeCart;
    (Product as any).find = () => ({
      populate() {
        return {
          async lean() {
            return [
              {
                _id: productId,
                title: "Actual listing title",
                price: 150,
                salePrice: 120,
                currency: "USD",
                category: "electronics",
                coverImageUrl: "https://cdn.example.com/actual.png",
                images: ["https://cdn.example.com/actual.png"],
                status: "ACTIVE",
                createdAt: new Date("2026-01-01T00:00:00.000Z"),
                updatedAt: new Date("2026-01-02T00:00:00.000Z")
              }
            ];
          }
        };
      }
    });

    const { res, state } = createResponse();
    await getCart({ user: { _id: "65f000000000000000000111" } } as any, res);

    assert.equal(state.statusCode, 200);
    assert.equal(saveCalled, true);
    assert.equal(state.payload?.subtotal, 240);
    assert.equal(state.payload?.items?.length, 1);
    assert.equal(state.payload.items[0].titleSnapshot, "Actual listing title");
    assert.equal(state.payload.items[0].imageSnapshot, "https://cdn.example.com/actual.png");
    assert.equal(state.payload.items[0].priceSnapshot, 120);
    assert.equal(state.payload.items[0].lineTotal, 240);
    assert.equal(state.payload.items[0].product?.title, "Actual listing title");
    assert.equal(state.payload.items[0].product?.cardImageUrl, "https://cdn.example.com/actual.png");
  } finally {
    (Cart as any).findOne = originalCartFindOne;
    (Product as any).find = originalProductFind;
  }
});
