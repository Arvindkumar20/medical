// middlewares/validation.js
import { body } from "express-validator";

// Notification validation rules
export const validateNotification = [
  body("userId")
    .optional()
    .isMongoId()
    .withMessage("Valid user ID is required"),
  
  body("storeId")
    .optional()
    .isMongoId()
    .withMessage("Valid store ID is required"),
  
  body("productId")
    .optional()
    .isMongoId()
    .withMessage("Valid product ID is required"),
  
  body("message")
    .optional()
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage("Message must be between 1-500 characters")
    .matches(/^[a-zA-Z0-9\s.,!?@#$%^&*()_+-=;:'"<>{}[\]\\/]+$/)
    .withMessage("Message contains invalid characters"),
  
  body("type")
    .optional()
    .isIn(["order", "reminder", "offer", "system", "custom"])
    .withMessage("Invalid notification type"),
  
  body("priority")
    .optional()
    .isIn(["low", "medium", "high", "urgent"])
    .withMessage("Invalid priority level"),
  
  body("expirationDate")
    .optional()
    .isISO8601()
    .withMessage("Valid expiration date is required"),
  
  body("actionUrl")
    .optional()
    .isURL()
    .withMessage("Valid URL is required")
];