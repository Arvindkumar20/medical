import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { validationResult } from "express-validator";
import { logger } from "../utils/logger.js";
import "dotenv/config"

// Constants
const TOKEN_EXPIRY = "7d";
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME = 30 * 60 * 1000; // 30 minutes in milliseconds

/**
 * Generate JWT Token
 * @param {Object} user - User object
 * @returns {String} JWT token
 */
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
      // Add more claims as needed but avoid sensitive data
      iss: "your-api-domain.com",
      aud: "your-client-domain.com",
    },
    process.env.JWT_SECRET,
    {
      expiresIn: TOKEN_EXPIRY,
      algorithm: "HS256", // Explicitly specify algorithm
    }
  );
};

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
export const registerUser = async (req, res) => {
  try {
    // 1. Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array().map(err => ({
          field: err.param,
          message: err.msg
        })),
      });
    }

    // 2. Extract fields with role-based validation
    const { role = "user" } = req.body;
    
    // Define role-specific allowed fields
    const roleFieldMap = {
      user: ["name", "email", "password", "phone", "address"],
      admin: ["name", "email", "password", "phone", "department"],
      doctor: [
        "name", "email", "password", "phone", 
        "specialization", "qualifications", "licenseNumber",
        "hospital", "consultationFee", "availability"
      ]
    };

    // Get allowed fields for the role or default to user
    const allowedFields = roleFieldMap[role] || roleFieldMap.user;
    
    // Create filtered payload with only allowed fields
    const payload = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        payload[field] = req.body[field];
      }
    }

    // Add role separately (sanitized)
    payload.role = role;

    // 3. Validate required fields
    const requiredFields = ["name", "email", "password"];
    const missingFields = requiredFields.filter(field => !payload[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
        errors: missingFields.map(field => ({
          field,
          message: `${field} is required`
        }))
      });
    }

    // 4. Check if user exists (case-insensitive search)
    const existingUser = await User.findOne({ 
      email: { $regex: new RegExp(`^${payload.email}$`, 'i') } 
    });
    
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Registration failed",
        errors: [{ field: "email", message: "Email already registered" }],
      });
    }

    // 5. Create user with filtered payload
    const newUser = new User(payload);
    await newUser.save();

    // 6. Generate token without sensitive data in payload
    const token = generateToken(newUser);

    // 7. Prepare response data (excluding sensitive fields)
    const userData = {
      id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      ...(role === 'doctor' && {
        specialization: newUser.specialization,
        qualifications: newUser.qualifications,
        consultationFee: newUser.consultationFee
      }),
      createdAt: newUser.createdAt,
    };

    logger.info(`New ${role} registered: ${newUser.email}`);

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        token,
        user: userData,
      },
    });

  } catch (err) {
    logger.error(`Registration error: ${err.message}`, { error: err.stack });

    // Handle duplicate key errors (other than email)
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue)[0];
      return res.status(409).json({
        success: false,
        message: "Registration failed",
        errors: [{ field, message: `${field} already exists` }],
      });
    }

    // Handle validation errors
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(error => ({
        field: error.path,
        message: error.message,
      }));

      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error during registration",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
};

/**
 * @route   POST /api/auth/login
 * @desc    Login user and return JWT token
 * @access  Public
 */
export const loginUser = async (req, res) => {
  console.log(req.body);
  try {
    // 1. Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Login failed",
        errors: errors.array().map(err => ({
          field: err.param,
          message: err.msg
        })),
      });
    }
    // console.log(req.body);
    const { email, password } = req.body;

    // 2. Find user (case-insensitive search)
    const user = await User.findOne({
      email: { $regex: new RegExp(`^${email}$`, 'i') }
    }).select('+password +loginAttempts +lockUntil');

    if (!user) {
      // Don't reveal whether user exists for security
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // 3. Check if account is locked
    if (user.lockUntil && user.lockUntil > Date.now()) {
      const remainingTime = Math.ceil((user.lockUntil - Date.now()) / 60000); // in minutes
      return res.status(403).json({
        success: false,
        message: "Account temporarily locked",
        errors: [{
          message: `Too many failed attempts. Try again in ${remainingTime} minute(s).`
        }],
      });
    }

    // 4. Match password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      // Increment login attempts
      user.loginAttempts += 1;

      if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
        // Lock the account
        user.lockUntil = Date.now() + LOCK_TIME;
        await user.save();

        return res.status(403).json({
          success: false,
          message: "Account locked due to too many failed attempts",
          errors: [{
            message: `Try again in ${LOCK_TIME / 60000} minutes.`
          }],
        });
      }

      await user.save();

      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
        remainingAttempts: MAX_LOGIN_ATTEMPTS - user.loginAttempts,
      });
    }

    // 5. Reset login attempts on successful login
    if (user.loginAttempts > 0 || user.lockUntil) {
      user.loginAttempts = 0;
      user.lockUntil = undefined;
      await user.save();
    }

    // 6. Generate token
    const token = generateToken(user);

    // 7. Prepare response data
    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
    };

    logger.info(`User logged in: ${user.email}`);

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        token,
        user: userData,
      },
    });
  } catch (err) {
    logger.error(`Login error: ${err.message}`, { error: err.stack });

    res.status(500).json({
      success: false,
      message: "Internal server error during login",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
};

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (client-side token invalidation)
 * @access  Private
 * @note    For true server-side invalidation, you'd need a token blacklist
 */
// @desc    Logout user (stateless JWT)
// @route   POST /api/auth/logout
// @access  Private
export const logoutUser = async (req, res) => {
  try {
    // In stateless JWT, logout is client-side (remove token from localStorage/cookies)
    // Optional: Implement token blacklist if you want server-side invalidation

    res.status(200).json({
      success: true,
      message: "Logout successful. Token invalidated on client side. Please remove token from storage.",
      nextStep: "Ensure you clear Authorization header or  stored token."
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Logout failed due to server error.",
      error: error.message
    });
  }
};
