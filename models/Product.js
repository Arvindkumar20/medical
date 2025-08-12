// models/Product.js
// const mongoose = require("mongoose");
// const validator = require("validator");
import mongoose from "mongoose";
import validator from "validator"

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Product name is required"],
    trim: true,
    maxlength: [100, "Product name cannot exceed 100 characters"],
    minlength: [3, "Product name must be at least 3 characters"],
    index: true
  },
  description: {
    type: String,
    required: [true, "Description is required"],
    trim: true,
    maxlength: [2000, "Description cannot exceed 2000 characters"],
    minlength: [20, "Description must be at least 20 characters"]
  },
  price: {
    type: Number,
    required: [true, "Price is required"],
    min: [0.01, "Price must be at least 0.01"],
    max: [1000000, "Price cannot exceed 1,000,000"],
    set: v => parseFloat(v.toFixed(2)) // Ensure 2 decimal places
  },
  quantity: {
    type: Number,
    required: [true, "Quantity is required"],
    min: [0, "Quantity cannot be negative"],
    default: 0,
    validate: {
      validator: Number.isInteger,
      message: "Quantity must be an integer"
    }
  },
  images: [{
    type: String,
    validate: {
      validator: function (v) {
        return validator.isURL(v, {
          protocols: ["http", "https"],
          require_protocol: true
        });
      },
      message: "Invalid image URL"
    }
  }],
  store: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Store",
    required: [true, "Store reference is required"],
    validate: {
      validator: async function (v) {
        const store = await mongoose.model("Store").findById(v);
        return store && store.approved && store.status === "active";
      },
      message: "Store must be an approved and active store"
    }
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    required: [true, "Category reference is required"],
    validate: {
      validator: async function (v) {
        const category = await mongoose.model("Category").findById(v);
        return !!category;
      },
      message: "Invalid category reference"
    }
  },
  requiresPrescription: {
    type: Boolean,
    default: false
  },
  sku: {
    type: String,
    unique: true,
    trim: true,
    uppercase: true,
    match: [/^[A-Z0-9\-_]{6,20}$/, "SKU must be 6-20 alphanumeric characters"]
  },
  barcode: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    validate: {
      validator: function (v) {
        return validator.isISBN(v) || validator.isEAN(v) || /^[0-9]{8,14}$/.test(v);
      },
      message: "Invalid barcode format"
    }
  },
  isDilated: {
    type: Boolean,
    default: false
  },
  specifications: {
    weight: {
      value: {
        type: Number,
        min: 0
      },
      unit: {
        type: String,
        enum: ["g", "kg", "oz", "lb", "ml", "l"]
      }
    },
    dimensions: {
      length: Number,
      width: Number,
      height: Number,
      unit: {
        type: String,
        enum: ["mm", "cm", "m", "in", "ft"]
      }
    }
  },
  variants: [{
    name: String,
    price: Number,
    quantity: Number,
    sku: String
  }],
  ratings: {
    average: {
      type: Number,
      min: 0,
      max: 5,
      default: 0
    },
    count: {
      type: Number,
      min: 0,
      default: 0
    }
  },
  discount: {
    amount: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    startDate: Date,
    endDate: Date
  },
  status: {
    type: String,
    enum: ["active", "inactive", "out_of_stock", "discontinued"],
    default: "active"
  },
  tags: [{
    type: String,
    maxlength: [20, "Tag cannot exceed 20 characters"],
    lowercase: true
  }],
  manufacturer: {
    type: String,
    maxlength: [100, "Manufacturer name cannot exceed 100 characters"],
    trim: true
  },
  expiryDate: {
    type: Date,
    validate: {
      validator: function (v) {
        return !v || v > Date.now();
      },
      message: "Expiry date must be in the future"
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
productSchema.index({ name: "text", description: "text", tags: "text" });
productSchema.index({ price: 1 });
productSchema.index({ quantity: 1 });
productSchema.index({ status: 1 });
productSchema.index({ "specifications.weight.value": 1 });

// Virtual for discounted price
productSchema.virtual("discountedPrice").get(function () {
  if (this.discount && this.discount.amount > 0) {
    const discountValue = (this.price * this.discount.amount) / 100;
    return parseFloat((this.price - discountValue).toFixed(2));
  }
  return this.price;
});

// Virtual for availability status
productSchema.virtual("availability").get(function () {
  if (this.quantity <= 0) return "out_of_stock";
  if (this.status !== "active") return this.status;
  return "in_stock";
});

// Pre-save hook to generate SKU if not provided
productSchema.pre("save", async function (next) {
  if (!this.sku) {
    const count = await mongoose.model("Product").countDocuments();
    this.sku = `PROD${(count + 1).toString().padStart(6, "0")}`;
  }

  if (this.discount) {
    if (this.discount.endDate && this.discount.endDate < new Date()) {
      this.discount = undefined;
    }
  }

  if (this.quantity <= 0 && this.status === "active") {
    this.status = "out_of_stock";
  }

  next();
});

// Static method to find products by price range
productSchema.statics.findByPriceRange = function (min, max) {
  return this.find({
    price: { $gte: min, $lte: max },
    status: "active"
  });
};

// Static method to find products that need restocking
productSchema.statics.findLowStock = function (threshold = 10) {
  return this.find({
    quantity: { $lte: threshold },
    status: "active"
  });
};

// Instance method to check if product is on discount
productSchema.methods.isOnDiscount = function () {
  return this.discount &&
    this.discount.amount > 0 &&
    (!this.discount.startDate || this.discount.startDate <= new Date()) &&
    (!this.discount.endDate || this.discount.endDate >= new Date());
};

export const Product = mongoose.model("Product", productSchema);