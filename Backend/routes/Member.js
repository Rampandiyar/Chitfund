import express from "express";
import {
  registerMember,
  getMembers,
  getMemberById,
  updateMember,
  toggleMemberStatus,
  getMemberStats,
  deleteMember
} from "../controller/member.controller.js";
import { protect, manager } from "../middleware/authMiddleware.js";

const router = express.Router();

// Manager+ routes
router.post("/", protect, manager, registerMember);
router.delete("/:id", protect, manager, deleteMember);

// Protected routes
router.get("/", protect, getMembers);
router.get("/stats", protect, getMemberStats);
router.get("/:id", protect, getMemberById);
router.put("/:id", protect, manager, updateMember);
router.patch("/:id/status", protect, manager, toggleMemberStatus);

export default router;