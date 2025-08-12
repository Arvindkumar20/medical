// models/MedicalUpload.js
// const mongoose = require("mongoose");
// const validator = require("validator");

import mongoose from "mongoose";
import validator from "validator";

const medicalUploadSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: [true, "User reference is required"],
    validate: {
      validator: async function(v) {
        const user = await mongoose.model("User").findById(v);
        return !!user;
      },
      message: "User must be a valid registered user"
    }
  },
  fileType: {
    type: String,
    enum: {
      values: ["prescription", "xray", "lab_report", "mri_scan", "ultrasound", "doctor_note", "insurance"],
      message: "Invalid file type. Must be prescription/xray/lab_report/mri_scan/ultrasound/doctor_note/insurance"
    },
    required: [true, "File type is required"]
  },
  fileUrl: {
    type: String,
    required: [true, "File URL is required"],
    validate: {
      validator: function(v) {
        return validator.isURL(v, {
          protocols: ["http", "https"],
          require_protocol: true,
          allow_underscores: true
        });
      },
      message: "Invalid file URL"
    }
  },
  fileName: {
    type: String,
    required: [true, "File name is required"],
    maxlength: [200, "File name cannot exceed 200 characters"]
  },
  fileSize: {
    type: Number,
    required: true,
    min: [1, "File size must be at least 1 byte"],
    max: [20 * 1024 * 1024, "File size cannot exceed 20MB"] // 20MB limit
  },
  fileFormat: {
    type: String,
    required: true,
    enum: {
      values: ["pdf", "jpg", "jpeg", "png", "dicom", "tiff"],
      message: "Invalid file format. Supported: pdf/jpg/jpeg/png/dicom/tiff"
    }
  },
  notes: {
    type: String,
    maxlength: [1000, "Notes cannot exceed 1000 characters"],
    trim: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
    immutable: true
  },
  verified: {
    type: Boolean,
    default: false
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    validate: {
      validator: async function(v) {
        if (!v) return true; // Optional field
        const user = await mongoose.model("User").findById(v);
        return user && (user.role === "doctor" || user.role === "admin");
      },
      message: "Verifier must be a doctor or admin"
    }
  },
  verificationDate: Date,
  expirationDate: {
    type: Date,
    validate: {
      validator: function(v) {
        return !v || v > new Date();
      },
      message: "Expiration date must be in the future"
    }
  },
  tags: [{
    type: String,
    lowercase: true,
    maxlength: [30, "Tag cannot exceed 30 characters"]
  }],
  metadata: {
    doctorName: {
      type: String,
      maxlength: [100, "Doctor name cannot exceed 100 characters"]
    },
    issueDate: Date,
    hospital: {
      type: String,
      maxlength: [100, "Hospital name cannot exceed 100 characters"]
    }
  },
  accessControl: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    permission: {
      type: String,
      enum: ["view", "download"],
      default: "view"
    }
  }],
  status: {
    type: String,
    enum: ["active", "archived", "expired", "rejected"],
    default: "active"
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
medicalUploadSchema.index({ user: 1 });
medicalUploadSchema.index({ fileType: 1 });
medicalUploadSchema.index({ uploadedAt: -1 });
medicalUploadSchema.index({ status: 1 });
medicalUploadSchema.index({ verified: 1 });
medicalUploadSchema.index({ "metadata.doctorName": "text" });

// Pre-save hook to validate expiration date
medicalUploadSchema.pre("save", function(next) {
  if (this.expirationDate && this.expirationDate < new Date()) {
    this.status = "expired";
  }
  next();
});

// Virtual for file status
medicalUploadSchema.virtual("fileStatus").get(function() {
  if (this.status === "expired") return "Expired";
  if (!this.verified) return "Pending Verification";
  return "Verified";
});

// Virtual for download URL (could add security token)
medicalUploadSchema.virtual("secureDownloadUrl").get(function() {
  return `${this.fileUrl}?token=${this._id}`;
});

// Static method to get user's medical uploads
medicalUploadSchema.statics.findByUser = function(userId, fileType) {
  const query = { user: userId };
  if (fileType) query.fileType = fileType;
  return this.find(query).sort({ uploadedAt: -1 });
};

// Static method to verify a medical upload
medicalUploadSchema.statics.verifyUpload = async function(uploadId, verifierId) {
  return this.findByIdAndUpdate(uploadId, {
    verified: true,
    verifiedBy: verifierId,
    verificationDate: new Date(),
    status: "active"
  }, { new: true });
};

// Instance method to check if file is viewable
medicalUploadSchema.methods.canView = function(userId) {
  return this.user.equals(userId) || 
         this.accessControl.some(ac => ac.user.equals(userId));
};

// Instance method to check if file is downloadable
medicalUploadSchema.methods.canDownload = function(userId) {
  return this.user.equals(userId) || 
         this.accessControl.some(ac => 
           ac.user.equals(userId) && ac.permission === "download");
};

export const MedicalUpload = mongoose.model("MedicalUpload", medicalUploadSchema);