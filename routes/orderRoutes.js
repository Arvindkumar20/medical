// routes/orderRoutes.js
import express from "express";
import {
  listOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  cancelOrder,
  returnOrder,
  updatePayment,
  getUserOrders,
  getSummary
} from "../controllers/orderController.js";
import { body, param, query } from "express-validator";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Admin / listing with filters
router.get(
  "/",
  protect, // require auth if desired
  [
    query("status").optional().isString(),
    query("paymentStatus").optional().isString(),
    query("user").optional().isMongoId(),
    query("store").optional().isMongoId(),
    query("dateFrom").optional().isISO8601(),
    query("dateTo").optional().isISO8601()
  ],
  listOrders
);

// Summary stats (admin)
router.get("/summary", protect, getSummary);

// Get single
router.get("/:id", protect, getOrderById);

// Create order
router.post(
  "/",
  protect,
  [
    body("user").optional().isMongoId(),
    body("items").isArray({ min: 1 }),
    body("totalAmount").isFloat({ min: 0.01 }),
    body("finalAmount").isFloat({ min: 0.01 }),
    body("payment").notEmpty(),
    body("payment.method").isIn(["credit_card", "debit_card", "net_banking", "wallet", "cod", "upi"]),
    body("payment.amount").isFloat({ min: 0.01 })
  ],
  createOrder
);

// Update status
router.patch(
  "/:id/confirm",
  protect,
  [
    param("id").isMongoId(),
    body("status").isString(),
    body("notes").optional().isString()
  ],
  updateOrderStatus
);

// Cancel
router.post(
  "/:id/cancel",
  protect,
  [param("id").isMongoId(), body("reason").optional().isString()],
  cancelOrder
);

// Return
router.post(
  "/:id/return",
  protect,
  [param("id").isMongoId(), body("reason").optional().isString()],
  returnOrder
);

// Update payment
router.patch(
  "/:id/payment",
  protect,
  [param("id").isMongoId(), body("payment").notEmpty()],
  updatePayment
);

// Get orders of a user (either path or from auth)
router.get(
  "/user/:userId",
  protect,
  [param("userId").isMongoId()],
  getUserOrders
);

// Alternative current user
router.get("/me", protect, getUserOrders);

export const orderRouter= router;
