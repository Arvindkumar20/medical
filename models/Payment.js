import mongoose from "mongoose";
import validator from "validator";
import { v4 as uuidv4 } from 'uuid';

// Helper function for currency validation
const validateCurrency = (v) => {
  const validCurrencies = ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'AUD'];
  return validCurrencies.includes(v);
};
// Helper function for amount validation
const validateAmount = (v) => {
  return !isNaN(v) && v >= 0.01 && v <= 10000000; // 10 million upper limit
};
// Refund schema with enhanced validation
const refundSchema = new mongoose.Schema({
  refundId: {
    type: String,
    default: () => uuidv4(),
    unique: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    validate: {
      validator: validateAmount,
      message: "Refund amount must be between 0.01 and 10,000,000"
    }
  },
  reason: {
    type: String,
    trim: true,
    maxlength: [500, "Reason cannot exceed 500 characters"],
    required: [true, "Refund reason is required"]
  },
  refundedAt: {
    type: Date,
    default: Date.now
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  transactionId: {
    type: String,
    trim: true,
    required: [true, "Transaction ID is required for refunds"]
  },
  status: {
    type: String,
    enum: ["pending", "completed", "failed", "reversed"],
    default: "pending",
    index: true
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    validate: {
      validator: function(v) {
        return Object.keys(v).length <= 20; // Limit metadata keys
      },
      message: "Metadata cannot have more than 20 properties"
    }
  }
}, { 
  _id: false,
  timestamps: true 
});

// Payment method details with enhanced security
const paymentMethodDetailsSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["card", "upi", "net_banking", "wallet", "bank_transfer", "cash", "other"],
    required: true
  },
  cardBrand: {
    type: String,
    enum: ["visa", "mastercard", "amex", "discover", "rupay", "other"],
    required: function() { return this.type === 'card'; }
  },
  last4: {
    type: String,
    trim: true,
    validate: {
      validator: (v) => /^\d{4}$/.test(v),
      message: "Last 4 must be 4 digits"
    },
    required: function() { return this.type === 'card'; }
  },
  expMonth: {
    type: Number,
    min: 1,
    max: 12,
    required: function() { return this.type === 'card'; }
  },
  expYear: {
    type: Number,
    min: new Date().getFullYear(),
    max: new Date().getFullYear() + 20,
    required: function() { return this.type === 'card'; }
  },
  bank: {
    type: String,
    required: function() { return this.type === 'net_banking'; }
  },
  walletProvider: {
    type: String,
    required: function() { return this.type === 'wallet'; }
  },
  upiId: {
    type: String,
    validate: {
      validator: (v) => /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/.test(v),
      message: "Invalid UPI ID format"
    },
    required: function() { return this.type === 'upi'; }
  },
  fingerprint: {
    type: String,
    trim: true,
    index: true
  },
  network: String,
  billingDetails: {
    name: {
      type: String,
      trim: true,
      required: [true, "Billing name is required"],
      maxlength: [100, "Name cannot exceed 100 characters"]
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      validate: {
        validator: validator.isEmail,
        message: "Invalid email"
      }
    },
    phone: {
      type: String,
      validate: {
        validator: (v) => validator.isMobilePhone(v, 'any'),
        message: "Invalid phone number"
      }
    },
    address: {
      line1: {
        type: String,
        required: [true, "Address line 1 is required"],
        maxlength: [200, "Address line 1 cannot exceed 200 characters"]
      },
      line2: {
        type: String,
        maxlength: [200, "Address line 2 cannot exceed 200 characters"]
      },
      city: {
        type: String,
        required: [true, "City is required"],
        maxlength: [100, "City cannot exceed 100 characters"]
      },
      state: {
        type: String,
        required: [true, "State is required"],
        maxlength: [100, "State cannot exceed 100 characters"]
      },
      postal_code: {
        type: String,
        required: [true, "Postal code is required"],
        maxlength: [20, "Postal code cannot exceed 20 characters"]
      },
      country: {
        type: String,
        required: [true, "Country is required"],
        maxlength: [100, "Country cannot exceed 100 characters"]
      }
    }
  }
}, { 
  _id: false,
  toJSON: {
    transform: function(doc, ret) {
      // Never expose full card details in API responses
      if (ret.type === 'card') {
        delete ret.expMonth;
        delete ret.expYear;
      }
      return ret;
    }
  }
});

