import express from "express";
import {
  createInstallment,
  getInstallments,
  getInstallmentById,
  recordPayment,
  updateInstallment,
  getInstallmentStats
} from "../controller/installment.controller.js";
import { protect, manager } from "../middleware/authMiddleware.js";

const router = express.Router();

// Manager+ routes
router.post("/", protect, manager, createInstallment);
router.post("/:id/pay", protect, manager, recordPayment);

// Protected routes
router.get("/", protect, getInstallments);
router.get("/stats", protect, getInstallmentStats);
router.get("/:id", protect, getInstallmentById);
router.put("/:id", protect, manager, updateInstallment);

export default router;