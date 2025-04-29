import express from 'express';
import {
  createLedgerEntry,
  getLedgerEntries,
  getLedgerEntryById,
  getMemberLedger,
  updateLedgerEntry,
  getLedgerStats
} from '../controller/ledger.controller.js';
import { protect, manager } from '../middleware/authMiddleware.js';

const router = express.Router();

// Protected routes
router.use(protect);

// Basic employee routes
router.get('/',protect, getLedgerEntries);
router.post('/', createLedgerEntry);
router.get('/:id', getLedgerEntryById);
router.put('/:id', updateLedgerEntry);
router.get('/members/:member_id/ledger', getMemberLedger);

// Manager/admin only routes
router.use(manager);
router.get('/stats', getLedgerStats);

export default router;