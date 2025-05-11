import express from "express";
import {
  registerEmployee,
  authEmployee,
  getEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
  searchEmployees,
  getEmployeesByBranch,
  updateEmployeeRole,
  getEmployeeProfile,
  updateEmployeeProfile,
  uploadEmployeePhoto,
  getEmployeePhoto
} from "../controller/employee.controller.js";
import { protect, admin, manager, employee, sameBranchOrAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public routes
router.post("/login", authEmployee);

// Admin-only routes
router.post("/register", registerEmployee);
router.delete("/:id", protect, admin, deleteEmployee);

// Manager+ routes
router.get("/branch/:branchId", protect, manager, getEmployeesByBranch);
router.put("/:id/role", protect, manager, updateEmployeeRole);

// Employee+ routes (all authenticated employees)
router.get("/profile", protect, employee, getEmployeeProfile);
router.put("/profile", protect, employee, updateEmployeeProfile);

// Protected routes with different access levels
router.route("/")
  .get(protect, manager, getEmployees)
  .post(protect, admin, registerEmployee);

router.route("/search")
  .get(protect, manager, searchEmployees);

router.route("/:id")
  .get(protect, employee, getEmployeeById)
  .put(protect, employee, updateEmployee);  // Employees can update their own profile

  router.put('/:id/photo', uploadEmployeePhoto);
  router.get('/:id/photo', getEmployeePhoto);
export default router;