import express from "express";
import {
  createReceipt,
  getReceipts,
  getReceiptById,
  updateReceipt,
  cancelReceipt,
  getReceiptStats
} from "../controller/receipt.controller.js";
import { protect, manager } from "../middleware/authMiddleware.js";

const router = express.Router();

// Manager+ routes
router.post("/", protect, manager, createReceipt);
router.patch("/:id/cancel", protect, manager, cancelReceipt);

// Protected routes
router.get("/", protect, getReceipts);
router.get("/stats", protect, getReceiptStats);
router.get("/:id", protect, getReceiptById);
router.put("/:id", protect, manager, updateReceipt);

export default router;