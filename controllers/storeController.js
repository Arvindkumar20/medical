import { validationResult } from "express-validator";
import { Store } from "../models/Store.js";
import { logger } from "../utils/logger.js";
import { getUser } from "../routes/userService.js";
import { User } from "../models/User.js";

// Helper to parse list query options
const parseQuery = (query) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const filter = {};

  if (query.search) {
    filter.$text = { $search: query.search };
  }

  if (query.status) {
    filter.status = query.status;
  }

  if (query.approved !== undefined) {
    filter.approved = query.approved === "true";
  }

  if (query.categories) {
    const cats = String(query.categories)
      .split(",")
      .map((c) => c.trim().toLowerCase())
      .filter(Boolean);
    if (cats.length) filter.categories = { $in: cats };
  }

  // Sorting
  let sort = { createdAt: -1 };
  if (query.sortBy) {
    const direction = query.order === "asc" ? 1 : -1;
    const allowed = ["name", "rating.average", "createdAt", "status"];
    if (allowed.includes(query.sortBy)) {
      sort = { [query.sortBy]: direction };
    }
  }

  return { page, limit, skip, filter, sort };
};

// GET /api/store
export const listStores = async (req, res, next) => {
  try {
    const { page, limit, skip, filter, sort } = parseQuery(req.query);

    const [total, stores] = await Promise.all([
      Store.countDocuments(filter),
      Store.find(filter).sort(sort).skip(skip).limit(limit).lean()
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      meta: {
        total,
        page,
        limit,
        totalPages
      },
      data: stores
    });
  } catch (err) {
    logger.error("Error in listStores:", { message: err.message, stack: err.stack });
    next(err);
  }
};

// GET /api/store/:id
export const getStoreById = async (req, res, next) => {
  try {
    const store = await Store.findById(req.params.id).lean();
    if (!store) {
      return res.status(404).json({ success: false, message: "Store not found" });
    }
    res.json({ success: true, data: store });
  } catch (err) {
    logger.error("Error in getStoreById:", { storeId: req.params.id, message: err.message, stack: err.stack });
    next(err);
  }
};

// POST /api/store
export const createStore = async (req, res, next) => {
  try {
    // Ensure authenticated user
    const ownerId = req.user?.id;
    if (!ownerId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    // Get user with role information
    const user = await User.findById(ownerId).select('role');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Check authorization - only admin or doctor can create stores
    if (!['admin', 'doctor','store'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: "Only administrators and doctors can create stores"
      });
    }

    // Create a copy of body without owner field to avoid validation issues
    const bodyWithoutOwner = { ...req.body };
    delete bodyWithoutOwner.owner; // Remove owner field for validation

    // Validate request body (using modified body without owner)
    const errors = validationResult({ ...req, body: !bodyWithoutOwner });
    if (!errors.isEmpty()) {
      logger.warn("Validation errors in createStore", { errors: errors.array() });
      return res.status(400).json({
        success: false,
        errors: errors.array().map(err => ({
          field: err.path,
          message: err.msg
        }))
      });
    }

    // Prepare store data with authenticated owner
    const storeData = {
      ...req.body,
      owner: ownerId, // Set owner from authenticated user
      status: user.role === 'admin' ? 'approved' : 'pending'
    };

    // Create store
    const store = await Store.create(storeData);

    // Update user's store reference if needed
    if (user.role === 'store'||user.role === 'doctor') {
      await User.findByIdAndUpdate(ownerId, { store: store._id });
    }

    logger.info("Store created", {
      storeId: store._id,
      createdBy: ownerId,
      status: store.status
    });

    res.status(201).json({
      success: true,
      message: user.role === 'admin'
        ? "Store created successfully"
        : "Store submitted for approval",
      data: store
    });
  } catch (err) {
    logger.error("Error in createStore:", {
      message: err.message,
      stack: err.stack,
      body: req.body,
      user: req.user?.id
    });

    // Handle duplicate key errors
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue)[0];
      return res.status(409).json({
        success: false,
        message: "Store creation failed",
        errors: [{
          field,
          message: `${field} already exists`
        }],
      });
    }

    // Handle validation errors (should be caught above, but just in case)
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(error => ({
        field: error.path,
        message: error.message,
      }));

      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }

    next(err);
  }
};

