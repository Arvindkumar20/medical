// routes/medicalUploadRoutes.js
import express from "express";
import {
  createUpload,
  listUploads,
  getUploadById,
  verifyUpload,
  updateUpload,
  deleteUpload
} from "../controllers/medicalUploadController.js";
// import { protect } from "../middlewares/auth.js"; // your auth middleware
import multer from "multer";
import { body, param, query } from "express-validator";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB
});

// Create upload (file required)
router.post(
  "/",
  protect,
  upload.single("file"),
  [
    body("fileType").isIn(["prescription", "xray", "lab_report", "mri_scan", "ultrasound", "doctor_note", "insurance"]),
    body("fileName").optional().isString().isLength({ max: 200 }),
    body("expirationDate").optional().isISO8601(),
    body("accessControl").optional().isArray()
  ],
  createUpload
);

// List (self or admin)
router.get(
  "/",
  protect,
  [
    query("fileType").optional().isString(),
    query("user").optional().isMongoId(),
    query("status").optional().isString(),
    query("verified").optional().isBoolean()
  ],
  listUploads
);

// Single
router.get("/:id", protect, getUploadById);

// Verify (doctor/admin)
router.patch("/:id/verify", protect, verifyUpload);

// Update metadata/accessControl/status
router.patch("/:id", protect, updateUpload);

// Delete
router.delete("/:id", protect, deleteUpload);

export const medicalUploadRouter= router;
