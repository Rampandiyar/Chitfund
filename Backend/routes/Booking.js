import express from 'express';
import {
  createBooking,
  getBookings,
  getBookingById,
  confirmBooking,
  rejectBooking,
  getBookingStats,
  getMemberBookings
} from '../controller/booking.controller.js';
import { protect, manager } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes (if any)

// Protected routes
router.use(protect);

// Basic employee routes
router.route('/')
  .get(getBookings)
  .post(createBooking);

router.route('/:id')
  .get(getBookingById);

router.route('/:id/confirm')
  .post(confirmBooking);

router.route('/:id/reject')
  .post(rejectBooking);

router.route('/members/:member_id/bookings')
  .get(getMemberBookings);

// Manager/admin only routes
router.use(manager);

router.route('/stats')
  .get(getBookingStats);

export default router;