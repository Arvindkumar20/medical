import { validationResult } from 'express-validator';
import { Appointment } from '../models/Appointment.js';
import { DoctorProfile } from '../models/DoctorProfile.js';
import { User } from '../models/User.js';
import moment from 'moment-timezone';
import { sendNotification } from '../utils/globalNotificationService.js';

// Helper function to handle errors
const handleError = (res, status, message, error = null) => {
  console.error(message, error);
  return res.status(status).json({
    success: false,
    message,
    error: process.env.NODE_ENV === 'development' ? error?.message : undefined
  });
};

// Create a new appointment
// export const createAppointment = async (req, res) => {
//   try {
//     // Check for validation errors
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//       return res.status(400).json({
//         success: false,
//         message: 'Validation failed',
//         errors: errors.array()
//       });
//     }

//     const {
//       doctor,
//       appointmentDate,
//       timeSlot,
//       duration,
//       consultationType,
//       reason,
//       amount
//     } = req.body;

//     // Check if doctor exists and is verified
//     const doctorProfile = await DoctorProfile.findById(doctor);
//     if (!doctorProfile || !doctorProfile.isActive) {
//       return res.status(404).json({
//         success: false,
//         message: 'Doctor not found or not available'
//       });
//     }

//     if (!doctorProfile.isVerified) {
//       return res.status(400).json({
//         success: false,
//         message: 'Doctor is not verified'
//       });
//     }

//     // Check if the time slot is available
//     const isAvailable = await Appointment.isSlotAvailable(
//       doctor,
//       new Date(timeSlot.start),
//       new Date(timeSlot.end)
//     );

//     if (!isAvailable) {
//       return res.status(409).json({
//         success: false,
//         message: 'Time slot is not available'
//       });
//     }

//     // Create new appointment
//     const appointment = new Appointment({
//       doctor,
//       patient: req.user.id,
//       appointmentDate: new Date(appointmentDate),
//       timeSlot: {
//         start: new Date(timeSlot.start),
//         end: new Date(timeSlot.end)
//       },
//       duration,
//       consultationType,
//       reason,
//       amount,
//       currency: req.body.currency || 'USD',
//       timeLabel: `${moment(timeSlot.start).format('HH:mm')}-${moment(timeSlot.end).format('HH:mm')}`
//     });

//     const savedAppointment = await appointment.save();
    
//     // Populate doctor and patient details
//     await savedAppointment.populate('doctor', 'user specialization')
//                          .populate('patient', 'name email phone');
    
//     await savedAppointment.populate({
//       path: 'doctor',
//       populate: { path: 'user', select: 'name email' }
//     });

//     res.status(201).json({
//       success: true,
//       message: 'Appointment created successfully',
//       data: savedAppointment
//     });
//   } catch (error) {
//     handleError(res, 500, 'Error creating appointment', error);
//   }
// };