// PUT /api/store/:id
export const updateStore = async (req, res, next) => {
  try {
    // Ensure authenticated user
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    // Get user with role information
    const user = await User.findById(userId).select('role');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Get the store to be updated
    const store = await Store.findById(req.params.id);
    if (!store) {
      return res.status(404).json({
        success: false,
        message: "Store not found"
      });
    }

    // Authorization check
    const isAdmin = user.role === 'admin';
    const isOwner = store.owner.equals(userId);

    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: "Only store owners or administrators can update stores"
      });
    }

    // Create sanitized copy of request body
    const sanitizedBody = { ...req.body };

    // Prevent changing owner even if provided
    delete sanitizedBody.owner;

    // Non-admins can't change status
    if (!isAdmin && sanitizedBody.status) {
      delete sanitizedBody.status;
    }

    // Validate request body
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Filter out errors related to removed fields
      const filteredErrors = errors.array().filter(error =>
        error.path !== 'owner' && error.path !== 'status'
      );

      if (filteredErrors.length > 0) {
        logger.warn("Validation errors in updateStore", { errors: filteredErrors });
        return res.status(400).json({
          success: false,
          errors: filteredErrors.map(err => ({
            field: err.path,
            message: err.msg
          }))
        });
      }
    }

    // Prepare update data
    const updateData = {
      ...sanitizedBody,
      // Only admins can update certain fields
      ...(isAdmin && {
        status: sanitizedBody.status || store.status
      }),
      updatedBy: userId
    };

    // Update store
    const updatedStore = await Store.findOneAndUpdate(
      { _id: req.params.id },
      updateData,
      {
        new: true,
        runValidators: true,
        context: "query"
      }
    );

    logger.info("Store updated", {
      storeId: req.params.id,
      updatedBy: userId,
      changes: Object.keys(updateData)
    });

    res.json({
      success: true,
      message: "Store updated successfully",
      data: updatedStore
    });
  } catch (err) {
    logger.error("Error in updateStore:", {
      storeId: req.params.id,
      message: err.message,
      stack: err.stack,
      user: req.user?.id
    });

    // Handle duplicate key errors
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue)[0];
      return res.status(409).json({
        success: false,
        message: "Store update failed",
        errors: [{
          field,
          message: `${field} already exists`
        }],
      });
    }

    // Handle validation errors
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(error => ({
        field: error.path,
        message: error.message,
      }));

      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }

    next(err);
  }
};

// PATCH /api/store/:id/approve
export const setApproval = async (req, res, next) => {
  try {
    const { approved } = req.body;
    if (typeof approved !== "boolean") {
      return res.status(400).json({ success: false, message: "approved must be boolean" });
    }

    const store = await Store.findByIdAndUpdate(
      req.params.id,
      { approved },
      { new: true }
    );

    if (!store) return res.status(404).json({ success: false, message: "Store not found" });
    store.status = "active";
    await store.save()
    res.json({ success: true, data: store });
  } catch (err) {
    logger.error("Error in setApproval:", { storeId: req.params.id, message: err.message, stack: err.stack });
    next(err);
  }
};

// PATCH /api/store/:id/rating
export const updateRating = async (req, res, next) => {
  try {
    const { rating } = req.body;
    if (rating == null || typeof rating !== "object") {
      return res.status(400).json({ success: false, message: "Invalid rating payload" });
    }

    const store = await Store.findById(req.params.id);
    if (!store) return res.status(404).json({ success: false, message: "Store not found" });

    if (typeof rating.average === "number") store.rating.average = rating.average;
    if (typeof rating.count === "number") store.rating.count = rating.count;

    await store.save();
    res.json({ success: true, data: store });
  } catch (err) {
    logger.error("Error in updateRating:", { storeId: req.params.id, message: err.message, stack: err.stack });
    next(err);
  }
};

// GET /api/store/nearby?lng=...&lat=...&maxDistance=...
export const findNearby = async (req, res, next) => {
  try {
    const lng = parseFloat(req.query.lng);
    const lat = parseFloat(req.query.lat);
    if (isNaN(lng) || isNaN(lat)) {
      return res.status(400).json({ success: false, message: "Invalid coordinates" });
    }
    const maxDistance = parseInt(req.query.maxDistance || "5000", 10); // in meters

    const stores = await Store.findNearby([lng, lat], maxDistance).lean();

    res.json({ success: true, count: stores.length, data: stores });
  } catch (err) {
    logger.error("Error in findNearby:", { message: err.message, stack: err.stack });
    next(err);
  }
};

// DELETE /api/store/:id (soft suspend)
export const deleteStore = async (req, res, next) => {
  try {
    const updated = await Store.findOneAndUpdate(
      { _id: req.params.id },
      { status: "suspended" },
      { new: true }
    );
    if (!updated) return res.status(404).json({ success: false, message: "Store not found" });

    res.json({ success: true, message: "Store suspended", data: updated });
  } catch (err) {
    logger.error("Error in deleteStore:", { storeId: req.params.id, message: err.message, stack: err.stack });
    next(err);
  }
};
