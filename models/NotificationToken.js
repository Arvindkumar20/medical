import mongoose from "mongoose";
import validator from "validator";

const notificationTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true
    },
    fcmToken: {
      type: String,
      required: [true, "FCM token is required"],
      trim: true,
      validate: {
        validator: function(v) {
          return v.length >= 8 && v.length <= 500;
        },
        message: "FCM token must be between 8 and 500 characters"
      }
    },
    deviceType: {
      type: String,
      required: [true, "Device type is required"],
      enum: {
        values: ["ios", "android", "web", "desktop"],
        message: "Device type must be ios, android, web, or desktop"
      },
      lowercase: true
    },
    deviceId: {
      type: String,

      trim: true,
      validate: {
        validator: function(v) {
          return v.length >= 5 && v.length <= 100;
        },
        message: "Device ID must be between 5 and 100 characters"
      }
    },
    deviceModel: {
      type: String,
      trim: true,
      maxlength: [50, "Device model cannot exceed 50 characters"]
    },
    osVersion: {
      type: String,
      trim: true,
      maxlength: [20, "OS version cannot exceed 20 characters"]
    },
    appVersion: {
      type: String,
      trim: true,
      maxlength: [15, "App version cannot exceed 15 characters"]
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    lastUsed: {
      type: Date,
      default: Date.now
    },
    ipAddress: {
      type: String,
      trim: true,
      validate: {
        validator: function(v) {
          return validator.isIP(v);
        },
        message: "Invalid IP address format"
      }
    },
    userAgent: {
      type: String,
      trim: true,
      maxlength: [500, "User agent cannot exceed 500 characters"]
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Compound index to ensure a user can't have duplicate active tokens for the same device
notificationTokenSchema.index(
  { userId: 1, deviceId: 1, isActive: 1 }, 
  { unique: true, partialFilterExpression: { isActive: true } }
);

// Index for FCM token lookup
notificationTokenSchema.index({ fcmToken: 1 });

// Virtual for token status
notificationTokenSchema.virtual("status").get(function() {
  return this.isActive ? "active" : "inactive";
});

// Pre-save middleware to update lastUsed timestamp
notificationTokenSchema.pre("save", function(next) {
  if (this.isModified("fcmToken") || this.isNew) {
    this.lastUsed = new Date();
  }
  next();
});

// Static method to deactivate all tokens for a user
notificationTokenSchema.statics.deactivateAllUserTokens = function(userId) {
  return this.updateMany(
    { userId, isActive: true },
    { isActive: false, lastUsed: new Date() }
  );
};

// Static method to find active tokens for a user
notificationTokenSchema.statics.findActiveByUserId = function(userId) {
  return this.find({ userId, isActive: true });
};

// Instance method to deactivate token
notificationTokenSchema.methods.deactivate = function() {
  this.isActive = false;
  this.lastUsed = new Date();
  return this.save();
};

// Check if token is expired (not used in last 30 days)
notificationTokenSchema.methods.isExpired = function() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  return this.lastUsed < thirtyDaysAgo;
};

export const NotificationToken = mongoose.model(
  "NotificationToken",
  notificationTokenSchema
);