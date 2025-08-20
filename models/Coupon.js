import mongoose from "mongoose";
import validator from "validator";

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, "Coupon code is required"],
    unique: true,
    uppercase: true,
    trim: true,
    minlength: [4, "Coupon code must be at least 4 characters"],
    maxlength: [20, "Coupon code cannot exceed 20 characters"],
    validate: {
      validator: function(v) {
        return /^[A-Z0-9_-]+$/.test(v);
      },
      message: "Coupon code can only contain letters, numbers, underscores, and hyphens"
    }
  },
  description: {
    type: String,
    maxlength: [500, "Description cannot exceed 500 characters"]
  },
  discountType: {
    type: String,
    enum: {
      values: ["percentage", "fixed", "free_shipping"],
      message: "Discount type must be percentage, fixed, or free_shipping"
    },
    required: [true, "Discount type is required"]
  },
  discountValue: {
    type: Number,
    required: [true, "Discount value is required"],
    min: [0, "Discount value cannot be negative"],
    validate: {
      validator: function(v) {
        if (this.discountType === "percentage") {
          return v <= 100;
        }
        return true;
      },
      message: "Percentage discount cannot exceed 100%"
    }
  },
  minimumPurchase: {
    type: Number,
    min: [0, "Minimum purchase cannot be negative"],
    default: 0
  },
  maximumDiscount: {
    type: Number,
    min: [0, "Maximum discount cannot be negative"],
    validate: {
      validator: function(v) {
        if (this.discountType !== "percentage") {
          return v === null || v === undefined;
        }
        return true;
      },
      message: "Maximum discount is only applicable for percentage discounts"
    }
  },
  appliesTo: {
    type: String,
    enum: {
      values: ["all", "categories", "products", "brands"],
      message: "Applies to must be all, categories, products, or brands"
    },
    default: "all"
  },
  applicableCategories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    validate: {
      validator: function(v) {
        return this.appliesTo === "categories";
      },
      message: "Applicable categories only valid when appliesTo is categories"
    }
  }],
  applicableProducts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    validate: {
      validator: function(v) {
        return this.appliesTo === "products";
      },
      message: "Applicable products only valid when appliesTo is products"
    }
  }],
  applicableBrands: [{
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        return this.appliesTo === "brands";
      },
      message: "Applicable brands only valid when appliesTo is brands"
    }
  }],
  usageLimit: {
    type: Number,
    min: [1, "Usage limit must be at least 1"],
    default: null
  },
  perUserLimit: {
    type: Number,
    min: [1, "Per user limit must be at least 1"],
    default: 1
  },
  usedCount: {
    type: Number,
    default: 0,
    min: [0, "Used count cannot be negative"]
  },
  validFrom: {
    type: Date,
    required: [true, "Valid from date is required"]
  },
  validUntil: {
    type: Date,
    required: [true, "Valid until date is required"],
    validate: {
      validator: function(v) {
        return v > this.validFrom;
      },
      message: "Valid until date must be after valid from date"
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  // For analytics
  totalDiscountAmount: {
    type: Number,
    default: 0,
    min: [0, "Total discount amount cannot be negative"]
  },
  totalOrders: {
    type: Number,
    default: 0,
    min: [0, "Total orders cannot be negative"]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
// couponSchema.index({ code: 1 });
couponSchema.index({ validFrom: 1, validUntil: 1 });
couponSchema.index({ isActive: 1 });
couponSchema.index({ appliesTo: 1 });
couponSchema.index({ "applicableProducts": 1 });
couponSchema.index({ "applicableCategories": 1 });

// Virtual for checking if coupon is currently valid
couponSchema.virtual("isValid").get(function() {
  const now = new Date();
  return this.isActive && 
         now >= this.validFrom && 
         now <= this.validUntil &&
         (this.usageLimit === null || this.usedCount < this.usageLimit);
});

// Virtual for days remaining
couponSchema.virtual("daysRemaining").get(function() {
  if (new Date() > this.validUntil) return 0;
  const diffTime = Math.abs(this.validUntil - new Date());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Pre-save validation
couponSchema.pre("save", function(next) {
  // Ensure arrays are empty if not applicable
  if (this.appliesTo !== "categories") {
    this.applicableCategories = [];
  }
  if (this.appliesTo !== "products") {
    this.applicableCategories = [];
  }
  if (this.appliesTo !== "brands") {
    this.applicableBrands = [];
  }
  
  // Ensure maximumDiscount is null for non-percentage discounts
  if (this.discountType !== "percentage") {
    this.maximumDiscount = undefined;
  }
  
  next();
});

// Static method to validate a coupon
couponSchema.statics.validateCoupon = async function(code, userId, cartTotal, cartItems = []) {
  const coupon = await this.findOne({ code: code.toUpperCase() });
  
  if (!coupon) {
    throw new Error("Invalid coupon code");
  }
  
  if (!coupon.isValid) {
    throw new Error("Coupon is not valid");
  }
  
  // Check if user has exceeded per user limit
  const Order = mongoose.model("Order");
  const userUsageCount = await Order.countDocuments({
    user: userId,
    "payment.couponCode": coupon.code
  });
  
  if (userUsageCount >= coupon.perUserLimit) {
    throw new Error("You have exceeded the usage limit for this coupon");
  }
  
  // Check minimum purchase requirement
  if (cartTotal < coupon.minimumPurchase) {
    throw new Error(`Minimum purchase of ${coupon.minimumPurchase} required for this coupon`);
  }
  
  // Check if coupon applies to any items in cart
  if (coupon.appliesTo !== "all") {
    let hasApplicableItem = false;
    
    for (const item of cartItems) {
      if (coupon.appliesTo === "products" && 
          coupon.applicableProducts.includes(item.product._id)) {
        hasApplicableItem = true;
        break;
      }
      
      if (coupon.appliesTo === "categories" && 
          item.product.category && 
          coupon.applicableCategories.includes(item.product.category)) {
        hasApplicableItem = true;
        break;
      }
      
      if (coupon.appliesTo === "brands" && 
          item.product.brand && 
          coupon.applicableBrands.includes(item.product.brand)) {
        hasApplicableItem = true;
        break;
      }
    }
    
    if (!hasApplicableItem) {
      throw new Error("Coupon not applicable to any items in your cart");
    }
  }
  
  return coupon;
};

// Static method to calculate discount
couponSchema.statics.calculateDiscount = function(coupon, cartTotal, applicableItemsTotal = null) {
  if (coupon.discountType === "free_shipping") {
    return { discountAmount: 0, freeShipping: true };
  }
  
  // For specific product/category discounts, use applicableItemsTotal if provided
  const baseAmount = applicableItemsTotal !== null ? applicableItemsTotal : cartTotal;
  
  let discountAmount = 0;
  
  if (coupon.discountType === "percentage") {
    discountAmount = baseAmount * (coupon.discountValue / 100);
    
    // Apply maximum discount if specified
    if (coupon.maximumDiscount && discountAmount > coupon.maximumDiscount) {
      discountAmount = coupon.maximumDiscount;
    }
  } else if (coupon.discountType === "fixed") {
    discountAmount = Math.min(coupon.discountValue, baseAmount);
  }
  
  return { 
    discountAmount: Math.round(discountAmount * 100) / 100, // Round to 2 decimal places
    freeShipping: false 
  };
};

// Instance method to increment usage
couponSchema.methods.incrementUsage = function(discountAmount = 0) {
  this.usedCount += 1;
  this.totalOrders += 1;
  this.totalDiscountAmount += discountAmount;
  return this.save();
};

// Instance method to check if a specific product is eligible
couponSchema.methods.isProductEligible = function(product) {
  if (!this.isValid) return false;
  
  if (this.appliesTo === "all") return true;
  
  if (this.appliesTo === "products") {
    return this.applicableProducts.includes(product._id);
  }
  
  if (this.appliesTo === "categories") {
    return product.category && this.applicableCategories.includes(product.category);
  }
  
  if (this.appliesTo === "brands") {
    return product.brand && this.applicableBrands.includes(product.brand);
  }
  
  return false;
};

// Pre-find middleware to only show active coupons by default
couponSchema.pre(/^find/, function(next) {
  if (this.getFilter().isActive === undefined) {
    this.where({ isActive: true });
  }
  next();
});

export const Coupon = mongoose.model("Coupon", couponSchema);

