import {Category} from "../models/Category.js";
import { validationResult } from "express-validator";
import {logger} from "../utils/logger.js"; // ensure this exports default

// List with pagination, search, filters
export const listCategories = async (req, res, next) => {
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
    if (req.query.parentCategory) {
      filter.parentCategory = req.query.parentCategory;
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
      Category.countDocuments(filter),
      Category.find(filter).sort(sort).skip(skip).limit(limit).lean()
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      meta: { total, page, limit, totalPages },
      data: categories
    });
  } catch (err) {
    logger.error("Error in listCategories:", { message: err.message, stack: err.stack });
    next(err);
  }
};

export const getActive = async (req, res, next) => {
  try {
    const categories = await Category.getActiveCategories();
    res.json({ success: true, data: categories });
  } catch (err) {
    logger.error("Error in getActive:", { message: err.message, stack: err.stack });
    next(err);
  }
};

export const getTree = async (req, res, next) => {
  try {
    const tree = await Category.getCategoryTree();
    res.json({ success: true, data: tree });
  } catch (err) {
    logger.error("Error in getTree:", { message: err.message, stack: err.stack });
    next(err);
  }
};

export const getCategoryById = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id).populate("children").lean();
    if (!category) return res.status(404).json({ success: false, message: "Category not found" });
    res.json({ success: true, data: category });
  } catch (err) {
    logger.error("Error in getCategoryById:", { categoryId: req.params.id, message: err.message, stack: err.stack });
    next(err);
  }
};

export const getBySlug = async (req, res, next) => {
  try {
    const category = await Category.findOne({ slug: req.params.slug }).lean();
    if (!category) return res.status(404).json({ success: false, message: "Category not found" });
    res.json({ success: true, data: category });
  } catch (err) {
    logger.error("Error in getBySlug:", { slug: req.params.slug, message: err.message, stack: err.stack });
    next(err);
  }
};

export const createCategory = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn("Validation errors in createCategory", { errors: errors.array() });
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const exists = await Category.findOne({ name: req.body.name });
    if (exists) {
      return res.status(409).json({ success: false, message: "Category with this name already exists" });
    }

    req.body.createdBy = req.user?.id;
    const category = await Category.create(req.body);
    res.status(201).json({ success: true, data: category });
  } catch (err) {
    logger.error("Error in createCategory:", { body: req.body, message: err.message, stack: err.stack });
    next(err);
  }
};

export const updateCategory = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn("Validation errors in updateCategory", { errors: errors.array() });
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    req.body.lastUpdatedBy = req.user?.id;
    const updated = await Category.findOneAndUpdate(
      { _id: req.params.id },
      req.body,
      { new: true, runValidators: true, context: "query" }
    );

    if (!updated) return res.status(404).json({ success: false, message: "Category not found" });

    res.json({ success: true, data: updated });
  } catch (err) {
    logger.error("Error in updateCategory:", { categoryId: req.params.id, message: err.message, stack: err.stack });
    next(err);
  }
};

export const deleteCategory = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ success: false, message: "Category not found" });

    await category.remove();
    res.json({ success: true, message: "Category deleted" });
  } catch (err) {
    logger.error("Error in deleteCategory:", { categoryId: req.params.id, message: err.message, stack: err.stack });
    next(err);
  }
};

export const getAncestors = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ success: false, message: "Category not found" });

    const ancestors = await category.getAncestors();
    res.json({ success: true, data: ancestors });
  } catch (err) {
    logger.error("Error in getAncestors:", { categoryId: req.params.id, message: err.message, stack: err.stack });
    next(err);
  }
};