export const createAppointment = async (req, res) => {
  try {
    const {
      doctor,
      appointmentDate,
      timeSlot,
      duration,
      consultationType,
      reason,
      amount,
    } = req.body;

    const doctorProfile = await DoctorProfile.findById(doctor).populate("user");
    if (!doctorProfile || !doctorProfile.isActive || !doctorProfile.isVerified) {
      return res.status(400).json({ success: false, message: "Doctor not available" });
    }

    // slot check logic yaha rahega...
    const appointment = new Appointment({
      doctor,
      patient: req.user.id,
      appointmentDate,
      timeSlot: {
        start: new Date(timeSlot.start),
        end: new Date(timeSlot.end),
      },
      duration,
      consultationType,
      reason,
      amount,
      currency: req.body.currency || "USD",
      timeLabel: `${moment(timeSlot.start).format("HH:mm")}-${moment(timeSlot.end).format("HH:mm")}`,
    });

    const savedAppointment = await appointment.save();

    // ✅ Ab notification bhejna doctor ko
    const notificationResult = await sendNotification({
      userId: doctorProfile.user._id,
      fcmToken: doctorProfile.user.fcmToken, // doctor ke user model me fcmToken hona chahiye
      title: "New Appointment",
      body: `You have a new appointment on ${moment(appointmentDate).format("DD MMM YYYY")} at ${appointment.timeLabel}`,
      data: { appointmentId: savedAppointment._id.toString() },
      type: "appointment",
    });

    if (!notificationResult.success) {
      return res.status(500).json({
        success: false,
        message: "Appointment created but failed to notify doctor",
        error: notificationResult.error,
      });
    }

    res.status(201).json({
      success: true,
      message: "Appointment created & doctor notified",
      data: savedAppointment,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error creating appointment", error: error.message });
  }
};

// Get all appointments with filtering and pagination
export const getAppointments = async (req, res) => {
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
    
    // Build filter object based on user role
    let filter = { isActive: true };
    
    if (req.user.role === 'patient') {
      filter.patient = req.user.id;
    } else if (req.user.role === 'doctor') {
      filter.doctor = req.user.id;
    }
    
    // Add status filter if provided
    if (req.query.status) {
      filter.status = req.query.status;
    }
    
    // Add date range filter if provided
    if (req.query.startDate && req.query.endDate) {
      filter.appointmentDate = {
        $gte: new Date(req.query.startDate),
        $lte: new Date(req.query.endDate)
      };
    } else if (req.query.startDate) {
      filter.appointmentDate = {
        $gte: new Date(req.query.startDate)
      };
    } else if (req.query.endDate) {
      filter.appointmentDate = {
        $lte: new Date(req.query.endDate)
      };
    }
    
    // Execute query with pagination
    const appointments = await Appointment.find(filter)
      .populate('doctor', 'user specialization')
      .populate('patient', 'name email phone')
      .populate({
        path: 'doctor',
        populate: { path: 'user', select: 'name email' }
      })
      .skip(skip)
      .limit(limit)
      .sort({ appointmentDate: 1 });
    
    // Get total count for pagination
    const total = await Appointment.countDocuments(filter);
    
    res.json({
      success: true,
      data: appointments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    handleError(res, 500, 'Error fetching appointments', error);
  }
};

// Get appointment by ID
export const getAppointment = async (req, res) => {
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

    const appointment = await Appointment.findById(req.params.id)
      .populate('doctor', 'user specialization')
      .populate('patient', 'name email phone')
      .populate({
        path: 'doctor',
        populate: { path: 'user', select: 'name email' }
      });
    
    if (!appointment || !appointment.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }
    
    res.json({
      success: true,
      data: appointment
    });
  } catch (error) {
    handleError(res, 500, 'Error fetching appointment', error);
  }
};

// Update appointment
export const updateAppointment = async (req, res) => {
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

    const { reason, notes, symptoms, diagnosis } = req.body;
    
    const appointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      { 
        reason, 
        notes, 
        symptoms, 
        diagnosis,
        updatedAt: Date.now() 
      },
      { new: true, runValidators: true }
    )
    .populate('doctor', 'user specialization')
    .populate('patient', 'name email phone')
    .populate({
      path: 'doctor',
      populate: { path: 'user', select: 'name email' }
    });
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Appointment updated successfully',
      data: appointment
    });
  } catch (error) {
    handleError(res, 500, 'Error updating appointment', error);
  }
};

// Cancel appointment
export const cancelAppointment = async (req, res) => {
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

    const { reason } = req.body;
    const cancelledBy = req.user.role === 'patient' ? 'patient' : 
                      req.user.role === 'doctor' ? 'doctor' : 'admin';
    
    const appointment = await Appointment.findById(req.params.id);
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }
    
    // Use the instance method to cancel
    await appointment.cancel(reason, cancelledBy);
    
    // Populate before sending response
    await appointment.populate('doctor', 'user specialization')
                    .populate('patient', 'name email phone')
                    .populate({
                      path: 'doctor',
                      populate: { path: 'user', select: 'name email' }
                    });
    
    res.json({
      success: true,
      message: 'Appointment cancelled successfully',
      data: appointment
    });
  } catch (error) {
    handleError(res, 500, 'Error cancelling appointment', error);
  }
};

// Confirm appointment (doctor only)
export const confirmAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      { 
        status: 'confirmed',
        updatedAt: Date.now() 
      },
      { new: true, runValidators: true }
    )
    .populate('doctor', 'user specialization')
    .populate('patient', 'name email phone')
    .populate({
      path: 'doctor',
      populate: { path: 'user', select: 'name email' }
    });
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Appointment confirmed successfully',
      data: appointment
    });
  } catch (error) {
    handleError(res, 500, 'Error confirming appointment', error);
  }
};

