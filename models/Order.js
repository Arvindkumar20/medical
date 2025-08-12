// models/Order.js

import mongoose from "mongoose";
import validator from "validator";

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: [true, "Product reference is required"],
    validate: {
      validator: async function(v) {
        const product = await mongoose.model("Product").findById(v);
        return product && product.status === "active";
      },
      message: "Product must be active and valid"
    }
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
    min: [0.01, "Price must be at least 0.01"]
  },
  store: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Store",
    required: [true, "Store reference is required"],
    validate: {
      validator: async function(v) {
        const store = await mongoose.model("Store").findById(v);
        return store && store.approved && store.status === "active";
      },
      message: "Store must be approved and active"
    }
  },
  requiresPrescription: {
    type: Boolean,
    default: false
  },
  prescriptionApproved: {
    type: Boolean,
    default: false
  },
  prescriptionApprovedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    validate: {
      validator: async function(v) {
        if (!this.requiresPrescription || !v) return true;
        const user = await mongoose.model("User").findById(v);
        return user && user.role === "doctor";
      },
      message: "Prescription must be approved by a doctor"
    }
  }
}, { _id: false });

const paymentSchema = new mongoose.Schema({
  method: {
    type: String,
    enum: ["credit_card", "debit_card", "net_banking", "wallet", "cod", "upi"],
    required: [true, "Payment method is required"]
  },
  transactionId: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ["pending", "completed", "failed", "refunded", "partially_refunded"],
    default: "pending"
  },
  amount: {
    type: Number,
    required: [true, "Payment amount is required"],
    min: [0.01, "Amount must be at least 0.01"]
  },
  gatewayResponse: {
    type: mongoose.Schema.Types.Mixed
  },
  paymentDate: {
    type: Date
  }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    unique: true,
    required: true,
    index: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: [true, "User reference is required"],
    validate: {
      validator: async function(v) {
        const user = await mongoose.model("User").findById(v);
        return !!user && user.verified;
      },
      message: "User must be verified and valid"
    }
  },
  items: {
    type: [orderItemSchema],
    validate: {
      validator: function(v) {
        return v && v.length > 0;
      },
      message: "Order must contain at least one item"
    }
  },
  totalAmount: {
    type: Number,
    required: [true, "Total amount is required"],
    min: [0.01, "Total amount must be at least 0.01"]
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: [0, "Discount cannot be negative"]
  },
  taxAmount: {
    type: Number,
    default: 0,
    min: [0, "Tax cannot be negative"]
  },
  shippingAmount: {
    type: Number,
    default: 0,
    min: [0, "Shipping cannot be negative"]
  },
  finalAmount: {
    type: Number,
    required: [true, "Final amount is required"],
    min: [0.01, "Final amount must be at least 0.01"]
  },
  payment: {
    type: paymentSchema,
    required: [true, "Payment information is required"]
  },
  orderStatus: {
    type: String,
    enum: {
      values: [
        "pending", 
        "confirmed", 
        "processing", 
        "ready_for_shipment",
        "shipped", 
        "out_for_delivery", 
        "delivered", 
        "cancelled", 
        "returned",
        "refunded"
      ],
      message: "Invalid order status"
    },
    default: "pending"
  },
  statusHistory: [{
    status: {
      type: String,
      required: true
    },
    changedAt: {
      type: Date,
      default: Date.now
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    notes: {
      type: String,
      maxlength: [500, "Status notes cannot exceed 500 characters"]
    }
  }],
  shippingAddress: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Address",
    required: [true, "Shipping address is required"],
    validate: {
      validator: async function(v) {
        const address = await mongoose.model("Address").findById(v);
        return address && address.user.equals(this.user);
      },
      message: "Address must belong to the ordering user"
    }
  },
  billingAddress: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Address",
    validate: {
      validator: async function(v) {
        if (!v) return true;
        const address = await mongoose.model("Address").findById(v);
        return address && address.user.equals(this.user);
      },
      message: "Billing address must belong to the ordering user"
    }
  },
  prescription: {
    type: String,
    validate: {
      validator: function(v) {
        if (!v) return true;
        return validator.isURL(v, {
          protocols: ["http", "https"],
          require_protocol: true
        });
      },
      message: "Invalid prescription URL"
    }
  },
  trackingInfo: {
    carrier: {
      type: String,
      maxlength: [50, "Carrier name cannot exceed 50 characters"]
    },
    trackingNumber: {
      type: String,
      maxlength: [100, "Tracking number cannot exceed 100 characters"]
    },
    trackingUrl: {
      type: String,
      validate: {
        validator: function(v) {
          if (!v) return true;
          return validator.isURL(v, {
            protocols: ["http", "https"],
            require_protocol: true
          });
        },
        message: "Invalid tracking URL"
      }
    }
  },
  notes: {
    type: String,
    maxlength: [1000, "Order notes cannot exceed 1000 characters"]
  },
  cancellationReason: {
    type: String,
    maxlength: [500, "Cancellation reason cannot exceed 500 characters"]
  },
  returnReason: {
    type: String,
    maxlength: [500, "Return reason cannot exceed 500 characters"]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
orderSchema.index({ user: 1 });
orderSchema.index({ "orderStatus": 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ "payment.status": 1 });
orderSchema.index({ "items.store": 1 });

// Pre-save hook to generate order ID and validate amounts
orderSchema.pre("save", async function(next) {
  if (this.isNew) {
    // Generate custom order ID (format: ORD-YYYYMMDD-XXXXX)
    const count = await mongoose.model("Order").countDocuments();
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    this.orderId = `ORD-${dateStr}-${(count + 1).toString().padStart(5, '0')}`;
    
    // Calculate final amount if not provided
    if (!this.finalAmount) {
      this.finalAmount = this.totalAmount - this.discountAmount + this.taxAmount + this.shippingAmount;
    }
  }

  // Add initial status to history
  if (this.isNew) {
    this.statusHistory = [{
      status: this.orderStatus,
      changedAt: new Date(),
      notes: "Order created"
    }];
  }
  next();
});

// Pre-save hook to update status history when status changes
orderSchema.pre("save", function(next) {
  if (this.isModified("orderStatus")) {
    this.statusHistory.push({
      status: this.orderStatus,
      changedAt: new Date(),
      notes: "Status updated"
    });
  }
  next();
});

// Virtual for order summary
orderSchema.virtual("summary").get(function() {
  return {
    items: this.items.length,
    total: this.finalAmount,
    status: this.orderStatus,
    lastUpdated: this.updatedAt
  };
});

// Virtual for prescription required status
orderSchema.virtual("requiresPrescription").get(function() {
  return this.items.some(item => item.requiresPrescription);
});

// Static method to get orders by status
orderSchema.statics.findByStatus = function(status) {
  return this.find({ orderStatus: status }).sort({ createdAt: -1 });
};

// Static method to get user's orders
orderSchema.statics.findByUser = function(userId, status) {
  const query = { user: userId };
  if (status) query.orderStatus = status;
  return this.find(query).sort({ createdAt: -1 });
};

// Instance method to check if order can be cancelled
orderSchema.methods.canCancel = function() {
  const cancellableStatuses = ["pending", "confirmed", "processing"];
  return cancellableStatuses.includes(this.orderStatus);
};

// Instance method to check if order can be returned
orderSchema.methods.canReturn = function() {
  const returnableStatuses = ["delivered"];
  const returnWindow = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
  return returnableStatuses.includes(this.orderStatus) && 
         new Date() - new Date(this.updatedAt) <= returnWindow;
};

export const Order = mongoose.model("Order", orderSchema);