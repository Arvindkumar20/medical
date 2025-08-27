import mongoose from 'mongoose';
import validator from 'validator';
import bcrypt from 'bcryptjs'; // If handling any sensitive data

const timeSlotSchema = new mongoose.Schema({
  start: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
      },
      message: props => `${props.value} is not a valid time format! Use HH:MM format.`
    }
  },
  end: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
      },
      message: props => `${props.value} is not a valid time format! Use HH:MM format.`
    }
  }
});

const doctorProfileSchema = new mongoose.Schema(
  {
    user: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User', 
      required: true, 
      unique: true,
      index: true 
    },
    specialization: { 
      type: String, 
      required: true,
      trim: true,
      maxLength: 100
    },
    qualifications: [{ 
      type: String, 
      trim: true,
      maxLength: 200 
    }],
    experienceYears: { 
      type: Number, 
      default: 0,
      min: 0,
      max: 60
    },
    consultationFee: { 
      type: Number, 
      required: true,
      min: 0,
      max: 10000
    },
    clinicName: { 
      type: String, 
      trim: true,
      maxLength: 150 
    },
    clinicAddress: {
      street: { type: String, trim: true, maxLength: 150 },
      city: { type: String, trim: true, maxLength: 50 },
      state: { type: String, trim: true, maxLength: 50 },
      country: { type: String, trim: true, maxLength: 50 },
      zipCode: { type: String, trim: true, maxLength: 20 }
    },
    location: {
      type: { 
        type: String, 
        enum: ['Point'], 
        default: 'Point',
        required: true 
      },
      coordinates: { 
        type: [Number], 
        default: [0, 0],
        required: true,
        validate: {
          validator: function(coords) {
            return coords.length === 2 && 
                   coords[0] >= -180 && coords[0] <= 180 &&
                   coords[1] >= -90 && coords[1] <= 90;
          },
          message: 'Coordinates must be valid [longitude, latitude] values'
        }
      }
    },
    contactInfo: {
      phone: {
        type: String,
        trim: true,
        validate: {
          validator: function(v) {
            return validator.isMobilePhone(v, 'any', { strictMode: false });
          },
          message: props => `${props.value} is not a valid phone number!`
        }
      },
      emergencyContact: {
        type: String,
        trim: true
      }
    },
    consultationTypes: { 
      type: [String], 
      enum: ['online', 'in_clinic', 'home_visit'], 
      default: ['online', 'in_clinic'],
      validate: {
        validator: function(types) {
          return types && types.length > 0;
        },
        message: 'At least one consultation type is required'
      }
    },
    availableDays: [{ 
      type: String, 
      enum: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] 
    }],
    dailyTimeWindows: [timeSlotSchema],
    slotDurationMin: { 
      type: Number, 
      default: 15,
      min: 5,
      max: 120,
      validate: {
        validator: Number.isInteger,
        message: 'Slot duration must be an integer'
      }
    },
    maxBookingsPerSlot: { 
      type: Number, 
      default: 1,
      min: 1,
      max: 10,
      validate: {
        validator: Number.isInteger,
        message: 'Max bookings per slot must be an integer'
      }
    },
    isVerified: { 
      type: Boolean, 
      default: false 
    },
    verificationDetails: {
      submittedAt: Date,
      verifiedAt: Date,
      verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
      documents: [{
        type: { type: String, enum: ['license', 'certificate', 'id_proof'] },
        url: String,
        uploadedAt: { type: Date, default: Date.now }
      }]
    },
    rating: { 
      type: Number, 
      default: 0,
      min: 0,
      max: 5
    },
    reviewCount: { 
      type: Number, 
      default: 0,
      min: 0
    },
    // For soft deletion
    isActive: {
      type: Boolean,
      default: true,
      select: false
    },
    // Track profile completeness for analytics
    profileCompletion: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for formatted address
doctorProfileSchema.virtual('clinicAddress.formatted').get(function() {
  if (!this.clinicAddress) return '';
  const addr = this.clinicAddress;
  return `${addr.street}, ${addr.city}, ${addr.state} ${addr.zipCode}, ${addr.country}`;
});

// Index for frequently queried fields
doctorProfileSchema.index({ specialization: 1, isVerified: 1 });
doctorProfileSchema.index({ 'clinicAddress.city': 1, 'clinicAddress.state': 1 });
doctorProfileSchema.index({ rating: -1, reviewCount: -1 });
doctorProfileSchema.index({ location: '2dsphere' });

// Compound index for availability queries
doctorProfileSchema.index({ 
  availableDays: 1, 
  'dailyTimeWindows.start': 1, 
  'dailyTimeWindows.end': 1 
});

// Pre-save middleware to calculate profile completion
doctorProfileSchema.pre('save', function(next) {
  if (this.isModified()) {
    const totalFields = 10; // Adjust based on important fields
    let completedFields = 0;
    
    if (this.specialization) completedFields++;
    if (this.qualifications && this.qualifications.length > 0) completedFields++;
    if (this.consultationFee !== undefined) completedFields++;
    if (this.clinicName) completedFields++;
    if (this.clinicAddress && this.clinicAddress.street) completedFields++;
    if (this.contactInfo && this.contactInfo.phone) completedFields++;
    if (this.availableDays && this.availableDays.length > 0) completedFields++;
    if (this.dailyTimeWindows && this.dailyTimeWindows.length > 0) completedFields++;
    if (this.experienceYears !== undefined) completedFields++;
    if (this.verificationDetails && this.verificationDetails.documents.length > 0) completedFields++;
    
    this.profileCompletion = Math.round((completedFields / totalFields) * 100);
  }
  next();
});

// Static method to find doctors by location and specialty
doctorProfileSchema.statics.findByLocationAndSpecialty = function(coordinates, maxDistance, specialty) {
  return this.find({
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates
        },
        $maxDistance: maxDistance
      }
    },
    specialization: new RegExp(specialty, 'i'),
    isVerified: true,
    isActive: true
  });
};

// Instance method to check availability
doctorProfileSchema.methods.isAvailableOn = function(day, time) {
  if (!this.availableDays.includes(day)) return false;
  
  return this.dailyTimeWindows.some(window => {
    const windowStart = window.start;
    const windowEnd = window.end;
    return time >= windowStart && time <= windowEnd;
  });
};

// Query helper to exclude inactive profiles
doctorProfileSchema.query.active = function() {
  return this.where({ isActive: true });
};

export const DoctorProfile = mongoose.model('DoctorProfile', doctorProfileSchema);