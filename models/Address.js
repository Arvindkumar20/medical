// models/Address.js
// const mongoose = require('mongoose');
// const validator = require('validator');

import mongoose from "mongoose";

import validator from "validator";
const addressSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required'],
    validate: {
      validator: async function (v) {
        const user = await mongoose.model('User').findById(v);
        return !!user;
      },
      message: 'User reference must point to a valid user'
    }
  },
  label: {
    type: String,
    trim: true,
    maxlength: [30, 'Label cannot exceed 30 characters'],
    enum: {
      values: ['home', 'work', 'other'],
      message: 'Label must be either home, work, or other'
    },
    default: 'home'
  },
  street: {
    type: String,
    // required: [true, 'Street address is required'],
    trim: true,
    maxlength: [200, 'Street address cannot exceed 200 characters']
  },
  street2: {
    type: String,
    trim: true,
    maxlength: [200, 'Secondary street cannot exceed 200 characters']
  },
  city: {
    type: String,
    // required: [true, 'City is required'],
    trim: true,
    maxlength: [100, 'City name cannot exceed 100 characters']
  },
  state: {
    type: String,
    // required: [true, 'State is required'],
    trim: true,
    maxlength: [100, 'State name cannot exceed 100 characters']
  },
  country: {
    type: String,
    // required: [true, 'Country is required'],
    trim: true,
    maxlength: [100, 'Country name cannot exceed 100 characters'],
    // validate: {
    //   validator: function (v) {
    //     return validator.isISO31661Alpha2(v) || validator.isISO31661Alpha3(v);
    //   },
    //   message: 'Please provide a valid ISO country code (2 or 3 letters)'
    // }
  },
  postalCode: {
    type: String,
    // required: [true, 'Postal code is required'],
    trim: true,
    // validate: {
    //   validator: function (v) {
    //     // Basic validation for international postal codes
    //     return /^[a-zA-Z0-9\- ]{3,10}$/.test(v);
    //   },
    //   message: 'Invalid postal code format'
    // }
  },

  coordinates: {
    type: [Number],
    required: [true, 'Coordinates are required'],
    validate: {
      validator: function (v) {
        return (
          Array.isArray(v) &&
          v.length === 2 &&
          v[0] >= -180 && v[0] <= 180 && // longitude validation
          v[1] >= -90 && v[1] <= 90    // latitude validation
        );
      },
      message: 'Coordinates must be valid [longitude, latitude] values'
    }
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  contactNumber: {
    type: String,
    // required: [true, 'Contact number is required'],
    validate: {
      validator: function (v) {
        return validator.isMobilePhone(v, 'any', { strictMode: false });
      },
      message: 'Please provide a valid phone number'
    }
  },
  contactPerson: {
    type: String,
    trim: true,
    maxlength: [100, 'Contact person name cannot exceed 100 characters']
  },
  additionalInstructions: {
    type: String,
    trim: true,
    maxlength: [500, 'Additional instructions cannot exceed 500 characters']
  },
  verificationStatus: {
    type: String,
    enum: {
      values: ['unverified', 'pending', 'verified', 'rejected'],
      message: 'Invalid verification status'
    },
    default: 'unverified'
  },
  verificationDate: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// 2dsphere index for geospatial queries
addressSchema.index({ coordinates: '2dsphere' });

// Indexes for better performance
addressSchema.index({ user: 1 });
addressSchema.index({ isDefault: 1 });
addressSchema.index({ isActive: 1 });
addressSchema.index({ country: 1, state: 1, city: 1 });

// Ensure only one default address per user
addressSchema.pre('save', async function (next) {
  if (this.isDefault) {
    await mongoose.model('Address').updateMany(
      { user: this.user, isDefault: true },
      { $set: { isDefault: false } }
    );
  }
  next();
});

// Virtual for formatted address
addressSchema.virtual('formattedAddress').get(function () {
  return `${this.street}${this.street2 ? ', ' + this.street2 : ''}, ${this.city}, ${this.state} ${this.postalCode}, ${this.country}`;
});

// Static method to get user's default address
addressSchema.statics.getDefaultAddress = async function (userId) {
  return this.findOne({ user: userId, isDefault: true });
};

// Static method to verify address
addressSchema.statics.verifyAddress = async function (addressId, status) {
  return this.findByIdAndUpdate(addressId, {
    verificationStatus: status,
    verificationDate: status === 'verified' ? new Date() : null
  }, { new: true });
};

// Instance method to check if address is verified
addressSchema.methods.isVerified = function () {
  return this.verificationStatus === 'verified';
};

export const Address = mongoose.model('Address', addressSchema);