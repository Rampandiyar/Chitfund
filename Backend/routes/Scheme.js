import express from "express";
import {
  createScheme,
  getSchemes,
  getSchemeById,
  updateScheme,
  toggleSchemeStatus,
  getSchemeStats,
  deleteScheme
} from "../controller/scheme.controller.js";
import { protect, admin, manager } from "../middleware/authMiddleware.js";

const router = express.Router();

// Admin-only routes
router.post("/", protect, admin, createScheme);
router.delete("/:id", protect, admin, deleteScheme);

// Manager+ routes
router.put("/:id", protect, manager, updateScheme);
router.patch("/:id/status", protect, manager, toggleSchemeStatus);

// Protected routes
router.get("/", protect, getSchemes);
router.get("/stats", protect, getSchemeStats);
router.get("/:id", protect, getSchemeById);

export default router;