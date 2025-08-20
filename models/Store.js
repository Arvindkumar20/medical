// // models/Store.js
// // const mongoose = require("mongoose");
// // const validator = require("validator");

// import mongoose from "mongoose";
// import validator from "validator";
// const storeSchema = new mongoose.Schema({
//   name: {
//     type: String,
//     required: [true, "Store name is required"],
//     trim: true,
//     maxlength: [100, "Store name cannot exceed 100 characters"],
//     minlength: [3, "Store name must be at least 3 characters"],
//     match: [/^[a-zA-Z0-9\s\-&',.]+$/, "Store name contains invalid characters"]
//   },
//   address: {
//     type: String,
//     required: [true, "Address is required"],
//     trim: true,
//     maxlength: [255, "Address cannot exceed 255 characters"]
//   },
//   phone: {
//     type: String,
//     required: [true, "Phone number is required"],
//     validate: {
//       validator: function (v) {
//         return validator.isMobilePhone(v, "any", { strictMode: false });
//       },
//       message: "Please provide a valid phone number"
//     }
//   },
//   email: {
//     type: String,
//     required: [true, "Email is required"],
//     lowercase: true,
//     validate: [validator.isEmail, "Please provide a valid email address"],
//     trim: true
//   },
//   approved: {
//     type: Boolean,
//     default: false
//   },
//   owner: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: "User",
//     required: [true, "Store owner is required"],
//     validate: {
//       validator: async function (v) {
//         const user = await mongoose.model("User").findById(v);
//         return user && (user.role === "admin" || user.role === "doctor");
//       },
//       message: "Owner must be a valid user with appropriate role"
//     }
//   },
//   location: {
//     type: {
//       type: String,
//       enum: ["Point"],
//       default: "Point",
//       required: true
//     },
//     coordinates: {
//       type: [Number],
//       required: [true, "Coordinates are required"],
//       validate: {
//         validator: function (v) {
//           return (
//             Array.isArray(v) &&
//             v.length === 2 &&
//             v[0] >= -180 && v[0] <= 180 && // longitude validation
//             v[1] >= -90 && v[1] <= 90    // latitude validation
//           );
//         },
//         message: "Coordinates must be valid [longitude, latitude] values"
//       }
//     }
//   },
//   businessHours: {
//     type: [{
//       day: {
//         type: String,
//         enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
//         required: true
//       },
//       open: {
//         type: String,
//         required: true,
//         match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Time must be in HH:MM format"]
//       },
//       close: {
//         type: String,
//         required: true,
//         match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Time must be in HH:MM format"],
//         validate: {
//           validator: function (v) {
//             return new Date(`1970-01-01T${v}:00`) > new Date(`1970-01-01T${this.open}:00`);
//           },
//           message: "Closing time must be after opening time"
//         }
//       }
//     }],
//     validate: {
//       validator: function (v) {
//         return v && v.length > 0;
//       },
//       message: "At least one business day must be specified"
//     }
//   },
//   description: {
//     type: String,
//     maxlength: [1000, "Description cannot exceed 1000 characters"],
//     trim: true
//   },
//   isDilated: {

//     type: Boolean,
//     default: false
//   },
//   website: {
//     type: String,
//     validate: {
//       validator: function (v) {
//         return validator.isURL(v, {
//           protocols: ["http", "https"],
//           require_protocol: true
//         });
//       },
//       message: "Please provide a valid website URL with http/https"
//     },
//     trim: true
//   },
//   status: {
//     type: String,
//     enum: {
//       values: ["active", "inactive", "pending", "suspended"],
//       message: "Status must be either active, inactive, pending, or suspended"
//     },
//     default: "pending"
//   },
//   categories: {
//     type: [String],
//     validate: {
//       validator: function (v) {
//         return v && v.length > 0;
//       },
//       message: "At least one category must be specified"
//     },
//     enum: {
//       values: ["pharmacy", "grocery", "clinic", "restaurant", "retail", "other"],
//       message: "Invalid category provided"
//     }
//   },
//   rating: {
//     average: {
//       type: Number,
//       min: [0, "Rating cannot be less than 0"],
//       max: [5, "Rating cannot be more than 5"],
//       default: 0
//     },
//     count: {
//       type: Number,
//       min: 0,
//       default: 0
//     }
//   }
// }, {
//   timestamps: true,
//   toJSON: { virtuals: true },
//   toObject: { virtuals: true }
// });

// // 2dsphere index for geospatial queries
// storeSchema.index({ location: "2dsphere" });

// // Text index for search functionality
// storeSchema.index({
//   name: "text",
//   description: "text",
//   address: "text",
//   categories: "text"
// });

// // Pre-save hook to validate business hours
// storeSchema.pre("save", function (next) {
//   if (this.businessHours) {
//     const days = new Set();
//     for (const hour of this.businessHours) {
//       if (days.has(hour.day)) {
//         throw new Error(`Duplicate business hours for ${hour.day}`);
//       }
//       days.add(hour.day);
//     }
//   }
//   next();
// });

// // Virtual for formatted address
// storeSchema.virtual("formattedAddress").get(function () {
//   return `${this.address}`.trim();
// });

// // Static method to find nearby stores
// storeSchema.statics.findNearby = function (coordinates, maxDistance = 5000) {
//   return this.find({
//     location: {
//       $near: {
//         $geometry: {
//           type: "Point",
//           coordinates
//         },
//         $maxDistance: maxDistance
//       }
//     },
//     status: "active",
//     approved: true
//   });
// };

// // Instance method to check if store is open now
// storeSchema.methods.isOpenNow = function () {
//   if (!this.businessHours || this.businessHours.length === 0) return false;

