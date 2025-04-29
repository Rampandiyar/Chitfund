import express from 'express';
import {
  createNotification,
  getNotifications,
  getNotificationById,
  markAsRead,
  getUnreadCount,
  getMyNotifications,
  getNotificationStats
} from '../controller/notification.controller.js';
import { protect, manager } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes (if any)

// Protected routes
router.use(protect);

// Basic employee routes
router.route('/')
  .get(getNotifications)
  .post(createNotification);

router.route('/my')
  .get(getMyNotifications);

router.route('/unread/count')
  .get(getUnreadCount);

router.route('/:id')
  .get(getNotificationById);

router.route('/:id/read')
  .patch(markAsRead);

// Manager/admin only routes
router.use(manager);

router.route('/stats')
  .get(getNotificationStats);

export default router;