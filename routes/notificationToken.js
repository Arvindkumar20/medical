import express from 'express';
import {
  createOrUpdateToken,
  deactivateToken,
  deactivateAllUserTokens,
  getUserTokens,
  getTokenById,
  cleanupExpiredTokens
} from '../controllers/notificationTokenController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

// All routes require proentication
router.use(protect);

// Create or update a notification token
router.post('/', createOrUpdateToken);

// Get all active tokens for the proenticated user
router.get('/', getUserTokens);
// router.get('/', getUserToken);

// Get a specific token by ID
router.get('/:tokenId', getTokenById);

// Deactivate a specific token
router.delete('/:tokenId', deactivateToken);

// Deactivate all tokens for the proenticated user
router.delete('/', deactivateAllUserTokens);

// Clean up expired tokens (admin only)
router.post('/cleanup', cleanupExpiredTokens);

export const fcmTokenRouter= router;