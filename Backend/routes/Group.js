import express from "express";
import {
  createGroup,
  getGroups,
  getGroupById,
  updateGroup,
  addGroupMember,
  removeGroupMember,
  advanceGroupMonth,
  deleteGroup
} from "../controller/group.controller.js";
import { protect, manager } from "../middleware/authMiddleware.js";

const router = express.Router();

// Manager+ routes
router.post("/", protect, manager, createGroup);
router.post("/:id/members", protect, manager, addGroupMember);
router.delete("/:id/members/:memberId", protect, manager, removeGroupMember);
router.post("/:id/advance", protect, manager, advanceGroupMonth);
router.delete("/:id", protect, manager, deleteGroup);

// Protected routes
router.get("/", protect, getGroups);
router.get("/:id", protect, getGroupById);
router.put("/:id", protect, manager, updateGroup);

export default router;