//   const now = new Date();
//   const today = this.businessHours.find(h => h.day === now.toLocaleDateString("en-US", { weekday: "long" }));

//   if (!today) return false;

//   const currentTime = now.getHours() * 100 + now.getMinutes();
//   const openTime = parseInt(today.open.replace(":", ""));
//   const closeTime = parseInt(today.close.replace(":", ""));

//   return currentTime >= openTime && currentTime <= closeTime;
// };

// export const Store = mongoose.model("Store", storeSchema);




import mongoose from "mongoose";
import validator from "validator";

const storeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Store name is required"],
    trim: true,
    maxlength: [100, "Store name cannot exceed 100 characters"],
    minlength: [3, "Store name must be at least 3 characters"],
    match: [/^[a-zA-Z0-9\s\-&',.]+$/, "Store name contains invalid characters"]
  },
  address: {
    type: String,
    required: [true, "Address is required"],
    trim: true,
    maxlength: [255, "Address cannot exceed 255 characters"]
  },
  phone: {
    type: String,
    required: [true, "Phone number is required"],
    validate: {
      validator: function (v) {
        return validator.isMobilePhone(v, "any", { strictMode: false });
      },
      message: "Please provide a valid phone number"
    }
  },
  email: {
    type: String,
    required: [true, "Email is required"],
    lowercase: true,
    validate: [validator.isEmail, "Please provide a valid email address"],
    trim: true
  },
  approved: {
    type: Boolean,
    default: false
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: [true, "Store owner is required"],
    validate: {
      validator: async function (v) {
        const user = await mongoose.model("User").findById(v);
        return user && (user.role === "admin" || user.role === "doctor");
      },
      message: "Owner must be a valid user with appropriate role"
    }
  },
  location: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point",
      required: true
    },
    coordinates: {
      type: [Number],
      required: [true, "Coordinates are required"],
      validate: {
        validator: function (v) {
          return (
            Array.isArray(v) &&
            v.length === 2 &&
            v[0] >= -180 && v[0] <= 180 && // longitude validation
            v[1] >= -90 && v[1] <= 90    // latitude validation
          );
        },
        message: "Coordinates must be valid [longitude, latitude] values"
      }
    }
  },
  businessHours: {
    type: [{
      day: {
        type: String,
        enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        required: true
      },
      open: {
        type: String,
        required: true,
        match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Time must be in HH:MM format"]
      },
      close: {
        type: String,
        required: true,
        match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Time must be in HH:MM format"],
        validate: {
          validator: function (v) {
            return new Date(`1970-01-01T${v}:00`) > new Date(`1970-01-01T${this.open}:00`);
          },
          message: "Closing time must be after opening time"
        }
      }
    }],
    validate: {
      validator: function (v) {
        return v && v.length > 0;
      },
      message: "At least one business day must be specified"
    }
  },
  description: {
    type: String,
    maxlength: [1000, "Description cannot exceed 1000 characters"],
    trim: true
  },
  isDilated: {
    type: Boolean,
    default: false
  },
  website: {
    type: String,
    validate: {
      validator: function (v) {
        return validator.isURL(v, {
          protocols: ["http", "https"],
          require_protocol: true
        });
      },
      message: "Please provide a valid website URL with http/https"
    },
    trim: true
  },
  status: {
    type: String,
    enum: {
      values: ["active", "inactive", "pending", "suspended"],
      message: "Status must be either active, inactive, pending, or suspended"
    },
    default: "pending"
  },
  categories: {
    type: [String],
    validate: {
      validator: function (v) {
        return v && v.length > 0;
      },
      message: "At least one category must be specified"
    },
    enum: {
      values: ["pharmacy", "grocery", "clinic", "restaurant", "retail", "other"],
      message: "Invalid category provided"
    }
  },
  rating: {
    average: {
      type: Number,
      min: [0, "Rating cannot be less than 0"],
      max: [5, "Rating cannot be more than 5"],
      default: 0
    },
    count: {
      type: Number,
      min: 0,
      default: 0
    }
  },
  // ✅ optional store image
  storeImage: {
    type: String,
    trim: true,
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// 2dsphere index for geospatial queries
storeSchema.index({ location: "2dsphere" });

// Text index for search functionality
storeSchema.index({
  name: "text",
  description: "text",
  address: "text",
  categories: "text"
});

// Pre-save hook to validate business hours
storeSchema.pre("save", function (next) {
  if (this.businessHours) {
    const days = new Set();
    for (const hour of this.businessHours) {
      if (days.has(hour.day)) {
        throw new Error(`Duplicate business hours for ${hour.day}`);
      }
      days.add(hour.day);
    }
  }
  next();
});

// Virtual for formatted address
storeSchema.virtual("formattedAddress").get(function () {
  return `${this.address}`.trim();
});

// Static method to find nearby stores
storeSchema.statics.findNearby = function (coordinates, maxDistance = 5000) {
  return this.find({
    location: {
      $near: {
        $geometry: {
          type: "Point",
          coordinates
        },
        $maxDistance: maxDistance
      }
    },
    status: "active",
    approved: true
  });
};

// Instance method to check if store is open now
storeSchema.methods.isOpenNow = function () {
  if (!this.businessHours || this.businessHours.length === 0) return false;

  const now = new Date();
  const today = this.businessHours.find(h => h.day === now.toLocaleDateString("en-US", { weekday: "long" }));

  if (!today) return false;

  const currentTime = now.getHours() * 100 + now.getMinutes();
  const openTime = parseInt(today.open.replace(":", ""));
  const closeTime = parseInt(today.close.replace(":", ""));

  return currentTime >= openTime && currentTime <= closeTime;
};

export const Store = mongoose.model("Store", storeSchema);