// Complete appointment (doctor only)
export const completeAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      { 
        status: 'completed',
        updatedAt: Date.now() 
      },
      { new: true, runValidators: true }
    )
    .populate('doctor', 'user specialization')
    .populate('patient', 'name email phone')
    .populate({
      path: 'doctor',
      populate: { path: 'user', select: 'name email' }
    });
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Appointment marked as completed',
      data: appointment
    });
  } catch (error) {
    handleError(res, 500, 'Error completing appointment', error);
  }
};

// Reschedule appointment
export const rescheduleAppointment = async (req, res) => {
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

    const { newStart, newEnd } = req.body;
    const newDate = new Date(newStart);
    
    const appointment = await Appointment.findById(req.params.id);
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }
    
    // Check if the new time slot is available
    const isAvailable = await Appointment.isSlotAvailable(
      appointment.doctor,
      new Date(newStart),
      new Date(newEnd)
    );

    if (!isAvailable) {
      return res.status(409).json({
        success: false,
        message: 'Time slot is not available'
      });
    }
    
    // Use the instance method to reschedule
    await appointment.reschedule(new Date(newStart), new Date(newEnd), newDate);
    
    // Populate before sending response
    await appointment.populate('doctor', 'user specialization')
                    .populate('patient', 'name email phone')
                    .populate({
                      path: 'doctor',
                      populate: { path: 'user', select: 'name email' }
                    });
    
    res.json({
      success: true,
      message: 'Appointment rescheduled successfully',
      data: appointment
    });
  } catch (error) {
    handleError(res, 500, 'Error rescheduling appointment', error);
  }
};

// Check doctor availability
export const checkAvailability = async (req, res) => {
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

    const { doctorId, date, duration = 30 } = req.query;
    const targetDate = new Date(date);
    
    // Get doctor's profile with availability
    const doctor = await DoctorProfile.findById(doctorId);
    
    if (!doctor || !doctor.isActive || !doctor.isVerified) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found or not available'
      });
    }
    
    // Get existing appointments for the day
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));
    
    const existingAppointments = await Appointment.find({
      doctor: doctorId,
      appointmentDate: {
        $gte: startOfDay,
        $lte: endOfDay
      },
      status: { $in: ['pending', 'confirmed'] }
    });
    
    // Generate available slots based on doctor's availability
    const availableSlots = [];
    const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][targetDate.getDay()];
    
    if (doctor.availableDays && doctor.availableDays.includes(dayOfWeek)) {
      for (const window of doctor.dailyTimeWindows) {
        const [startHour, startMinute] = window.start.split(':').map(Number);
        const [endHour, endMinute] = window.end.split(':').map(Number);
        
        let currentTime = new Date(targetDate);
        currentTime.setHours(startHour, startMinute, 0, 0);
        
        const endTime = new Date(targetDate);
        endTime.setHours(endHour, endMinute, 0, 0);
        
        while (currentTime < endTime) {
          const slotEnd = new Date(currentTime.getTime() + duration * 60000);
          
          if (slotEnd > endTime) break;
          
          // Check if this slot is already booked
          const isBooked = existingAppointments.some(appt => {
            const apptStart = new Date(appt.timeSlot.start);
            const apptEnd = new Date(appt.timeSlot.end);
            
            return (
              (currentTime >= apptStart && currentTime < apptEnd) ||
              (slotEnd > apptStart && slotEnd <= apptEnd) ||
              (currentTime <= apptStart && slotEnd >= apptEnd)
            );
          });
          
          if (!isBooked) {
            availableSlots.push({
              start: new Date(currentTime),
              end: new Date(slotEnd)
            });
          }
          
          // Move to next slot
          currentTime = new Date(slotEnd);
        }
      }
    }
    
    res.json({
      success: true,
      data: {
        doctor: {
          _id: doctor._id,
          name: doctor.user.name,
          specialization: doctor.specialization
        },
        date: targetDate,
        availableSlots,
        duration: parseInt(duration)
      }
    });
  } catch (error) {
    handleError(res, 500, 'Error checking availability', error);
  }
};