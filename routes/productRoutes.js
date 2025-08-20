import express from "express";
import multer from "multer";
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  adjustStock,
  exportProducts
} from "../controllers/productController.js";
import { protect } from "../middlewares/authMiddleware.js"; // JWT protect middleware
import { rateLimiter } from "../middlewares/rateLimiter.js";

// Multer config (store files in memory for Cloudinary upload)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // max 5MB per file
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "image/webp"];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error("Only JPEG, PNG, and WEBP images are allowed"));
    }
    cb(null, true);
  }
});

const router = express.Router();

/**
 * @route   GET /api/products
 * @desc    Get all products with filters, pagination
 * @access  Public
 */
router.get("/", getProducts);

/**
 * @route   GET /api/products/export
 * @desc    Export products as JSON or CSV
 * @access  Admin Only
 */
router.get("/export", protect, rateLimiter(5, 60 * 60), exportProducts);

/**
 * @route   GET /api/products/:id
 * @desc    Get single product by ID
 * @access  Public
 */
router.get("/:id", getProductById);

/**
 * @route   POST /api/products
 * @desc    Create new product
 * @access  Admin / Store Owner
 */
router.post(
  "/",
  protect,
  upload.array("images", 10), // Accept up to 5 images
  createProduct
);

/**
 * @route   PUT /api/products/:id
 * @desc    Update product by ID
 * @access  Admin / Store Owner
 */
router.put(
  "/:id",
  protect,
  upload.array("images", 10), // Accept up to 5 images
  updateProduct
);

/**
 * @route   DELETE /api/products/:id
 * @desc    Soft delete product by ID
 * @access  Admin / Store Owner
 */
router.delete("/:id", protect, deleteProduct);

/**
 * @route   PATCH /api/products/:id/adjust-stock
 * @desc    Adjust product stock
 * @access  Admin / Store Owner
 */
router.patch("/:id/adjust-stock", protect, adjustStock);

export const productRouter = router;
