import express from 'express';
import {
  createDoctorProfile,
  getDoctorProfiles,
  getDoctorProfile,
  updateDoctorProfile,
  deleteDoctorProfile,
  searchDoctors,
  getMyDoctorProfile
} from '../controllers/doctorController.js';

import { authorize, checkProfileOwnership, protect } from '../middlewares/authMiddleware.js';
import { validateCreateDoctorProfile, validateIdParam, validateQueryParams, validateUpdateDoctorProfile } from '../middlewares/doctorValidation.js';

const router = express.Router();

// All routes are protected
router.use(protect);

// Get current user's doctor profile
router.get('/me', getMyDoctorProfile);

// Search doctors by location and specialty
router.get('/search', searchDoctors);

// Get all doctor profiles (with filtering and pagination)
router.get('/', validateQueryParams, getDoctorProfiles);

// Get doctor profile by ID
router.get('/:id', validateIdParam, getDoctorProfile);

// Create a new doctor profile (only for users with doctor role)
router.post(
  '/',
  authorize('doctor', 'admin'),
  validateCreateDoctorProfile,
  createDoctorProfile
);

// Update doctor profile (only profile owner or admin)
router.put(
  '/:id',
  authorize('doctor', 'admin'),
  validateIdParam,
  validateUpdateDoctorProfile,
  checkProfileOwnership,
  updateDoctorProfile
);

// Delete doctor profile (only profile owner or admin)
router.delete(
  '/:id',
  authorize('doctor', 'admin'),
  validateIdParam,
  checkProfileOwnership,
  deleteDoctorProfile
);

export const doctorRouter= router;