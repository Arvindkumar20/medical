// models/ParentCategory.js
import mongoose from "mongoose";
import slugify from "slugify";
import validator from "validator";

const parentCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Parent category name is required"],
    unique: true,
    trim: true,
    maxlength: [50, "Name cannot exceed 50 characters"],
    minlength: [3, "Name must be at least 3 characters"],
    validate: {
      validator: (v) => /^[a-zA-Z0-9\s\-&]+$/.test(v),
      message: "Name can only contain letters, numbers, spaces, hyphens, and ampersands"
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

// Slugify on name change
parentCategorySchema.pre("save", function(next) {
  if (this.isModified("name")) {
    this.slug = slugify(this.name, {
      lower: true,
      strict: true,
      remove: /[*+~.()'"!:@]/g
    });
  }
  next();
});

// Virtual: child categories (from Category model parentCategory field)
parentCategorySchema.virtual("children", {
  ref: "Category",
  localField: "_id",
  foreignField: "parentCategory"
});

// Static to get active ones
parentCategorySchema.statics.getActive = function() {
  return this.find({ isActive: true })
    .sort({ displayOrder: 1, name: 1 })
    .select("name slug image");
};

export const ParentCategory= mongoose.model("ParentCategory", parentCategorySchema);
