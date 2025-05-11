import express from "express";
import {
  registerMember,
  getMembers,
  getMemberById,
  updateMember,
  toggleMemberStatus,
  getMemberStats,
  deleteMember,
  uploadMemberPhoto,
  getMemberPhoto
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
router.put('/:id/photo', uploadMemberPhoto);
router.get('/:id/photo', getMemberPhoto);
export default router;