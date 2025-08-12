import express from "express";
import {
  listParentCategories,
  getActiveParentCategories,
  getParentCategoryById,
  getParentCategoryBySlug,
  createParentCategory,
  updateParentCategory,
  deleteParentCategory
} from "../controllers/parentCategoryController.js";
// import { protect } from "../middlewares/auth.js"; // optional
import { body, param, query } from "express-validator";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Public
router.get("/", listParentCategories);
router.get("/active", getActiveParentCategories);
router.get("/slug/:slug", getParentCategoryBySlug);
router.get("/:id", getParentCategoryById);

// Protected (require auth)
router.post(
  "/",
  protect,
  [
    body("name").isString().isLength({ min: 3, max: 50 }),
    body("createdBy").optional().isMongoId()
  ],
  createParentCategory
);

router.put(
  "/:id",
  protect,
  [
    param("id").isMongoId(),
    body("name").optional().isString().isLength({ min: 3, max: 50 }),
    body("isActive").optional().isBoolean()
  ],
  updateParentCategory
);

router.delete("/:id", protect, deleteParentCategory);

export const parentCategory= router;
