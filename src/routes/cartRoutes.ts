import { Router } from "express";
import { authRequired } from "../middlewares/auth";
import { addCartItem, clearCart, getCart, removeCartItem, updateCartItemQty } from "../controllers/cartController";

const router = Router();

router.use(authRequired);

router.get("/", getCart);
router.post("/items", addCartItem);
router.patch("/items/:productId", updateCartItemQty);
router.delete("/items/:productId", removeCartItem);
router.post("/clear", clearCart);

export default router;
