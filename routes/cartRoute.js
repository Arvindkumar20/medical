import express from "express";
import {
    getCart,
    addItemToCart,
    updateCartItem,
    removeItemFromCart,
    clearCart,
    applyCoupon,
    removeCoupon,
    getCartSummary,
    mergeCarts
} from "../controllers/cartController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

// All routes are protected (require authentication)
router.use(protect);

router.route("/")
    .get(getCart)
    .delete(clearCart);

router.route("/summary")
    .get(getCartSummary);

router.route("/items")
    .post(addItemToCart);

router.route("/items/:productId")
    .put(updateCartItem)
    .delete(removeItemFromCart);

router.route("/coupon")
    .post(applyCoupon)
    .delete(removeCoupon);

router.route("/merge")
    .post(mergeCarts);

export const cartRouter = router;