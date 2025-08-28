import mongoose from "mongoose";
import validator from "validator";

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      validate: {
        validator: function(value) {
          return mongoose.Types.ObjectId.isValid(value);
        },
        message: "Invalid user ID format"
      }
    },
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      // required: [true, "Store ID is required"],
      // validate: {
      //   validator: function(value) {
      //     return mongoose.Types.ObjectId.isValid(value);
      //   },
      //   message: "Invalid store ID format"
      // }
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      // required: [true, "Product ID is required"],
      // validate: {
      //   validator: function(value) {
      //     return mongoose.Types.ObjectId.isValid(value);
      //   },
      //   message: "Invalid product ID format"
      // }
    },
    message: {
      type: String,
      required: [true, "Message is required"],
      trim: true,
      minlength: [1, "Message cannot be empty"],
      maxlength: [500, "Message cannot exceed 500 characters"],
      validate: {
        validator: function(value) {
          // Check if message contains only allowed characters
          return /^[a-zA-Z0-9\s.,!?@#$%^&*()_+-=;:'"<>{}[\]\\/]+$/.test(value);
        },
        message: "Message contains invalid characters"
      }
    },
    type: {
      type: String,
      enum: {
        values: ["order", "reminder", "offer", "system", "custom","Booking"],
        message: "Notification type must be one of: order, reminder, offer, system, custom"
      },
      default: "custom",
      lowercase: true,
      trim: true
    },
    isRead: {
      type: Boolean,
      default: false
    },
    priority: {
      type: String,
      enum: {
        values: ["low", "medium", "high", "urgent"],
        message: "Priority must be one of: low, medium, high, urgent"
      },
      default: "medium",
      lowercase: true,
      trim: true
    },
    expirationDate: {
      type: Date,
      validate: {
        validator: function(value) {
          // Ensure expiration date is in the future if provided
          return !value || value > Date.now();
        },
        message: "Expiration date must be in the future"
      }
    },
    actionUrl: {
      type: String,
      trim: true,
      // validate: {
      //   validator: function(value) {
      //     // Validate URL format if provided
      //     return !value || validator.isURL(value, {
      //       protocols: ["http", "https"],
      //       require_protocol: true,
      //       require_valid_protocol: true,
      //       allow_underscores: true
      //     });
      //   },
      //   message: "Invalid URL format for action URL"
      // }
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      validate: {
        validator: function(value) {
          // Limit metadata size
          return JSON.stringify(value).length <= 2000;
        },
        message: "Metadata exceeds maximum size of 2000 characters"
      }
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Index for better query performance
notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ expirationDate: 1 }, { expireAfterSeconds: 0 });
notificationSchema.index({ type: 1, priority: 1 });

// Virtual for checking if notification is expired
notificationSchema.virtual("isExpired").get(function() {
  return this.expirationDate && this.expirationDate < Date.now();
});

// Pre-save middleware to validate references
notificationSchema.pre("save", async function(next) {
  try {
    // Check if user exists
    const User = mongoose.model("User");
    const userExists = await User.exists({ _id: this.userId });
    if (!userExists) {
      throw new Error("Referenced user does not exist");
    }

    // Check if store exists
    const Store = mongoose.model("Store");
    const storeExists = await Store.exists({ _id: this.storeId });
    if (!storeExists) {
      throw new Error("Referenced store does not exist");
    }

    // Check if product exists
    const Product = mongoose.model("Product");
    const productExists = await Product.exists({ _id: this.productId });
    if (!productExists) {
      throw new Error("Referenced product does not exist");
    }

    next();
  } catch (error) {
    next(error);
  }
});

// Static method to find unread notifications for a user
notificationSchema.statics.findUnreadByUser = function(userId, limit = 20) {
  return this.find({ userId, isRead: false })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("storeId", "name")
    .populate("productId", "name images");
};

// Instance method to mark as read
notificationSchema.methods.markAsRead = function() {
  this.isRead = true;
  return this.save();
};

// Static method to mark all notifications as read for a user
notificationSchema.statics.markAllAsRead = function(userId) {
  return this.updateMany(
    { userId, isRead: false },
    { isRead: true }
  );
};

// Static method to cleanup expired notifications
notificationSchema.statics.cleanupExpired = function() {
  return this.deleteMany({
    expirationDate: { $lt: new Date() }
  });
};

export const Notification= mongoose.model("Notification", notificationSchema);