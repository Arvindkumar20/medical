// controllers/notificationController.js
import { Notification } from "../models/Notification.js";
import { User } from "../models/User.js";
import { Store } from "../models/Store.js";
import { Product } from "../models/Product.js";
import { validationResult } from "express-validator";
import { logger } from "../utils/logger.js";
import { rateLimiter } from "../middlewares/rateLimiter.js";

// GET /api/notifications - Get notifications with filtering
export const getNotifications = [
  rateLimiter(100, 15 * 60),
  async (req, res, next) => {
    try {
      const {
        page = 1,
        limit = 20,
        isRead,
        type,
        priority,
        id,
        storeId,
        productId
      } = req.query;

      // Build filter
      const filter = {};

      if (id) {
        filter.id = id;
      } else if (!req.user.isAdmin) {
        // Non-admin users can only see their own notifications
        filter.id = req.user.id;
      }

      if (storeId) filter.storeId = storeId;
      if (productId) filter.productId = productId;
      if (isRead !== undefined) filter.isRead = isRead === "true";
      if (type) filter.type = type;
      if (priority) filter.priority = priority;

      // Pagination
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;

      // Get notifications
      const [notifications, total] = await Promise.all([
        Notification.find({})
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .populate("userId", "name email")
          .populate("storeId", "name")
          .populate("productId", "name images"),
        Notification.countDocuments(filter)
      ]);
      console.log(notifications);
      res.json({
        success: true,
        data: notifications,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      });
    } catch (error) {
      logger.error(`Error in getNotifications: ${error.message}`, {
        stack: error.stack,
        id: req.user?.id
      });
      next(error);
    }
  }
];

// GET /api/notifications/:id - Get specific notification
export const getNotification = [
  rateLimiter(100, 15 * 60),
  async (req, res, next) => {
    try {
      const notification = await Notification.findById(req.params.id)
        .populate("userId", "name email")
        .populate("storeId", "name")
        .populate("productId", "name images price variants");

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: "Notification not found"
        });
      }

      // Check if user has permission to view this notification
      if (!req.user.isAdmin && notification.id.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: "Access denied"
        });
      }

      res.json({
        success: true,
        data: notification
      });
    } catch (error) {
      logger.error(`Error in getNotification: ${error.message}`, {
        stack: error.stack,
        notificationId: req.params.id,
        id: req.user?.id
      });
      next(error);
    }
  }
];

// POST /api/notifications - Create a new notification
export const createNotification = [
  rateLimiter(50, 15 * 60),
  async (req, res, next) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      // Check if user exists
      const user = await User.findById(req.body.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }

      // Check if store exists
      const store = await Store.findById(req.body.storeId);
      if (!store) {
        return res.status(404).json({
          success: false,
          message: "Store not found"
        });
      }

      // Check if product exists
      const product = await Product.findById(req.body.productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Product not found"
        });
      }

      // Create notification
      const notification = await Notification.create(req.body);

      // Populate references for response
      await notification.populate("userId", "name email");
      await notification.populate("storeId", "name");
      await notification.populate("productId", "name images price variants");

      logger.info(`Notification created: ${notification._id}`, {
        notificationId: notification._id,
        id: notification.id,
        createdBy: req.user?.id
      });

      res.status(201).json({
        success: true,
        data: notification
      });
    } catch (error) {
      logger.error(`Error in createNotification: ${error.message}`, {
        stack: error.stack,
        body: req.body,
        id: req.user?.id
      });
      next(error);
    }
  }
];

// PATCH /api/notifications/:id - Update a notification
export const updateNotification = [
  rateLimiter(50, 15 * 60),
  async (req, res, next) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      // Find notification
      const notification = await Notification.findById(req.params.id);
      if (!notification) {
        return res.status(404).json({
          success: false,
          message: "Notification not found"
        });
      }

      // Check permissions
      if (!req.user.isAdmin && notification.id.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: "Access denied"
        });
      }

      // Update notification
      const updatedNotification = await Notification.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
      )
        .populate("id", "name email")
        .populate("storeId", "name")
        .populate("productId", "name images price variants");

      logger.info(`Notification updated: ${req.params.id}`, {
        notificationId: req.params.id,
        updatedBy: req.user?.id
      });

      res.json({
        success: true,
        data: updatedNotification
      });
    } catch (error) {
      logger.error(`Error in updateNotification: ${error.message}`, {
        stack: error.stack,
        notificationId: req.params.id,
        id: req.user?.id
      });
      next(error);
    }
  }
];

