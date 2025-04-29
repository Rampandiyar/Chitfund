import express from "express";
import {
    createBranch,
    getBranches,
    getBranchById,
    updateBranch,
    deleteBranch,
    getBranchesByStatus,
    searchBranches  // Add this import
} from "../controller/branch.controller.js";

const router = express.Router();

// Create a new branch
router.post("/", createBranch);

// Get all branches
router.get("/", getBranches);

// Search branches
router.get("/search", searchBranches);  // Add this route

// Get branches by status
router.get("/status/:status", getBranchesByStatus);

// Get a single branch by ID
router.get("/:id", getBranchById);

// Update a branch
router.put("/:id", updateBranch);

// Delete a branch (soft delete)
router.delete("/:id", deleteBranch);

export default router;