import express from "express";
import {
  listCategories,
  getActive,
  getTree,
  getCategoryById,
  getBySlug,
  createCategory,
  updateCategory,
  deleteCategory,
  getAncestors
} from "../controllers/categoryController.js";
// import { protect } from "../middlewares/auth.js"; // optional
import { body, param, query } from "express-validator";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Public
router.get("/", listCategories);
router.get("/active", getActive);
router.get("/tree", getTree);
router.get("/slug/:slug", getBySlug);
router.get("/:id/ancestors", getAncestors);
router.get("/:id", getCategoryById);

// Protected
router.post(
  "/",
  protect,
  [
    body("name").isString().isLength({ min: 3, max: 50 }),
    body("createdBy").optional().isMongoId()
  ],
  createCategory
);
router.put(
  "/:id",
  protect,
  [
    param("id").isMongoId(),
    body("name").optional().isString().isLength({ min: 3, max: 50 }),
    body("isActive").optional().isBoolean()
  ],
  updateCategory
);
router.delete("/:id", protect, deleteCategory);

export const categoryRoute= router;