// DELETE /api/notifications/:id - Delete a notification
export const deleteNotification = [
  rateLimiter(30, 15 * 60),
  async (req, res, next) => {
    try {
      // Find notification
      const notification = await Notification.findById(req.params.id);
      if (!notification) {
        return res.status(404).json({
          success: false,
          message: "Notification not found"
        });
      }

      // Check permissions
      if (!req.user.isAdmin && notification.id.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: "Access denied"
        });
      }

      // Delete notification
      await Notification.findByIdAndDelete(req.params.id);

      logger.info(`Notification deleted: ${req.params.id}`, {
        notificationId: req.params.id,
        deletedBy: req.user?.id
      });

      res.json({
        success: true,
        message: "Notification deleted successfully"
      });
    } catch (error) {
      logger.error(`Error in deleteNotification: ${error.message}`, {
        stack: error.stack,
        notificationId: req.params.id,
        id: req.user?.id
      });
      next(error);
    }
  }
];

// PATCH /api/notifications/:id/read - Mark notification as read
export const markAsRead = [
  rateLimiter(100, 15 * 60),
  async (req, res, next) => {
    try {
      // Find notification
      const notification = await Notification.findById(req.params.id);
      if (!notification) {
        return res.status(404).json({
          success: false,
          message: "Notification not found"
        });
      }

      // Check permissions
      if (!req.user.id && notification.id.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: "Access denied"
        });
      }

      // Mark as read
      const updatedNotification = await notification.markAsRead();
      await updatedNotification.populate("userId", "name email");
      await updatedNotification.populate("storeId", "name");
      await updatedNotification.populate("productId", "name images price variants");

      logger.info(`Notification marked as read: ${req.params.id}`, {
        notificationId: req.params.id,
        id: req.user?.id
      });

      res.json({
        success: true,
        data: updatedNotification
      });
    } catch (error) {
      logger.error(`Error in markAsRead: ${error.message}`, {
        stack: error.stack,
        notificationId: req.params.id,
        id: req.user?.id
      });
      next(error);
    }
  }
];

// PATCH /api/notifications/read-all - Mark all notifications as read for user
export const markAllAsRead = [
  rateLimiter(50, 15 * 60),
  async (req, res, next) => {
    try {
      const id = req.user.isAdmin && req.body.userId ? req.body.userId : req.user.id;

      // Mark all as read
      const result = await Notification.markAllAsRead(id);

      logger.info(`All notifications marked as read for user: ${id}`, {
        id,
        modifiedCount: result.modifiedCount,
        updatedBy: req.user?.id
      });

      res.json({
        success: true,
        message: `Marked ${result.modifiedCount} notifications as read`,
        data: { modifiedCount: result.modifiedCount }
      });
    } catch (error) {
      logger.error(`Error in markAllAsRead: ${error.message}`, {
        stack: error.stack,
        id: req.user?.id
      });
      next(error);
    }
  }
];

// GET /api/notifications/user/:id/unread - Get unread notifications for a user
export const getUnreadNotifications = [
  rateLimiter(100, 15 * 60),
  async (req, res, next) => {
    try {
      const id = req.params.id;
      const limit = parseInt(req.query.limit) || 20;

      // Check permissions
      if (!req.user.id && id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: "Access denied"
        });
      }

      // Get unread notifications
      const notifications = await Notification.findUnreadByUser(id, limit);

      res.json({
        success: true,
        data: notifications,
        count: notifications.length
      });
    } catch (error) {
      logger.error(`Error in getUnreadNotifications: ${error.message}`, {
        stack: error.stack,
        id: req.params.id
      });
      next(error);
    }
  }
];

// POST /api/notifications/cleanup - Cleanup expired notifications (admin only)
export const cleanupExpiredNotifications = [
  rateLimiter(10, 60 * 60),
  async (req, res, next) => {
    try {
      // Check if user is admin
      if (!req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: "Access denied. Admin only."
        });
      }

      // Cleanup expired notifications
      const result = await Notification.cleanupExpired();

      logger.info(`Expired notifications cleaned up`, {
        deletedCount: result.deletedCount,
        cleanedBy: req.user?.id
      });

      res.json({
        success: true,
        message: `Deleted ${result.deletedCount} expired notifications`,
        data: { deletedCount: result.deletedCount }
      });
    } catch (error) {
      logger.error(`Error in cleanupExpiredNotifications: ${error.message}`, {
        stack: error.stack,
        id: req.user?.id
      });
      next(error);
    }
  }
];