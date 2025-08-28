import express from 'express';
import {
  createAppointment,
  getAppointments,
  getAppointment,
  updateAppointment,
  cancelAppointment,
  confirmAppointment,
  completeAppointment,
  rescheduleAppointment,
  checkAvailability
} from '../controllers/appointmentController.js';
import { authorize, protect } from '../middlewares/authMiddleware.js';
import { validateAvailabilityCheck, validateCreateAppointment, validateReschedule, validateUpdateAppointment } from '../middlewares/appointmentValidation.js';
import { validateIdParam, validateQueryParams } from '../middlewares/doctorValidation.js';
import { checkAppointmentOwnership, checkDoctorAppointment } from '../middlewares/appointmentAuth.js';
// import {
//   validateCreateAppointment,
//   validateUpdateAppointment,
//   validateIdParam,
//   validateQueryParams,
//   validateReschedule,
//   validateAvailabilityCheck
// } from '../validations/appointmentValidation.js';
// import { authenticate, authorize } from '../middleware/auth.js';
// import { checkAppointmentOwnership, checkDoctorAppointment } from '../middleware/appointmentAuth.js';

const router = express.Router();

// All routes are protected
router.use(protect);

// Check availability
router.get('/availability', validateAvailabilityCheck, checkAvailability);

// Get all appointments (with filtering and pagination)
router.get('/', validateQueryParams, getAppointments);

// Get appointment by ID
router.get('/:id', validateIdParam, checkAppointmentOwnership, getAppointment);

// Create a new appointment (patients and admins only)
router.post(
  '/',
  authorize('patient', 'admin','customer'),
  validateCreateAppointment,
  createAppointment
);

// Update appointment (patient can update reason, doctor can update notes, diagnosis, etc.)
router.put(
  '/:id',
  validateIdParam,
  validateUpdateAppointment,
  checkAppointmentOwnership,
  updateAppointment
);

// Cancel appointment (patient, doctor, or admin)
router.patch(
  '/:id/cancel',
  validateIdParam,
  checkAppointmentOwnership,
  cancelAppointment
);

// Confirm appointment (doctor only)
router.patch(
  '/:id/confirm',
  validateIdParam,
  authorize('doctor', 'admin'),
  checkDoctorAppointment,
  confirmAppointment
);

// Complete appointment (doctor only)
router.patch(
  '/:id/complete',
  validateIdParam,
  authorize('doctor', 'admin'),
  checkDoctorAppointment,
  completeAppointment
);

// Reschedule appointment (patient or admin)
router.patch(
  '/:id/reschedule',
  validateIdParam,
  validateReschedule,
  authorize('patient', 'admin'),
  checkAppointmentOwnership,
  rescheduleAppointment
);

export const appointmentRouter= router;