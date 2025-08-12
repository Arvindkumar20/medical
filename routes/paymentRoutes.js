// routes/paymentRoutes.js
import express from 'express';
import paymentController from '../controllers/paymentController.js';

const router = express.Router();

// Razorpay Integration
router.post('/create-order', paymentController.createRazorpayOrder);
router.post('/verify', paymentController.verifyRazorpayPayment);
router.post('/webhook/razorpay', express.json(), paymentController.handleRazorpayWebhook);

export const paymentRouter= router;