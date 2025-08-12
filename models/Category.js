// models/Category.js
// const mongoose = require("mongoose");
// const slugify = require("slugify");
// const validator = require("validator");

import mongoose from "mongoose";
import slugify from "slugify";
import validator from "validator"
const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Category name is required"],
    unique: true,
    trim: true,
    maxlength: [50, "Category name cannot exceed 50 characters"],
    minlength: [3, "Category name must be at least 3 characters"],
    validate: {
      validator: function(v) {
        return /^[a-zA-Z0-9\s\-&]+$/.test(v);
      },
      message: "Category name can only contain letters, numbers, spaces, hyphens, and ampersands"
    }
  },
  slug: {
    type: String,
    unique: true,
    index: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, "Description cannot exceed 500 characters"]
  },
  parentCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ParentCategory",
    validate: {
      validator: async function(v) {
        if (!v) return true;
        const category = await mongoose.model("ParentCategory").findById(v);
        return !!category;
      },
      message: "Parent category must reference a valid category"
    }
  },
  image: {
    type: String,
    validate: {
      validator: function(v) {
        if (!v) return true;
        return validator.isURL(v, {
          protocols: ["http", "https"],
          require_protocol: true
        });
      },
      message: "Invalid image URL"
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  displayOrder: {
    type: Number,
    min: 0,
    default: 0
  },
  seoTitle: {
    type: String,
    trim: true,
    maxlength: [60, "SEO title cannot exceed 60 characters"]
  },
  seoDescription: {
    type: String,
    trim: true,
    maxlength: [160, "SEO description cannot exceed 160 characters"]
  },
  seoKeywords: [{
    type: String,
    trim: true,
    lowercase: true,
    maxlength: [20, "SEO keyword cannot exceed 20 characters"]
  }],
  attributes: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    values: [{
      type: String,
      trim: true
    }],
    isRequired: {
      type: Boolean,
      default: false
    },
    isFilterable: {
      type: Boolean,
      default: false
    }
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Generate slug before saving
categorySchema.pre("save", function(next) {
  if (this.isModified("name")) {
    this.slug = slugify(this.name, {
      lower: true,
      strict: true,
      remove: /[*+~.()'"!:@]/g
    });
  }
  next();
});

// Cascade delete products when category is deleted
categorySchema.pre("remove", async function(next) {
  await mongoose.model("Product").updateMany(
    { category: this._id },
    { $set: { category: null } }
  );
  next();
});

// Virtual for child categories
categorySchema.virtual("children", {
  ref: "Category",
  localField: "_id",
  foreignField: "parentCategory"
});

// Virtual for product count
categorySchema.virtual("productCount", {
  ref: "Product",
  localField: "_id",
  foreignField: "category",
  count: true
});

// Indexes for better performance
// categorySchema.index({ name: 1 });
// categorySchema.index({ slug: 1 });
categorySchema.index({ parentCategory: 1 });
categorySchema.index({ isActive: 1 });
categorySchema.index({ displayOrder: 1 });

// Static method to get active categories
categorySchema.statics.getActiveCategories = function() {
  return this.find({ isActive: true })
    .sort({ displayOrder: 1, name: 1 })
    .select("name slug image");
};

// Static method to get category tree
categorySchema.statics.getCategoryTree = async function() {
  const categories = await this.find({ isActive: true })
    .sort({ displayOrder: 1, name: 1 })
    .lean();
  
  const buildTree = (parentId = null) => {
    return categories
      .filter(cat => String(cat.parentCategory) === String(parentId))
      .map(cat => ({
        ...cat,
        children: buildTree(cat._id)
      }));
  };

  return buildTree();
};

// Instance method to get all ancestor categories
categorySchema.methods.getAncestors = async function() {
  const ancestors = [];
  let current = this;
  
  while (current.parentCategory) {
    current = await mongoose.model("Category").findById(current.parentCategory);
    if (current) {
      ancestors.unshift(current);
    } else {
      break;
    }
  }
  
  return ancestors;
};

export const Category = mongoose.model("Category", categorySchema);