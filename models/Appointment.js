import mongoose from 'mongoose';

const appointmentSchema = new mongoose.Schema(
  {
    doctor: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'DoctorProfile', 
      required: true,
      index: true 
    },
    patient: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User', 
      required: true,
      index: true 
    },
    appointmentDate: { 
      type: Date, 
      required: true,
      validate: {
        validator: function(date) {
          return date > new Date();
        },
        message: 'Appointment date must be in the future'
      }
    },
    timeSlot: {
      start: { type: Date, required: true },
      end: { type: Date, required: true },
    },
    duration: { 
      type: Number, 
      required: true,
      min: 5,
      max: 240, // 4 hours max
      validate: {
        validator: Number.isInteger,
        message: 'Duration must be an integer'
      }
    },
    timeLabel: { 
      type: String,
      required: true 
    }, // e.g., '10:15-10:30'
    consultationType: { 
      type: String, 
      enum: ['online', 'in_clinic', 'home_visit'], 
      default: 'online',
      required: true 
    },
    status: { 
      type: String, 
      enum: ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'], 
      default: 'pending',
      index: true 
    },
    paymentStatus: { 
      type: String, 
      enum: ['unpaid', 'pending', 'paid', 'refunded', 'partially_refunded', 'failed'], 
      default: 'unpaid',
      index: true 
    },
    reason: { 
      type: String,
      maxLength: 500 
    }, // patient reason for visit
    symptoms: [{ type: String }], // structured symptom tracking
    diagnosis: { type: String }, // doctor's diagnosis
    prescription: [{ // structured prescription data
      medication: { type: String, required: true },
      dosage: { type: String, required: true },
      frequency: { type: String, required: true },
      duration: { type: String, required: true } // e.g., "7 days"
    }],
    notes: { 
      type: String,
      maxLength: 1000 
    }, // doctor notes
    followUpDate: { type: Date }, // if a follow-up is needed
    cancellationReason: { type: String }, // if appointment is cancelled
    cancelledBy: { // who cancelled the appointment
      type: String,
      enum: ['patient', 'doctor', 'system', 'admin']
    },
    cancellationTime: { type: Date }, // when it was cancelled
    // Payment information
    amount: { 
      type: Number, 
      required: true,
      min: 0 
    },
    currency: {
      type: String,
      default: 'USD',
      enum: ['USD', 'EUR', 'GBP', 'INR'] // Add more as needed
    },
    paymentMethod: {
      type: String,
      enum: ['credit_card', 'debit_card', 'paypal', 'bank_transfer', 'cash', null],
      default: null
    },
    paymentId: { type: String }, // reference to payment gateway
    refundAmount: { type: Number, default: 0 },
    // For video consultations
    meetingUrl: { type: String },
    meetingId: { type: String },
    meetingPassword: { type: String },
    // For reminders and notifications
    remindersSent: {
      sms: { type: Boolean, default: false },
      email: { type: Boolean, default: false },
      push: { type: Boolean, default: false }
    },
    lastReminderSent: { type: Date },
    // For analytics
    bookingSource: {
      type: String,
      enum: ['web', 'mobile_app', 'phone', 'admin', 'partner'],
      default: 'web'
    },
    // Soft delete flag
    isActive: {
      type: Boolean,
      default: true,
      select: false
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for checking if appointment is upcoming
appointmentSchema.virtual('isUpcoming').get(function() {
  return this.timeSlot.end > new Date() && this.status === 'confirmed';
});

// Virtual for checking if appointment can be cancelled
appointmentSchema.virtual('canBeCancelled').get(function() {
  const hoursUntilAppointment = (this.timeSlot.start - new Date()) / (1000 * 60 * 60);
  return hoursUntilAppointment > 24 && ['pending', 'confirmed'].includes(this.status);
});

// Compound indexes for common query patterns
appointmentSchema.index({ doctor: 1, appointmentDate: 1 });
appointmentSchema.index({ patient: 1, appointmentDate: 1 });
appointmentSchema.index({ status: 1, appointmentDate: 1 });
appointmentSchema.index({ 
  doctor: 1, 
  patient: 1, 
  status: 1 
});

// Pre-save middleware to validate time slot
appointmentSchema.pre('save', function(next) {
  if (this.timeSlot.start >= this.timeSlot.end) {
    next(new Error('End time must be after start time'));
  }
  next();
});

// Static method to find appointments by doctor and date range
appointmentSchema.statics.findByDoctorAndDateRange = function(doctorId, startDate, endDate) {
  return this.find({
    doctor: doctorId,
    appointmentDate: {
      $gte: startDate,
      $lte: endDate
    },
    isActive: true
  }).populate('patient', 'name email phone');
};

// Static method to check slot availability
appointmentSchema.statics.isSlotAvailable = function(doctorId, startTime, endTime) {
  return this.findOne({
    doctor: doctorId,
    $or: [
      {
        $and: [
          { 'timeSlot.start': { $lt: endTime } },
          { 'timeSlot.end': { $gt: startTime } }
        ]
      }
    ],
    status: { $in: ['pending', 'confirmed'] },
    isActive: true
  }).then(existingAppointment => {
    return !existingAppointment;
  });
};

// Instance method to cancel appointment
appointmentSchema.methods.cancel = function(reason, cancelledBy) {
  if (!['pending', 'confirmed'].includes(this.status)) {
    throw new Error('Cannot cancel appointment with current status');
  }
  
  this.status = 'cancelled';
  this.cancellationReason = reason;
  this.cancelledBy = cancelledBy;
  this.cancellationTime = new Date();
  
  return this.save();
};

// Instance method to reschedule appointment
appointmentSchema.methods.reschedule = function(newStart, newEnd, newDate) {
  if (this.status === 'cancelled' || this.status === 'completed') {
    throw new Error('Cannot reschedule appointment with current status');
  }
  
  if (newStart >= newEnd) {
    throw new Error('End time must be after start time');
  }
  
  this.timeSlot.start = newStart;
  this.timeSlot.end = newEnd;
  this.appointmentDate = newDate;
  
  // Update timeLabel based on new times
  const formatTime = date => date.toTimeString().slice(0, 5);
  this.timeLabel = `${formatTime(newStart)}-${formatTime(newEnd)}`;
  
  return this.save();
};

// Query helper to exclude inactive appointments
appointmentSchema.query.active = function() {
  return this.where({ isActive: true });
};

export const Appointment = mongoose.model('Appointment', appointmentSchema);