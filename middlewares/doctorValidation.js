import { body, param, query } from 'express-validator';
import { DoctorProfile } from '../models/DoctorProfile.js';

export const validateCreateDoctorProfile = [
  body('specialization')
    .notEmpty()
    .withMessage('Specialization is required')
    .isLength({ max: 100 })
    .withMessage('Specialization must be less than 100 characters'),
  
  body('qualifications')
    .optional()
    .isArray()
    .withMessage('Qualifications must be an array'),
  
  body('qualifications.*')
    .isLength({ max: 200 })
    .withMessage('Each qualification must be less than 200 characters'),
  
  body('experienceYears')
    .optional()
    .isInt({ min: 0, max: 60 })
    .withMessage('Experience years must be between 0 and 60'),
  
  body('consultationFee')
    .isFloat({ min: 0, max: 10000 })
    .withMessage('Consultation fee must be between 0 and 10000'),
  
  body('clinicName')
    .optional()
    .isLength({ max: 150 })
    .withMessage('Clinic name must be less than 150 characters'),
  
  body('clinicAddress.street')
    .optional()
    .isLength({ max: 150 })
    .withMessage('Street address must be less than 150 characters'),
  
  body('clinicAddress.city')
    .optional()
    .isLength({ max: 50 })
    .withMessage('City must be less than 50 characters'),
  
  body('clinicAddress.state')
    .optional()
    .isLength({ max: 50 })
    .withMessage('State must be less than 50 characters'),
  
  body('clinicAddress.country')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Country must be less than 50 characters'),
  
  body('clinicAddress.zipCode')
    .optional()
    .isLength({ max: 20 })
    .withMessage('Zip code must be less than 20 characters'),
  
  body('location.coordinates')
    .isArray({ min: 2, max: 2 })
    .withMessage('Coordinates must be an array of two numbers [longitude, latitude]'),
  
  body('location.coordinates.*')
    .isFloat()
    .withMessage('Coordinates must be numbers'),
  
  body('contactInfo.phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),
  
  body('consultationTypes')
    .isArray({ min: 1 })
    .withMessage('At least one consultation type is required'),
  
  body('consultationTypes.*')
    .isIn(['online', 'in_clinic', 'home_visit'])
    .withMessage('Invalid consultation type'),
  
  body('availableDays')
    .optional()
    .isArray()
    .withMessage('Available days must be an array'),
  
  body('availableDays.*')
    .isIn(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
    .withMessage('Invalid day value'),
  
  body('dailyTimeWindows')
    .optional()
    .isArray()
    .withMessage('Daily time windows must be an array'),
  
  body('dailyTimeWindows.*.start')
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Start time must be in HH:MM format'),
  
  body('dailyTimeWindows.*.end')
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('End time must be in HH:MM format'),
  
  body('slotDurationMin')
    .optional()
    .isInt({ min: 5, max: 120 })
    .withMessage('Slot duration must be between 5 and 120 minutes'),
  
  body('maxBookingsPerSlot')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('Max bookings per slot must be between 1 and 10')
];

export const validateUpdateDoctorProfile = [
  param('id')
    .isMongoId()
    .withMessage('Invalid doctor profile ID'),
  
  body('specialization')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Specialization must be less than 100 characters'),
  
  // Include other validation rules as needed, making them optional
  // Similar to validateCreateDoctorProfile but with .optional()
];

export const validateIdParam = [
  param('id')
    .isMongoId()
    .withMessage('Invalid doctor profile ID')
];

export const validateQueryParams = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('specialization')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Specialization filter too long'),
  
  query('city')
    .optional()
    .isLength({ max: 50 })
    .withMessage('City filter too long')
];