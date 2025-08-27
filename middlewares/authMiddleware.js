// // const jwt = require("jsonwebtoken");
// import jwt from "jsonwebtoken"
// import "dotenv/config"


// export const protect = (req, res, next) => {
//   const authHeader = req.headers.authorization;
//   const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

//   if (!token) {
//     return res.status(401).json({ success: false, message: "No token provided" });
//   }

//   try {
//     // const secret = process.env.JWT_SECRET;
//     if (!process.env.JWT_SECRET) {
//       // This is a server config issue; you might want to fail closed.
//       return res.status(500).json({ success: false, message: "Server misconfigured" });
//     }

//     const decoded = jwt.verify(token, process.env.JWT_SECRET, {
//       audience: "your-client-domain.com",
//       issuer: "your-api-domain.com",
//     });

//     req.user = decoded; // e.g., { id, role, iat, exp, iss, aud }
//     next();
//   } catch (err) {
//     console.log("Token verification failed:", err.message); // log for debugging
//     return res.status(401).json({ success: false, message: "Invalid or expired token" });
//   }
// };


// // Optional: role-based access
// export const restrictTo = (...roles) => {
//   return (req, res, next) => {
//     if (!roles.includes(req.user.role))
//       return res.status(403).json({ message: "Access denied" });
//     next();
//   };
// };



import jwt from 'jsonwebtoken';
import { DoctorProfile } from '../models/DoctorProfile.js';
import { User } from '../models/User.js';

export const protect = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({ message: 'Token is not valid.' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token is not valid.' });
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `User role ${req.user.role} is not authorized to access this route`
      });
    }
    next();
  };
};

export const checkProfileOwnership = async (req, res, next) => {
  try {
    const doctorProfile = await DoctorProfile.findById(req.params.id);
    
    if (!doctorProfile) {
      return res.status(404).json({ message: 'Doctor profile not found' });
    }
    
    // Allow admins to access any profile
    if (req.user.role === 'admin') {
      return next();
    }
    
    // Check if the user owns the profile
    if (doctorProfile.user.toString() !== req.user.id) {
      return res.status(403).json({
        message: 'User not authorized to access this profile'
      });
    }
    
    next();
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};