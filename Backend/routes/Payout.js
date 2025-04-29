import express from 'express';
import {
  createPayout,
  getPayouts,
  getPayoutById,
  processPayout,
  skipPayout,
  getPayoutStats,
  getMemberPayouts
} from '../controller/payout.controller.js';
import { protect, manager } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes (if any)

// Protected routes
router.use(protect);

// Basic employee routes
router.route('/')
  .get(getPayouts)
  .post(createPayout);

router.route('/:id')
  .get(getPayoutById);

router.route('/:id/process')
  .post(processPayout);

router.route('/:id/skip')
  .post(skipPayout);

router.route('/members/:member_id/payouts')
  .get(getMemberPayouts);

// Manager/admin only routes
router.use(manager);

router.route('/stats')
  .get(getPayoutStats);

export default router;