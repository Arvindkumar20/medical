import {ParentCategory} from "../models/ParentCategory.js";
import { validationResult } from "express-validator";
import {logger} from "../utils/logger.js";

// List with pagination, filtering, sorting
export const listParentCategories = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.search) {
      filter.$text = { $search: req.query.search };
    }
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === "true";
    }

    let sort = { displayOrder: 1, name: 1 };
    if (req.query.sortBy) {
      const dir = req.query.order === "desc" ? -1 : 1;
      const allowed = ["name", "displayOrder", "createdAt"];
      if (allowed.includes(req.query.sortBy)) {
        sort = { [req.query.sortBy]: dir };
      }
    }

    const [total, categories] = await Promise.all([
      ParentCategory.countDocuments(filter),
      ParentCategory.find(filter).sort(sort).skip(skip).limit(limit).lean()
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      meta: { total, page, limit, totalPages },
      data: categories
    });
  } catch (err) {
    logger.error("Error in listParentCategories:", { message: err.message, stack: err.stack });
    next(err);
  }
};

// Get active ones (shortcut)
export const getActiveParentCategories = async (req, res, next) => {
  try {
    const categories = await ParentCategory.getActive();
    res.json({ success: true, data: categories });
  } catch (err) {
    logger.error("Error in getActiveParentCategories:", { message: err.message, stack: err.stack });
    next(err);
  }
};

// Get by ID
export const getParentCategoryById = async (req, res, next) => {
  try {
    const cat = await ParentCategory.findById(req.params.id).lean();
    if (!cat) return res.status(404).json({ success: false, message: "Parent category not found" });
    res.json({ success: true, data: cat });
  } catch (err) {
    logger.error("Error in getParentCategoryById:", { id: req.params.id, message: err.message, stack: err.stack });
    next(err);
  }
};

// Get by slug
export const getParentCategoryBySlug = async (req, res, next) => {
  try {
    const cat = await ParentCategory.findOne({ slug: req.params.slug }).lean();
    if (!cat) return res.status(404).json({ success: false, message: "Parent category not found" });
    res.json({ success: true, data: cat });
  } catch (err) {
    logger.error("Error in getParentCategoryBySlug:", { slug: req.params.slug, message: err.message, stack: err.stack });
    next(err);
  }
};

// Create
export const createParentCategory = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn("Validation errors in createParentCategory", { errors: errors.array() });
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const exists = await ParentCategory.findOne({ name: req.body.name });
    if (exists) {
      return res.status(409).json({ success: false, message: "Parent category with this name already exists" });
    }

    req.body.createdBy = req.user?.id;
    const category = await ParentCategory.create(req.body);
    res.status(201).json({ success: true, data: category });
  } catch (err) {
    logger.error("Error in createParentCategory:", { body: req.body, message: err.message, stack: err.stack });
    next(err);
  }
};

// Update
export const updateParentCategory = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn("Validation errors in updateParentCategory", { errors: errors.array() });
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    req.body.lastUpdatedBy = req.user?.id;
    const updated = await ParentCategory.findOneAndUpdate(
      { _id: req.params.id },
      req.body,
      { new: true, runValidators: true, context: "query" }
    );
    if (!updated) return res.status(404).json({ success: false, message: "Parent category not found" });
    res.json({ success: true, data: updated });
  } catch (err) {
    logger.error("Error in updateParentCategory:", { id: req.params.id, message: err.message, stack: err.stack });
    next(err);
  }
};

// Delete
export const deleteParentCategory = async (req, res, next) => {
  try {
    const category = await ParentCategory.findById(req.params.id);
    if (!category) return res.status(404).json({ success: false, message: "Parent category not found" });

    await category.remove();
    res.json({ success: true, message: "Parent category deleted" });
  } catch (err) {
    logger.error("Error in deleteParentCategory:", { id: req.params.id, message: err.message, stack: err.stack });
    next(err);
  }
};
