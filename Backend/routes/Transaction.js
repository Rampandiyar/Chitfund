import express from "express";
import {
  createTransaction,
  getTransactions,
  getTransactionById,
  updateTransaction,
  reverseTransaction,
  getTransactionSummary,
  getMemberTransactionSummary
} from "../controller/transaction.controller.js";
import { protect, manager } from "../middleware/authMiddleware.js";

const router = express.Router();

// Manager+ routes
router.post("/", protect, manager, createTransaction);
router.post("/:id/reverse", protect, manager, reverseTransaction);

// Protected routes
router.get("/", protect, getTransactions);
router.get("/summary", protect, getTransactionSummary);
router.get("/:id", protect, getTransactionById);
router.put("/:id", protect, manager, updateTransaction);

// Member-specific route
router.get("/members/:id/summary", protect, getMemberTransactionSummary);

export default router;