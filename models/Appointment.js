// models/Appointment.js
import mongoose from "mongoose";
import validator from "validator";
import { isAfter, addMinutes, isBefore } from "date-fns";

const appointmentSchema = new mongoose.Schema({
  patient: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User",
    required: [true, "Patient ID is required"],
    validate: {
      validator: async function(value) {
        const user = await mongoose.model("User").findById(value);
        return user && user.role === "patient";
      },
      message: "Patient ID must reference a valid patient user"
    }
  },
  doctor: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User",
    required: [true, "Doctor ID is required"],
    validate: {
      validator: async function(value) {
        const user = await mongoose.model("User").findById(value);
        return user && user.role === "doctor";
      },
      message: "Doctor ID must reference a valid doctor user"
    }
  },
  symptoms: {
    type: String,
    required: [true, "Symptoms description is required"],
    minlength: [10, "Symptoms description must be at least 10 characters"],
    maxlength: [500, "Symptoms description cannot exceed 500 characters"],
    trim: true
  },
  status: { 
    type: String, 
    enum: ["pending", "confirmed", "cancelled", "completed"],
    default: "pending" 
  },
  date: {
    type: Date,
    required: [true, "Appointment date is required"],
    validate: {
      validator: function(value) {
        const now = new Date();
        const minDate = addMinutes(now, 24 * 60); // 24 hours ahead
        return isAfter(value, minDate);
      },
      message: "Appointment must be scheduled at least 24 hours in advance"
    }
  },
  time: {
    type: String,
    required: [true, "Appointment time is required"],
    validate: {
      validator: (value) => /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value),
      message: "Time must be in HH:MM format (24-hour clock)"
    }
  },
  duration: {
    type: Number,
    default: 30,
    min: [15, "Minimum appointment duration is 15 minutes"],
    max: [120, "Maximum appointment duration is 120 minutes"]
  },
  prescriptionGiven: { 
    type: Boolean, 
    default: false,
    validate: {
      validator: function(value) {
        if (value && this.status !== "completed") return false;
        return true;
      },
      message: "Prescription can only be given for completed appointments"
    }
  },
  notes: {
    type: String,
    maxlength: [1000, "Notes cannot exceed 1000 characters"],
    trim: true
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for endTime
appointmentSchema.virtual("endTime").get(function() {
  if (!this.time || !this.duration || !this.date) return null;
  const [hours, minutes] = this.time.split(":").map(Number);
  const start = new Date(this.date);
  start.setHours(hours, minutes, 0, 0);
  return addMinutes(start, this.duration);
});

// Prevent modifications if cancelled/completed (except marking completed after time)
appointmentSchema.pre("save", function(next) {
  if (!this.isNew && this.isModified() && ["cancelled"].includes(this.status)) {
    // cannot modify into cancelled if in past? handled elsewhere
  }
  next();
});

// Overlap checking for doctor and patient
appointmentSchema.pre("save", async function(next) {
  // only check if date/time/duration/doctor/patient changed or new
  if (!this.isNew && !this.isModified("date") && !this.isModified("time") && !this.isModified("duration") && !this.isModified("doctor") && !this.isModified("patient")) {
    return next();
  }

  const buildWindow = (dateObj, timeStr, duration) => {
    const [h, m] = timeStr.split(":").map(Number);
    const start = new Date(dateObj);
    start.setHours(h, m, 0, 0);
    const end = addMinutes(start, duration);
    return { start, end };
  };

  const { start: thisStart, end: thisEnd } = buildWindow(this.date, this.time, this.duration);

  // Helper to detect overlap
  const overlaps = (aStart, aEnd, bStart, bEnd) => !(aEnd <= bStart || aStart >= bEnd);

  // Check doctor
  const doctorConflicts = await mongoose.model("Appointment").find({
    _id: { $ne: this._id },
    doctor: this.doctor,
    status: { $in: ["pending", "confirmed"] },
    date: this.date
  }).lean();

  for (const appt of doctorConflicts) {
    const [h, m] = appt.time.split(":").map(Number);
    const apptStart = new Date(appt.date);
    apptStart.setHours(h, m, 0, 0);
    const apptEnd = addMinutes(apptStart, appt.duration);
    if (overlaps(thisStart, thisEnd, apptStart, apptEnd)) {
      const err = new Error("Doctor has conflicting appointment at this time");
      err.name = "ValidationError";
      return next(err);
    }
  }

  // Check patient
  const patientConflicts = await mongoose.model("Appointment").find({
    _id: { $ne: this._id },
    patient: this.patient,
    status: { $in: ["pending", "confirmed"] },
    date: this.date
  }).lean();

  for (const appt of patientConflicts) {
    const [h, m] = appt.time.split(":").map(Number);
    const apptStart = new Date(appt.date);
    apptStart.setHours(h, m, 0, 0);
    const apptEnd = addMinutes(apptStart, appt.duration);
    if (overlaps(thisStart, thisEnd, apptStart, apptEnd)) {
      const err = new Error("Patient has conflicting appointment at this time");
      err.name = "ValidationError";
      return next(err);
    }
  }

  // Can't cancel or modify to cancelled/completed if appointment is in past and status change invalid
  const now = new Date();
  if (this.isModified("status")) {
    const apptDateTime = new Date(this.date);
    const [h, m] = this.time.split(":").map(Number);
    apptDateTime.setHours(h, m, 0, 0);

    if (isBefore(apptDateTime, now) && this.status === "cancelled") {
      const err = new Error("Cannot cancel an appointment that has already passed");
      err.name = "ValidationError";
      return next(err);
    }
  }

  next();
});

export const Appointment = mongoose.model("Appointment", appointmentSchema);

