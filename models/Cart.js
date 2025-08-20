import mongoose from "mongoose";
import validator from "validator";

const cartItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product reference is required"],
    //   validate: {
    //     validator: async function (v) {
    //       if (!mongoose.Types.ObjectId.isValid(v)) {
    //         return false;
    //       }
    //       const product = await mongoose.model("Product").findById(v).select("status price inventory");
    //       return product && product.status === "active" && product.inventory > 0;
    //     },
    //     message: "Product must be active and in stock"
    //   }
    },
    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [1, "Minimum quantity is 1"],
      max: [100, "Maximum quantity is 100"],
      validate: {
        validator: Number.isInteger,
        message: "Quantity must be an integer"
      }
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0.01, "Price must be at least 0.01"],
      validate: {
        validator: function(v) {
          // Price should have at most 2 decimal places
          return v === Math.round(v * 100) / 100;
        },
        message: "Price can have at most 2 decimal places"
      }
    },
    // Added for better tracking and validation
    addedAt: {
      type: Date,
      default: Date.now
    },
    // Store product details snapshot for historical reference
    productSnapshot: {
      name: String,
      image: String,
      sku: String
    }
  },
  { _id: false }
);

const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
      unique: true,
    //   validate: {
    //     validator: async function (v) {
    //       if (!mongoose.Types.ObjectId.isValid(v)) {
    //         return false;
    //       }
    //       const user = await mongoose.model("User").findById(v).select("status");
    //       return user && user.status === "active";
    //     },
    //     message: "User must be active and valid"
    //   }
    },
    items: {
      type: [cartItemSchema],
      validate: {
        validator: function(items) {
          // Check for duplicate products in cart
          const productIds = items.map(item => item.product.toString());
          return new Set(productIds).size === productIds.length;
        },
        message: "Duplicate products are not allowed in cart"
      }
    },
    totalPrice: {
      type: Number,
      default: 0,
      min: [0, "Total price cannot be negative"]
    },
    totalItems: {
      type: Number,
      default: 0,
      min: [0, "Total items cannot be negative"]
    },
    status: {
      type: String,
      enum: {
        values: ["active", "ordered", "abandoned"],
        message: "Status must be either active, ordered, or abandoned"
      },
      default: "active"
    },
    // For analytics and business intelligence
    lastActiveAt: {
      type: Date,
      default: Date.now
    },
    // To track cart abandonment
    abandonedAt: {
      type: Date
    },
    // For promotional codes
    couponCode: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: [20, "Coupon code cannot exceed 20 characters"]
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: [0, "Discount cannot be negative"]
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for better query performance
// cartSchema.index({ user: 1 });
cartSchema.index({ status: 1 });
cartSchema.index({ "lastActiveAt": 1 });
cartSchema.index({ "items.product": 1 });

// Virtual for discounted total price
cartSchema.virtual("discountedTotal").get(function() {
  return Math.max(0, this.totalPrice - this.discountAmount);
});

