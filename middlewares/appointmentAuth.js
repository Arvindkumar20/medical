import { Appointment } from '../models/Appointment.js';
import { DoctorProfile } from '../models/DoctorProfile.js';

export const checkAppointmentOwnership = async (req, res, next) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }
    
    // Allow admins to access any appointment
    if (req.user.role === 'admin') {
      return next();
    }
    
    // Check if the user is the patient or doctor of the appointment
    if (
      appointment.patient.toString() !== req.user.id &&
      appointment.doctor.toString() !== req.user.id
    ) {
      return res.status(403).json({
        message: 'User not authorized to access this appointment'
      });
    }
    
    next();
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const checkDoctorAppointment = async (req, res, next) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }
    
    // Allow admins to access any appointment
    if (req.user.role === 'admin') {
      return next();
    }
    
    // Check if the user is the doctor of the appointment
    if (appointment.doctor.toString() !== req.user.id) {
      return res.status(403).json({
        message: 'Only the assigned doctor can perform this action'
      });
    }
    
    next();
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};