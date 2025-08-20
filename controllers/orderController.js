// controllers/orderController.js
import { Order } from "../models/Order.js";
import { validationResult } from "express-validator";
import { logger } from "../utils/logger.js";
// import { createAddress } from "../utils/addressHelper.js";
import { createAddress } from "../utils/addressHelper.js"

// Build filter from query params
const buildFilter = (query) => {
  const filter = {};

  if (query.user) filter.user = query.user;
  if (query.status) filter.orderStatus = query.status;
  if (query.paymentStatus) filter["payment.status"] = query.paymentStatus;
  if (query.store) filter["items.store"] = query.store;
  if (query.dateFrom || query.dateTo) {
    filter.createdAt = {};
    if (query.dateFrom) filter.createdAt.$gte = new Date(query.dateFrom);
    if (query.dateTo) filter.createdAt.$lte = new Date(query.dateTo);
  }

  return filter;
};

// GET /api/orders
export const listOrders = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const filter = buildFilter(req.query);

    let sort = { createdAt: -1 };
    if (req.query.sortBy) {
      const dir = req.query.order === "asc" ? 1 : -1;
      const allowed = ["createdAt", "finalAmount", "orderStatus"];
      if (allowed.includes(req.query.sortBy)) {
        sort = { [req.query.sortBy]: dir };
      }
    }

    const [total, orders] = await Promise.all([
      Order.countDocuments(filter),
      Order.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate("user", "name email")
        .populate("items.product", "name price sku")
        .populate("shippingAddress")
        .populate("billingAddress")
        .lean()
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      meta: { total, page, limit, totalPages },
      data: orders
    });
  } catch (err) {
    logger.error("Error in listOrders:", { message: err.message, stack: err.stack });
    next(err);
  }
};

// GET /api/orders/:id
export const getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("user", "name email")
      .populate("items.product", "name price sku")
      .populate("shippingAddress")
      .populate("billingAddress")
      .lean();

    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    res.json({ success: true, data: order });
  } catch (err) {
    logger.error("Error in getOrderById:", { orderId: req.params.id, message: err.message, stack: err.stack });
    next(err);
  }
};

// POST /api/orders
export const createOrder = async (req, res, next) => {
  try {
    // validations should be in route
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn("Validation errors in createOrder", { errors: errors.array() });
      return res.status(400).json({ success: false, errors: errors.array() });
    }


    // attach authenticated user if available
    if (!req.body.user && req.user) {
      req.body.user = req.user.id;
    }
    const { shippingAddress, billingAddress } = req.body;
    let savedAddresses;
    try {

      const addresses = [shippingAddress, billingAddress];


      savedAddresses = await Promise.all(
        addresses.map(addr =>
          addr ? createAddress({ ...addr, user: req.user.id }) : null

        )
      );

      if (!savedAddresses || savedAddresses.includes(null)) {
        return res.status(400).json({
          success: false,
          message: "Some addresses could not be saved",
        });
      }
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Address saving problem",
        error: error.message
      });
    }
    console.log(savedAddresses)
    const {
      totalAmount,
      discountAmount = 0,
      taxAmount = 0,
      shippingAmount = 0,
      finalAmount,
    } = req.body;

    const computedFinal = totalAmount - discountAmount + taxAmount + shippingAmount;
    if (Math.abs(computedFinal - finalAmount) > 0.01) {
      return res.status(400).json({
        success: false,
        message: "Final amount mismatch",
        detail: { computedFinal, provided: finalAmount }
      });
    }

    const order = await Order.create({ ...req.body, shippingAddress: savedAddresses[0].data.id, billingAddress: savedAddresses[0].data.id });
    res.status(201).json({ success: true, data: order });
  } catch (err) {
    logger.error("Error in createOrder:", { body: req.body, message: err.message, stack: err.stack });
    next(err);
  }
};

