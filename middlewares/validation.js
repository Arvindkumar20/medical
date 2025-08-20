// middlewares/validation.js
import { body } from "express-validator";

// Product validation rules
export const validateProduct = [
  body("name")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Product name must be between 1-100 characters"),
  
  body("description")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Description cannot exceed 1000 characters"),
  
  body("price")
    .isFloat({ min: 0 })
    .withMessage("Price must be a positive number"),
  
  body("quantity")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Quantity must be a non-negative integer"),
  
  body("category")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Category cannot exceed 50 characters"),
  
  body("tags")
    .optional()
    .custom((value) => {
      if (Array.isArray(value) && value.length > 10) {
        throw new Error("Cannot have more than 10 tags");
      }
      return true;
    })
];

// Stock adjustment validation rules
export const validateStockAdjustment = [
  body("delta")
    .isInt()
    .withMessage("Delta must be an integer")
];