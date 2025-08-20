// // models/User.js
// // const mongoose = require("mongoose");
// // const bcrypt = require("bcryptjs");
// // const validator = require("validator");
// import mongoose from "mongoose";
// import bcrypt from "bcryptjs";
// import validator from "validator";
// const userSchema = new mongoose.Schema({
//   name: {
//     type: String,
//     required: [true, "Name is required"],
//     trim: true,
//     maxlength: [50, "Name cannot exceed 50 characters"],
//     minlength: [2, "Name should be at least 2 characters long"]
//   },
//   email: {
//     type: String,
//     required: [true, "Email is required"],
//     unique: true,
//     lowercase: true,
//     validate: [validator.isEmail, "Please provide a valid email address"]
//   },
//   phone: {
//     type: String,
//     validate: {
//       validator: function (v) {
//         return /^(\+91)?[0-9]{10}$/.test(v); // Indian phone format
//       },
//       message: "Invalid phone number"
//     }
//   },
//   password: {
//     type: String,
//     required: [true, "Password is required"],
//     minlength: [8, "Password must be at least 8 characters long"],
//     select: false // Never show password in queries
//   },
//   role: {
//     type: String,
//     enum: {
//       values: ["customer", "doctor", "admin"],
//       message: "Role must be either customer, doctor, or admin"
//     },
//     default: "customer"
//   },
//   specialization: {
//     type: String,
//     required: function () {
//       return this.role === "doctor";
//     },
//     trim: true,
//     maxlength: [100, "Specialization cannot exceed 100 characters"]
//   },
//   qualifications: {
//     type: String,
//     required: function () {
//       return this.role === "doctor";
//     },
//     trim: true,
//     maxlength: [200, "Qualifications cannot exceed 200 characters"]
//   },
//   verified: {
//     type: Boolean,
//     default: false
//   },
//   store:{
//     type:mongoose.Schema.Types.ObjectId,
//     ref:"Store"
//   }
// }, {
//   timestamps: true,
//   toJSON: { virtuals: true },
//   toObject: { virtuals: true }
// });

// // Encrypt password before save
// userSchema.pre("save", async function (next) {
//   if (!this.isModified("password")) return next();

//   try {
//     const salt = await bcrypt.genSalt(10);
//     this.password = await bcrypt.hash(this.password, salt);
//     next();
//   } catch (err) {
//     next(err);
//   }
// });

// // Password comparison method
// userSchema.methods.matchPassword = async function (candidatePassword) {
//   return await bcrypt.compare(candidatePassword, this.password);
// };

// // Validate doctor-specific fields when role is doctor
// userSchema.pre("save", function (next) {
//   if (this.role === "doctor") {
//     if (!this.specialization || !this.qualifications) {
//       throw new Error("Specialization and qualifications are required for doctors");
//     }
//   }
//   next();
// });

// // Add index for better query performance
// // userSchema.index({ email: 1 });
// userSchema.index({ role: 1 });

// export const User = mongoose.model("User", userSchema);




// models/User.js
// const mongoose = require("mongoose");
// const bcrypt = require("bcryptjs");
// const validator = require("validator");
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import validator from "validator";

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Name is required"],
    trim: true,
    maxlength: [50, "Name cannot exceed 50 characters"],
    minlength: [2, "Name should be at least 2 characters long"]
  },
  email: {
    type: String,
    required: [true, "Email is required"],
    unique: true,
    lowercase: true,
    validate: [validator.isEmail, "Please provide a valid email address"]
  },
  phone: {
    type: String,
    validate: {
      validator: function (v) {
        return /^(\+91)?[0-9]{10}$/.test(v); // Indian phone format
      },
      message: "Invalid phone number"
    }
  },
  password: {
    type: String,
    required: [true, "Password is required"],
    minlength: [8, "Password must be at least 8 characters long"],
    select: false // Never show password in queries
  },
  role: {
    type: String,
    enum: {
      values: ["customer", "doctor", "admin"],
      message: "Role must be either customer, doctor, or admin"
    },
    default: "customer"
  },
  specialization: {
    type: String,
    required: function () {
      return this.role === "doctor";
    },
    trim: true,
    maxlength: [100, "Specialization cannot exceed 100 characters"]
  },
  qualifications: {
    type: String,
    required: function () {
      return this.role === "doctor";
    },
    trim: true,
    maxlength: [200, "Qualifications cannot exceed 200 characters"]
  },
  verified: {
    type: Boolean,
    default: false
  },
  store: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Store"
  },
  profilePicture: {
    type: String,
    trim: true,
    
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Encrypt password before save
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Password comparison method
userSchema.methods.matchPassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Validate doctor-specific fields when role is doctor
userSchema.pre("save", function (next) {
  if (this.role === "doctor") {
    if (!this.specialization || !this.qualifications) {
      throw new Error("Specialization and qualifications are required for doctors");
    }
  }
  next();
});

// Add index for better query performance
// userSchema.index({ email: 1 });
userSchema.index({ role: 1 });

export const User = mongoose.model("User", userSchema);