// Pre-save middleware to calculate totals and validate inventory
cartSchema.pre("save", async function(next) {
  try {
    // Update lastActiveAt for active carts
    if (this.status === "active") {
      this.lastActiveAt = new Date();
    }
    
    // Mark as abandoned if not updated for 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    if (this.status === "active" && this.updatedAt < sevenDaysAgo) {
      this.status = "abandoned";
      this.abandonedAt = new Date();
    }
    
    // Calculate totals
    if (this.isModified("items") || this.isNew) {
      this.totalItems = this.items.reduce((acc, item) => acc + item.quantity, 0);
      this.totalPrice = this.items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
      
      // Validate inventory for each item
      for (const item of this.items) {
        const product = await mongoose.model("Product").findById(item.product).select("inventory");
        if (!product || product.inventory < item.quantity) {
          throw new Error(`Insufficient inventory for product ${item.product}`);
        }
      }
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-validate hook to check for data consistency
cartSchema.pre("validate", function(next) {
  // Ensure discount doesn't exceed total price
  if (this.discountAmount > this.totalPrice) {
    this.invalidate("discountAmount", "Discount cannot exceed total price");
  }
  next();
});

// Instance method to add an item to cart
cartSchema.methods.addItem = async function(productId, quantity = 1, price) {
  try {
    // Validate product
    const product = await mongoose.model("Product").findById(productId);
    if (!product  || product.inventory < quantity) {
      throw new Error("Product is not available or out of stock");
    }
    
    // Check if product already exists in cart
    const existingItemIndex = this.items.findIndex(
      item => item.product.toString() === productId.toString()
    );
    
    if (existingItemIndex > -1) {
      // Update existing item
      const newQuantity = this.items[existingItemIndex].quantity + quantity;
      
      if (newQuantity > 100) {
        throw new Error("Maximum quantity per product is 100");
      }
      
      if (newQuantity > product.inventory) {
        throw new Error("Insufficient inventory for this product");
      }
      
      this.items[existingItemIndex].quantity = newQuantity;
    } else {
      // Add new item
      if (this.items.length >= 50) {
        throw new Error("Cart cannot have more than 50 different products");
      }
      
      this.items.push({
        product: productId,
        quantity,
        price: price || product.price,
        productSnapshot: {
          name: product.name,
          image: product.images?.[0] || "",
          sku: product.sku || ""
        }
      });
    }
    
    return await this.save();
  } catch (error) {
    throw error;
  }
};

// Instance method to remove an item from cart
cartSchema.methods.removeItem = function(productId, quantity = null) {
  const itemIndex = this.items.findIndex(
    item => item.product.toString() === productId.toString()
  );
  
  if (itemIndex === -1) {
    throw new Error("Product not found in cart");
  }
  
  if (quantity === null || quantity >= this.items[itemIndex].quantity) {
    // Remove the item completely
    this.items.splice(itemIndex, 1);
  } else {
    // Reduce quantity
    this.items[itemIndex].quantity -= quantity;
  }
  
  return this.save();
};

// Instance method to clear cart
cartSchema.methods.clearCart = function() {
  this.items = [];
  this.totalPrice = 0;
  this.totalItems = 0;
  this.discountAmount = 0;
  this.couponCode = undefined;
  return this.save();
};

// Instance method to apply coupon
cartSchema.methods.applyCoupon = async function(couponCode) {
  // In a real implementation, you would validate the coupon
  // against a Coupon model and calculate discount
  this.couponCode = couponCode;
  // Placeholder for discount calculation
  this.discountAmount = Math.min(this.totalPrice * 0.1, 50); // 10% off, max $50
  return this.save();
};

// Instance method to remove coupon
cartSchema.methods.removeCoupon = function() {
  this.couponCode = undefined;
  this.discountAmount = 0;
  return this.save();
};

// Static method to find abandoned carts
cartSchema.statics.findAbandonedCarts = function(days = 7) {
  const dateThreshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return this.find({
    status: "active",
    updatedAt: { $lt: dateThreshold }
  }).populate("user", "name email");
};

// Static method to find cart by user ID with product details
cartSchema.statics.findByUserId = function(userId, populate = true) {
  const query = this.findOne({ user: userId });
  if (populate) {
    return query.populate("items.product", "name price images inventory status");
  }
  return query;
};

// Static method to migrate cart items (useful when user logs in)
cartSchema.statics.migrateCart = async function(fromUserId, toUserId) {
  const fromCart = await this.findOne({ user: fromUserId });
  const toCart = await this.findOne({ user: toUserId });
  
  if (!fromCart || fromCart.items.length === 0) {
    return toCart;
  }
  
  if (!toCart) {
    // Create new cart for toUser with fromUser's items
    return this.create({
      user: toUserId,
      items: fromCart.items,
      status: "active"
    });
  }
  
  // Merge carts
  for (const item of fromCart.items) {
    await toCart.addItem(item.product, item.quantity, item.price);
  }
  
  // Delete the old cart
  await this.deleteOne({ user: fromUserId });
  
  return toCart;
};

// Update the lastActiveAt field on each update
cartSchema.pre("findOneAndUpdate", function(next) {
  this.set({ lastActiveAt: new Date() });
  next();
});

export const Cart = mongoose.model("Cart", cartSchema);