// PATCH /api/orders/:id/status
export const updateOrderStatus = async (req, res, next) => {
  try {
    const { status, notes } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: "Status is required" });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    order.orderStatus = status;

    // customize history note
    if (notes) {
      const last = order.statusHistory[order.statusHistory.length - 1];
      if (last && last.status === status) {
        last.notes = notes;
      } else {
        order.statusHistory.push({
          status,
          changedBy: req.user?.id,
          notes
        });
      }
    }

    await order.save();
    res.json({ success: true, data: order });
  } catch (err) {
    logger.error("Error in updateOrderStatus:", { orderId: req.params.id, message: err.message, stack: err.stack });
    next(err);
  }
};

// POST /api/orders/:id/cancel
export const cancelOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    if (!order.canCancel()) {
      return res.status(400).json({ success: false, message: "Order cannot be cancelled in current status" });
    }

    order.orderStatus = "cancelled";
    order.cancellationReason = req.body.reason || "Cancelled by user";
    order.statusHistory.push({
      status: "cancelled",
      changedBy: req.user?.id,
      notes: order.cancellationReason
    });

    await order.save();
    res.json({ success: true, data: order });
  } catch (err) {
    logger.error("Error in cancelOrder:", { orderId: req.params.id, message: err.message, stack: err.stack });
    next(err);
  }
};

// POST /api/orders/:id/return
export const returnOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    if (!order.canReturn()) {
      return res.status(400).json({ success: false, message: "Order is not returnable" });
    }

    order.orderStatus = "returned";
    order.returnReason = req.body.reason || "Returned by user";
    order.statusHistory.push({
      status: "returned",
      changedBy: req.user?.id,
      notes: order.returnReason
    });

    await order.save();
    res.json({ success: true, data: order });
  } catch (err) {
    logger.error("Error in returnOrder:", { orderId: req.params.id, message: err.message, stack: err.stack });
    next(err);
  }
};

// PATCH /api/orders/:id/payment
export const updatePayment = async (req, res, next) => {
  try {
    const { payment } = req.body;
    if (!payment) {
      return res.status(400).json({ success: false, message: "Payment payload required" });
    }
    

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    // merge existing with new
    order.payment = {
      ...((order.payment && order.payment.toObject) ? order.payment.toObject() : order.payment),
      ...payment
    };

    if (payment.status === "completed" && order.orderStatus === "pending") {
      order.orderStatus = "confirmed";
    }

    await order.save();
    res.json({ success: true, data: order });
  } catch (err) {
    logger.error("Error in updatePayment:", { orderId: req.params.id, message: err.message, stack: err.stack });
    next(err);
  }
};

// GET /api/users/:userId/orders or /api/orders/user (if using auth)
export const getUserOrders = async (req, res, next) => {
  try {
    const userId = req.params.userId || req.user?.id;
    if (!userId) return res.status(400).json({ success: false, message: "User ID required" });

    const status = req.query.status;
    const orders = await Order.findByUser(userId, status)
      .populate("items.product", "name price sku")
      .lean();

    res.json({ success: true, data: orders });
  } catch (err) {
    logger.error("Error in getUserOrders:", { userId: req.params.userId || req.user?.id, message: err.message, stack: err.stack });
    next(err);
  }
};

// GET /api/orders/summary
export const getSummary = async (req, res, next) => {
  try {
    const [statusAggregation, revenueAggregation] = await Promise.all([
      Order.aggregate([
        { $group: { _id: "$orderStatus", count: { $sum: 1 } } }
      ]),
      Order.aggregate([
        { $match: { orderStatus: { $in: ["delivered", "shipped"] } } },
        { $group: { _id: null, totalRevenue: { $sum: "$finalAmount" } } }
      ])
    ]);

    const statusCounts = statusAggregation.reduce((acc, cur) => {
      acc[cur._id] = cur.count;
      return acc;
    }, {});

    const totalRevenue = revenueAggregation[0]?.totalRevenue || 0;

    res.json({
      success: true,
      data: {
        statusCounts,
        totalRevenue
      }
    });
  } catch (err) {
    logger.error("Error in getSummary:", { message: err.message, stack: err.stack });
    next(err);
  }
};