// Main payment schema with comprehensive validation
const paymentSchema = new mongoose.Schema({
  paymentId: {
    type: String,
    unique: true,
    required: true,
    index: true,
    default: () => `pay_${uuidv4()}`
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order",
    required: [true, "Order reference is required"],
    index: true
  },
  products: {
    type: [{
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true
      },
      quantity: {
        type: Number,
        required: true,
        min: [1, "Quantity must be at least 1"],
        validate: {
          validator: Number.isInteger,
          message: "Quantity must be integer"
        }
      },
      unitPrice: {
        type: Number,
        required: true,
        min: [0.0, "Price must be non-negative"]
      },
      totalPrice: {
        type: Number,
        required: true,
        min: [0.0, "Total price must be non-negative"],
        validate: {
          validator: function(v) {
            return v === this.unitPrice * this.quantity;
          },
          message: "Total price must equal unitPrice * quantity"
        }
      },
      taxRate: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
      },
      taxAmount: {
        type: Number,
        min: 0,
        default: 0
      }
    }],
    validate: {
      validator: function(v) {
        return v.length > 0;
      },
      message: "At least one product is required"
    }
  },
  payer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: [true, "Payer is required"],
    index: true
  },
  payee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Store",
    required: [true, "Payee is required"],
    index: true
  },
  amount: {
    type: Number,
    required: [true, "Payment amount is required"],
    validate: {
      validator: validateAmount,
      message: "Amount must be between 0.01 and 10,000,000"
    }
  },
  currency: {
    type: String,
    required: true,
    uppercase: true,
    default: "INR",
    validate: {
      validator: validateCurrency,
      message: "Unsupported currency"
    }
  },
  method: {
    type: String,
    enum: ["credit_card", "debit_card", "net_banking", "wallet", "upi", "bank_transfer", "cod", "other"],
    required: [true, "Payment method is required"],
    index: true
  },
  status: {
    type: String,
    enum: ["pending", "authorized", "captured", "failed", "refunded", "partially_refunded", "cancelled", "expired", "requires_action"],
    default: "pending",
    index: true
  },
  transactionId: {
    type: String,
    trim: true,
    index: true,
    required: function() {
      return this.status !== 'pending' && this.status !== 'requires_action';
    }
  },
  paymentIntentId: {
    type: String,
    trim: true,
    index: true
  },
  gateway: {
    name: {
      type: String,
      required: true,
      trim: true,
      enum: ["stripe", "razorpay", "paypal", "paytm", "instamojo", "ccavenue", "other"],
      index: true
    },
    version: String,
    rawResponse: {
      type: mongoose.Schema.Types.Mixed,
      validate: {
        validator: function(v) {
          try {
            JSON.stringify(v); // Ensure it's serializable
            return true;
          } catch (e) {
            return false;
          }
        },
        message: "Raw response must be JSON serializable"
      }
    },
    gatewayTransactionId: String,
    gatewayStatus: String
  },
  fees: {
    platformFee: {
      type: Number,
      default: 0,
      min: 0
    },
    gatewayFee: {
      type: Number,
      default: 0,
      min: 0
    },
    taxOnFees: {
      type: Number,
      default: 0,
      min: 0
    },
    breakdown: {
      type: [{
        type: {
          type: String,
          enum: ["processing", "service", "tax", "convenience", "other"],
          required: true
        },
        amount: {
          type: Number,
          required: true,
          min: 0
        },
        description: String
      }],
      default: []
    }
  },
  netAmount: {
    type: Number,
    required: true,
    min: 0,
    validate: {
      validator: function(v) {
        const calculated = this.amount - 
                         (this.fees?.platformFee || 0) - 
                         (this.fees?.gatewayFee || 0) - 
                         (this.fees?.taxOnFees || 0);
        return Math.abs(v - calculated) < 0.01; // Allow for floating point precision
      },
      message: "Net amount must equal amount minus all fees"
    }
  },
  taxes: {
    type: [{
      name: String,
      rate: Number,
      amount: Number,
      inclusive: Boolean
    }],
    default: []
  },
  paymentMethodDetails: {
    type: paymentMethodDetailsSchema,
    required: function() {
      return this.method !== 'cod'; // COD doesn't need payment details
    }
  },
  refunds: {
    type: [refundSchema],
    default: [],
    validate: {
      validator: function(v) {
        const totalRefunded = v.reduce((sum, refund) => {
          return refund.status === 'completed' ? sum + refund.amount : sum;
        }, 0);
        return totalRefunded <= this.amount;
      },
      message: "Total refunds cannot exceed payment amount"
    }
  },
  dispute: {
    type: {
      id: String,
      reason: {
        type: String,
        required: true,
        enum: ["fraudulent", "duplicate", "subscription_canceled", "product_unacceptable", "product_not_received", "unrecognized", "credit_not_processed", "other"]
      },
      openedAt: {
        type: Date,
        default: Date.now
      },
      status: {
        type: String,
        enum: ["open", "won", "lost", "under_review", "needs_response"],
        default: "open"
      },
      resolution: String,
      amount: Number,
      currency: String,
      evidence: [{
        type: {
          type: String,
          enum: ["document", "receipt", "customer_communication", "refund_policy", "shipping_documentation", "other"]
        },
        url: String,
        description: String
      }],
      dueBy: Date
    },
    default: null
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    validate: {
      validator: function(v) {
        return Object.keys(v).length <= 30; // Limit metadata keys
      },
      message: "Metadata cannot have more than 30 properties"
    }
  },
  risk: {
    score: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    reasons: {
      type: [String],
      enum: ["high_value", "new_customer", "unusual_location", "multiple_attempts", "suspicious_details", "other"],
      default: []
    },
    flagged: {
      type: Boolean,
      default: false
    },
    reviewed: {
      type: Boolean,
      default: false
    },
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    reviewNotes: String
  },
  ipAddress: {
    type: String,
    validate: {
      validator: validator.isIP,
      message: "Invalid IP address"
    }
  },
  userAgent: String,
  deviceFingerprint: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      // Security: Remove sensitive fields from JSON output
      delete ret.paymentMethodDetails?.billingDetails?.address;
      delete ret.ipAddress;
      delete ret.deviceFingerprint;
      delete ret.gateway?.rawResponse;
      return ret;
    }
  },
  toObject: { 
    virtuals: true,
    transform: function(doc, ret) {
      // Security: Remove sensitive fields from object output
      delete ret.paymentMethodDetails?.billingDetails?.address;
      delete ret.ipAddress;
      delete ret.deviceFingerprint;
      delete ret.gateway?.rawResponse;
      return ret;
    }
  }
});

