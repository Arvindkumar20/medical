import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { validationResult } from "express-validator";
import { logger } from "../utils/logger.js";
import "dotenv/config"
import path from "path";
import fs from "fs";
import multer from "multer";

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
      id: user.id,
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
      id: newUser.id,
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
      id: user.id,
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

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = "uploads/profile";
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, `user-${req.user.id}-${Date.now()}${ext}`);
  }
});

// File filter for image only
function fileFilter(req, file, cb) {
  if (!file.mimetype.startsWith("image/")) {
    return cb(new Error("Only image files are allowed"), false);
  }
  cb(null, true);
}

export const upload = multer({ storage, fileFilter });

// 📌 Upload profile picture
export const uploadProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Save file path in user model
    // if(!user.profilePicture){
    //   user.profilePicture
    // }
    user.profilePicture = `/uploads/profile/${req.file.filename}`;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile picture uploaded successfully",
      profilePicture: user.profilePicture
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 📌 Fetch profile picture
export const getProfilePicture = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    console.log(user)
    if (!user || !user.profilePicture) {
      return res.status(404).json({ success: false, message: "Profile picture not found" });
    }

    // const filePath = path.join(process.cwd(), user.profilePicture);
    // res.sendFile(filePath);
    return res.json({
      message: "user details fetched successfully",
      user
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


export const deleteProfilePicture = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!user.profilePicture) {
      return res.status(400).json({ success: false, message: "No profile picture to delete" });
    }

    // Get file path
    const filePath = path.join(process.cwd(), "uploads", "profile", path.basename(user.profilePicture));

    // Delete file from local system if exists
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Remove profile picture from DB
    user.profilePicture = null;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile picture deleted successfully"
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};




// 📌 Update User Profile (partial update)
export const updateUserProfile = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      specialization,
      qualifications
    } = req.body || {};

    // User find karo
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // ✅ Sirf wahi fields update hongi jo request me aayi hain
    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (phone !== undefined) user.phone = phone;
    if (specialization !== undefined) user.specialization = specialization;
    if (qualifications !== undefined) user.qualifications = qualifications;

    // Profile picture agar file upload ke through aayi hai
    if (req.file) {
      user.profilePicture = `/uploads/profile/${req.file.filename}`;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        specialization: user.specialization,
        qualifications: user.qualifications,
        role: user.role,
        profilePicture: user.profilePicture || null,
        verified: user.verified,
        store: user.store || null
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
