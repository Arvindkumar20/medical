// routes/notificationRoutes.js
import express from "express";
import {
  getNotifications,
  getNotification,
  createNotification,
  updateNotification,
  deleteNotification,
  markAsRead,
  markAllAsRead,
  getUnreadNotifications,
  cleanupExpiredNotifications
} from "../controllers/notificationController.js";

import { protect } from "../middlewares/authMiddleware.js";
import { validateNotification } from "../middlewares/notificationValidation.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// GET /api/notifications - Get notifications with filtering
router.get("/", getNotifications);

// GET /api/notifications/:id - Get specific notification
router.get("/:id", getNotification);

// POST /api/notifications - Create a new notification
router.post("/", validateNotification, createNotification);

// PATCH /api/notifications/:id - Update a notification
router.patch("/:id", validateNotification, updateNotification);

// DELETE /api/notifications/:id - Delete a notification
router.delete("/:id", deleteNotification);

// PATCH /api/notifications/:id/read - Mark notification as read
router.patch("/:id/read", markAsRead);

// PATCH /api/notifications/read-all - Mark all notifications as read for user
router.patch("/read-all", markAllAsRead);

// GET /api/notifications/user/:userId/unread - Get unread notifications for a user
router.get("/user/:userId/unread", getUnreadNotifications);

// POST /api/notifications/cleanup - Cleanup expired notifications (admin only)
router.post("/cleanup", cleanupExpiredNotifications);

export const notificationRouter= router;