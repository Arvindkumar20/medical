import { body, param, query } from 'express-validator';
import mongoose from 'mongoose';
import moment from 'moment-timezone';

export const validateCreateAppointment = [
  body('doctor')
    .notEmpty()
    .withMessage('Doctor ID is required')
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage('Invalid doctor ID'),
  
  body('appointmentDate')
    .notEmpty()
    .withMessage('Appointment date is required')
    .isISO8601()
    .withMessage('Invalid date format')
    .custom((value) => {
      return new Date(value) > new Date();
    })
    .withMessage('Appointment date must be in the future'),
  
  body('timeSlot.start')
    .notEmpty()
    .withMessage('Start time is required')
    .isISO8601()
    .withMessage('Invalid start time format'),
  
  body('timeSlot.end')
    .notEmpty()
    .withMessage('End time is required')
    .isISO8601()
    .withMessage('Invalid end time format')
    .custom((value, { req }) => {
      if (new Date(value) <= new Date(req.body.timeSlot.start)) {
        throw new Error('End time must be after start time');
      }
      return true;
    }),
  
  body('duration')
    .notEmpty()
    .withMessage('Duration is required')
    .isInt({ min: 5, max: 240 })
    .withMessage('Duration must be between 5 and 240 minutes'),
  
  body('consultationType')
    .notEmpty()
    .withMessage('Consultation type is required')
    .isIn(['online', 'in_clinic', 'home_visit'])
    .withMessage('Invalid consultation type'),
  
  body('reason')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Reason must be less than 500 characters'),
  
  body('amount')
    .notEmpty()
    .withMessage('Amount is required')
    .isFloat({ min: 0 })
    .withMessage('Amount must be a positive number')
];

export const validateUpdateAppointment = [
  param('id')
    .isMongoId()
    .withMessage('Invalid appointment ID'),
  
  body('reason')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Reason must be less than 500 characters'),
  
  body('notes')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Notes must be less than 1000 characters'),
  
  body('symptoms')
    .optional()
    .isArray()
    .withMessage('Symptoms must be an array'),
  
  body('symptoms.*')
    .isLength({ max: 100 })
    .withMessage('Each symptom must be less than 100 characters'),
  
  body('diagnosis')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Diagnosis must be less than 500 characters')
];

export const validateIdParam = [
  param('id')
    .isMongoId()
    .withMessage('Invalid appointment ID')
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
  
  query('status')
    .optional()
    .isIn(['pending', 'confirmed', 'completed', 'cancelled', 'no_show'])
    .withMessage('Invalid status value'),
  
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid start date format'),
  
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid end date format')
];

export const validateReschedule = [
  param('id')
    .isMongoId()
    .withMessage('Invalid appointment ID'),
  
  body('newStart')
    .notEmpty()
    .withMessage('New start time is required')
    .isISO8601()
    .withMessage('Invalid start time format')
    .custom((value) => {
      return new Date(value) > new Date();
    })
    .withMessage('New appointment time must be in the future'),
  
  body('newEnd')
    .notEmpty()
    .withMessage('New end time is required')
    .isISO8601()
    .withMessage('Invalid end time format')
    .custom((value, { req }) => {
      if (new Date(value) <= new Date(req.body.newStart)) {
        throw new Error('End time must be after start time');
      }
      return true;
    })
];

export const validateAvailabilityCheck = [
  query('doctorId')
    .notEmpty()
    .withMessage('Doctor ID is required')
    .isMongoId()
    .withMessage('Invalid doctor ID'),
  
  query('date')
    .notEmpty()
    .withMessage('Date is required')
    .isISO8601()
    .withMessage('Invalid date format'),
  
  query('duration')
    .optional()
    .isInt({ min: 5, max: 240 })
    .withMessage('Duration must be between 5 and 240 minutes')
];