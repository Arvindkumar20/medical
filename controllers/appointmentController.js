// controllers/appointmentController.js
import {Appointment} from "../models/Appointment.js";
import { validationResult } from "express-validator";
import {logger} from "../utils/logger.js";

// Build filter
const buildFilter = (query, user) => {
  const filter = {};
  if (query.patient) filter.patient = query.patient;
  if (query.doctor) filter.doctor = query.doctor;
  if (query.status) filter.status = query.status;
  if (query.date) {
    const d = new Date(query.date);
    if (!isNaN(d)) filter.date = d;
  }

  // enforce role-based visibility
  if (user) {
    if (user.role === "patient") filter.patient = user.id;
    else if (user.role === "doctor") filter.doctor = user.id;
  }

  return filter;
};

// GET /api/appointments
export const listAppointments = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const filter = buildFilter(req.query, req.user);

    const [total, appointments] = await Promise.all([
      Appointment.countDocuments(filter),
      Appointment.find(filter)
        .sort({ date: 1, time: 1 })
        .skip(skip)
        .limit(limit)
        .populate("patient", "name email")
        .populate("doctor", "name email")
        .lean()
    ]);

    res.json({
      success: true,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      data: appointments
    });
  } catch (err) {
    logger.error("listAppointments error:", { message: err.message, stack: err.stack });
    next(err);
  }
};

// GET /api/appointments/:id
export const getAppointment = async (req, res, next) => {
  try {
    const appt = await Appointment.findById(req.params.id)
      .populate("patient", "name email")
      .populate("doctor", "name email")
      .lean();
    if (!appt) return res.status(404).json({ success: false, message: "Appointment not found" });

    const uid = req.user?.id;
    if (
      req.user?.role !== "admin" &&
      appt.patient._id.toString() !== uid &&
      appt.doctor._id.toString() !== uid
    ) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    res.json({ success: true, data: appt });
  } catch (err) {
    logger.error("getAppointment error:", { message: err.message, stack: err.stack });
    next(err);
  }
};

// POST /api/appointments
export const createAppointment = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn("Validation failed createAppointment", { errors: errors.array() });
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    if (req.user && req.user.role === "patient") {
      req.body.patient = req.user.id;
    }

    const appointment = await Appointment.create(req.body);
    res.status(201).json({ success: true, data: appointment });
  } catch (err) {
    logger.error("createAppointment error:", { message: err.message, stack: err.stack, body: req.body });
    next(err);
  }
};

// PATCH /api/appointments/:id
export const updateAppointment = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn("Validation failed updateAppointment", { errors: errors.array() });
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const appt = await Appointment.findById(req.params.id);
    if (!appt) return res.status(404).json({ success: false, message: "Appointment not found" });

    const uid = req.user?.id;
    const role = req.user?.role;

    if (role === "patient" && appt.patient.toString() !== uid) return res.status(403).json({ success: false, message: "Forbidden" });
    if (role === "doctor" && appt.doctor.toString() !== uid) return res.status(403).json({ success: false, message: "Forbidden" });

    const allowed = ["symptoms", "status", "notes", "duration", "time", "date"];
    if (role === "doctor" || role === "admin") {
      allowed.push("prescriptionGiven");
    }

    allowed.forEach(field => {
      if (req.body[field] !== undefined) {
        appt[field] = req.body[field];
      }
    });

    await appt.save();
    res.json({ success: true, data: appt });
  } catch (err) {
    logger.error("updateAppointment error:", { message: err.message, stack: err.stack });
    next(err);
  }
};

// DELETE /api/appointments/:id  (cancel)
export const cancelAppointment = async (req, res, next) => {
  try {
    const appt = await Appointment.findById(req.params.id);
    if (!appt) return res.status(404).json({ success: false, message: "Appointment not found" });

    const uid = req.user?.id;
    const role = req.user?.role;

    if (role !== "admin" && appt.patient.toString() !== uid && appt.doctor.toString() !== uid) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    if (["cancelled", "completed"].includes(appt.status)) {
      return res.status(400).json({ success: false, message: `Cannot cancel a ${appt.status} appointment` });
    }

    appt.status = "cancelled";
    await appt.save();
    res.json({ success: true, data: appt });
  } catch (err) {
    logger.error("cancelAppointment error:", { message: err.message, stack: err.stack });
    next(err);
  }
};
