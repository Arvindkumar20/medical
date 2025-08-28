import { validationResult } from 'express-validator';
import { DoctorProfile } from '../models/DoctorProfile.js';
import { User } from '../models/User.js';

// Helper function to handle errors
const handleError = (res, status, message, error = null) => {
  console.error(message, error);
  return res.status(status).json({
    success: false,
    message,
    error: process.env.NODE_ENV === 'development' ? error?.message : undefined
  });
};

// Create a new doctor profile
export const createDoctorProfile = async (req, res) => {
  try {
    // validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: "Validation failed", errors: errors.array() });
    }

    // profile already?
    const existingProfile = await DoctorProfile.findOne({ user: req.user.id });
    if (existingProfile) {
      return res.status(409).json({ success: false, message: "Doctor profile already exists for this user" });
    }

    // uploaded files (multer ne add kiya)
    let licenseUrl = req.files?.license ? `/uploads/doctorsLicense/${req.files.license[0].filename}` : null;
    let certificateUrl = req.files?.certificate ? `/uploads/doctorsCertificate/${req.files.certificate[0].filename}` : null;

    const doctorProfile = new DoctorProfile({
      ...req.body,
      user: req.user.id,
      verificationDetails: {
        documents: [
          licenseUrl ? { type: "license", url: licenseUrl } : null,
          certificateUrl ? { type: "certificate", url: certificateUrl } : null,
        ].filter(Boolean),
      },
    });

    const savedProfile = await doctorProfile.save();
    await savedProfile.populate("user", "name email");

    res.status(201).json({
      success: true,
      message: "Doctor profile created successfully",
      data: savedProfile,
    });
  } catch (error) {
    handleError(res, 500, "Error creating doctor profile", error);
  }
};


// Get all doctor profiles with filtering and pagination
export const getDoctorProfiles = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Build filter object
    const filter = { isActive: true };
    
    if (req.query.specialization) {
      filter.specialization = new RegExp(req.query.specialization, 'i');
    }
    
    if (req.query.city) {
      filter['clinicAddress.city'] = new RegExp(req.query.city, 'i');
    }
    
    if (req.query.isVerified) {
      filter.isVerified = req.query.isVerified === 'true';
    }
    
    // Execute query with pagination
    const doctors = await DoctorProfile.find(filter)
      .populate('user', 'name email')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });
    
    // Get total count for pagination
    const total = await DoctorProfile.countDocuments(filter);
    
    res.json({
      success: true,
      data: doctors,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    handleError(res, 500, 'Error fetching doctor profiles', error);
  }
};

// Get doctor profile by ID
export const getDoctorProfile = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const doctorProfile = await DoctorProfile.findById(req.params.id)
      .populate('user', 'name email');
    
    if (!doctorProfile || !doctorProfile.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Doctor profile not found'
      });
    }
    
    res.json({
      success: true,
      data: doctorProfile
    });
  } catch (error) {
    handleError(res, 500, 'Error fetching doctor profile', error);
  }
};

// Update doctor profile
export const updateDoctorProfile = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const doctorProfile = await DoctorProfile.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: Date.now() },
      { new: true, runValidators: true }
    ).populate('user', 'name email');
    
    if (!doctorProfile) {
      return res.status(404).json({
        success: false,
        message: 'Doctor profile not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Doctor profile updated successfully',
      data: doctorProfile
    });
  } catch (error) {
    handleError(res, 500, 'Error updating doctor profile', error);
  }
};

// Delete doctor profile (soft delete)
export const deleteDoctorProfile = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const doctorProfile = await DoctorProfile.findByIdAndUpdate(
      req.params.id,
      { isActive: false, updatedAt: Date.now() },
      { new: true }
    );
    
    if (!doctorProfile) {
      return res.status(404).json({
        success: false,
        message: 'Doctor profile not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Doctor profile deleted successfully'
    });
  } catch (error) {
    handleError(res, 500, 'Error deleting doctor profile', error);
  }
};

// Search doctors by location and specialty
export const searchDoctors = async (req, res) => {
  try {
    const { longitude, latitude, maxDistance = 10000, specialization } = req.query;
    
    if (!longitude || !latitude) {
      return res.status(400).json({
        success: false,
        message: 'Longitude and latitude are required'
      });
    }
    
    const doctors = await DoctorProfile.findByLocationAndSpecialty(
      [parseFloat(longitude), parseFloat(latitude)],
      parseInt(maxDistance),
      specialization || ''
    ).populate('user', 'name email');
    
    res.json({
      success: true,
      data: doctors
    });
  } catch (error) {
    handleError(res, 500, 'Error searching doctors', error);
  }
};

// Get current user's doctor profile
export const getMyDoctorProfile = async (req, res) => {
  try {
    const doctorProfile = await DoctorProfile.findOne({ user: req.user.id })
      .populate('user', 'name email');
    
    if (!doctorProfile) {
      return res.status(404).json({
        success: false,
        message: 'Doctor profile not found for this user'
      });
    }
    
    res.json({
      success: true,
      data: doctorProfile
    });
  } catch (error) {
    handleError(res, 500, 'Error fetching doctor profile', error);
  }
};