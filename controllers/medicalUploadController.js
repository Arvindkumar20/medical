// controllers/medicalUploadController.js
import { MedicalUpload } from "../models/MedicalUpload.js";
import { validationResult } from "express-validator";
import {logger} from "../utils/logger.js";
import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";

// configure cloudinary from env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

const uploadToCloudinary = (buffer, filename, folder) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folder || process.env.CLOUDINARY_UPLOAD_FOLDER || "medical_uploads",
        resource_type: "auto",
        public_id: `${Date.now()}_${filename.replace(/\s+/g, "_")}`,
        overwrite: false
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

// POST /api/medical-uploads  (multipart/form-data, file field "file")
export const createUpload = async (req, res, next) => {
  try {
    // expecting req.file from multer
    if (!req.file) {
      return res.status(400).json({ success: false, message: "File is required" });
    }

    // validate fields using express-validator if applied
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn("Validation error in createUpload", { errors: errors.array() });
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const {
      fileType,
      notes,
      expirationDate,
      tags = [],
      metadata = {},
      accessControl = []
    } = req.body;

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    // Upload file buffer to Cloudinary
    const cloudResult = await uploadToCloudinary(req.file.buffer, req.file.originalname, process.env.CLOUDINARY_UPLOAD_FOLDER);

    // Build document
    const uploadDoc = {
      user: userId,
      fileType,
      fileUrl: cloudResult.secure_url,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      fileFormat: req.file.mimetype.split("/").pop(), // e.g., pdf, png
      notes: notes || "",
      expirationDate: expirationDate ? new Date(expirationDate) : undefined,
      tags: Array.isArray(tags) ? tags : String(tags).split(",").map(t => t.trim()).filter(Boolean),
      metadata: typeof metadata === "object" ? metadata : {},
      accessControl: Array.isArray(accessControl) ? accessControl : [],
      status: "active"
    };

    // If verification fields present but user is not allowed, ignore
    const created = await MedicalUpload.create(uploadDoc);
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    logger.error("Error in createUpload:", { message: err.message, stack: err.stack, body: req.body });
    next(err);
  }
};

// GET /api/medical-uploads  (list for current user or admin with filters)
export const listUploads = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const fileType = req.query.fileType;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const filter = {};

    if (req.query.user && req.user?.role === "admin") {
      filter.user = req.query.user;
    } else if (userId) {
      filter.user = userId;
    } else {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    if (fileType) filter.fileType = fileType;
    if (req.query.status) filter.status = req.query.status === "true" ? "active" : req.query.status;
    if (req.query.verified !== undefined) filter.verified = req.query.verified === "true";

    const [total, uploads] = await Promise.all([
      MedicalUpload.countDocuments(filter),
      MedicalUpload.find(filter)
        .sort({ uploadedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
    ]);

    const totalPages = Math.ceil(total / limit);
    res.json({
      success: true,
      meta: { total, page, limit, totalPages },
      data: uploads
    });
  } catch (err) {
    logger.error("Error in listUploads:", { message: err.message, stack: err.stack });
    next(err);
  }
};

// GET /api/medical-uploads/:id
export const getUploadById = async (req, res, next) => {
  try {
    const upload = await MedicalUpload.findById(req.params.id).lean();
    if (!upload) return res.status(404).json({ success: false, message: "Upload not found" });

    const userId = req.user?.id;
    const canView = upload.user.toString() === userId || (upload.accessControl || []).some(ac => ac.user.toString() === userId);
    if (!canView && req.user?.role !== "admin") {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    res.json({ success: true, data: upload });
  } catch (err) {
    logger.error("Error in getUploadById:", { id: req.params.id, message: err.message, stack: err.stack });
    next(err);
  }
};

// PATCH /api/medical-uploads/:id/verify
export const verifyUpload = async (req, res, next) => {
  try {
    // only doctor or admin
    if (!["doctor", "admin"].includes(req.user?.role)) {
      return res.status(403).json({ success: false, message: "Not authorized to verify" });
    }

    const upload = await MedicalUpload.verifyUpload(req.params.id, req.user.id);
    if (!upload) return res.status(404).json({ success: false, message: "Upload not found" });

    res.json({ success: true, data: upload });
  } catch (err) {
    logger.error("Error in verifyUpload:", { id: req.params.id, message: err.message, stack: err.stack });
    next(err);
  }
};

// PATCH /api/medical-uploads/:id (update metadata / accessControl / status)
export const updateUpload = async (req, res, next) => {
  try {
    const upload = await MedicalUpload.findById(req.params.id);
    if (!upload) return res.status(404).json({ success: false, message: "Upload not found" });

    // owner or admin
    if (upload.user.toString() !== req.user?.id && req.user?.role !== "admin") {
      return res.status(403).json({ success: false, message: "Not allowed to update" });
    }

    const allowed = ["notes", "expirationDate", "tags", "metadata", "accessControl", "status"];
    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        upload[field] = req.body[field];
      }
    }

    if (req.body.verified !== undefined) {
      if (["doctor", "admin"].includes(req.user?.role)) {
        upload.verified = !!req.body.verified;
        if (upload.verified) {
          upload.verifiedBy = req.user.id;
          upload.verificationDate = new Date();
          upload.status = "active";
        }
      }
    }

    await upload.save();
    res.json({ success: true, data: upload });
  } catch (err) {
    logger.error("Error in updateUpload:", { id: req.params.id, message: err.message, stack: err.stack });
    next(err);
  }
};

// DELETE /api/medical-uploads/:id
export const deleteUpload = async (req, res, next) => {
  try {
    const upload = await MedicalUpload.findById(req.params.id);
    if (!upload) return res.status(404).json({ success: false, message: "Upload not found" });

    // owner or admin
    if (upload.user.toString() !== req.user?.id && req.user?.role !== "admin") {
      return res.status(403).json({ success: false, message: "Not allowed to delete" });
    }

    // extract public_id from URL if possible
    const publicIdMatch = upload.fileUrl.match(/\/([^/]+)\.[a-zA-Z0-9]+$/);
    // Note: better to store cloudinary public_id separately in model for reliable deletion
    if (publicIdMatch) {
      const publicId = publicIdMatch[1];
      try {
        await cloudinary.uploader.destroy(publicId, { resource_type: "auto" });
      } catch (e) {
        logger.warn("Failed to delete from Cloudinary", { error: e });
      }
    }

    await upload.deleteOne();
    res.json({ success: true, message: "Upload deleted" });
  } catch (err) {
    logger.error("Error in deleteUpload:", { id: req.params.id, message: err.message, stack: err.stack });
    next(err);
  }
};