// Virtuals
paymentSchema.virtual("grossAmount").get(function() {
  return this.amount;
});

paymentSchema.virtual("totalFees").get(function() {
  return (this.fees?.platformFee || 0) + 
         (this.fees?.gatewayFee || 0) + 
         (this.fees?.taxOnFees || 0);
});

paymentSchema.virtual("totalRefunded").get(function() {
  return this.refunds
    .filter(refund => refund.status === 'completed')
    .reduce((sum, refund) => sum + refund.amount, 0);
});

paymentSchema.virtual("refundableAmount").get(function() {
  return this.amount - this.totalRefunded;
});

paymentSchema.virtual("isRefundable").get(function() {
  return ['captured', 'partially_refunded'].includes(this.status) && 
         this.refundableAmount > 0;
});

// Indexes for optimized queries
paymentSchema.index({ payer: 1, status: 1 });
paymentSchema.index({ payee: 1, status: 1 });
paymentSchema.index({ createdAt: -1, status: 1 });
paymentSchema.index({ amount: 1, status: 1 });
paymentSchema.index({ "paymentMethodDetails.fingerprint": 1 });
paymentSchema.index({ "gateway.name": 1, "gateway.gatewayStatus": 1 });

// Pre-save hooks
paymentSchema.pre("save", function(next) {
  // Auto-set updatedBy if not provided
  if (!this.updatedBy && this.isModified()) {
    this.updatedBy = this.createdBy;
  }
  
  // Calculate taxes if not provided
  if (this.isModified('products') && this.products) {
    this.products.forEach(product => {
      if (!product.taxAmount && product.taxRate) {
        product.taxAmount = parseFloat((product.totalPrice * (product.taxRate / 100)).toFixed(2);
      }
    });
  }
  
  next();
});

paymentSchema.pre("validate", function(next) {
  // Calculate net amount if not set
  if (this.isModified("amount") || this.isModified("fees")) {
    const platformFee = this.fees?.platformFee || 0;
    const gatewayFee = this.fees?.gatewayFee || 0;
    const taxOnFees = this.fees?.taxOnFees || 0;
    this.netAmount = parseFloat((this.amount - platformFee - gatewayFee - taxOnFees).toFixed(2));
  }
  
  // Validate refund amounts
  if (this.isModified('refunds') && this.refunds) {
    const totalRefunded = this.totalRefunded;
    if (totalRefunded > this.amount) {
      throw new Error(`Total refunds (${totalRefunded}) exceed payment amount (${this.amount})`);
    }
    
    // Update status based on refunds
    if (totalRefunded > 0) {
      if (Math.abs(totalRefunded - this.amount) < 0.01) {
        this.status = 'refunded';
      } else if (this.status !== 'refunded') {
        this.status = 'partially_refunded';
      }
    }
  }
  
  next();
});

// Static methods
paymentSchema.statics.findByPaymentId = function(paymentId) {
  return this.findOne({ paymentId });
};

paymentSchema.statics.findByTransactionId = function(transactionId) {
  return this.findOne({ transactionId });
};

paymentSchema.statics.findByPayer = function(payerId, options = {}) {
  const { limit = 10, skip = 0, status } = options;
  const query = { payer: payerId };
  if (status) query.status = status;
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

// Instance methods
paymentSchema.methods.initiateRefund = function(refundData) {
  if (!this.isRefundable) {
    throw new Error(`Payment is not refundable. Current status: ${this.status}, refundable amount: ${this.refundableAmount}`);
  }
  
  if (refundData.amount > this.refundableAmount) {
    throw new Error(`Refund amount (${refundData.amount}) exceeds refundable amount (${this.refundableAmount})`);
  }
  
  this.refunds.push({
    ...refundData,
    status: 'pending'
  });
  
  return this.save();
};

paymentSchema.methods.updateStatus = function(newStatus, updatedBy) {
  const allowedTransitions = {
    pending: ['authorized', 'failed', 'cancelled', 'requires_action'],
    authorized: ['captured', 'failed', 'cancelled'],
    captured: ['refunded', 'partially_refunded'],
    requires_action: ['authorized', 'failed', 'cancelled'],
    partially_refunded: ['refunded']
  };
  
  if (!allowedTransitions[this.status]?.includes(newStatus)) {
    throw new Error(`Invalid status transition from ${this.status} to ${newStatus}`);
  }
  
  this.status = newStatus;
  this.updatedBy = updatedBy;
  return this.save();
};

// Middleware for cascading updates
paymentSchema.post('save', async function(doc) {
  // Update related order status if payment is completed
  if (['captured', 'authorized'].includes(doc.status)) {
    try {
      const Order = mongoose.model('Order');
      await Order.updateOne(
        { _id: doc.order },
        { $set: { paymentStatus: 'paid' } }
      );
    } catch (err) {
      console.error(`Error updating order status for payment ${doc.paymentId}:`, err);
    }
  }
});

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;