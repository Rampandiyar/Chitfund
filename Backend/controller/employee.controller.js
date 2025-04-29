import Employee from "../models/employee.js";
import Branch from "../models/branch.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

// Helper function to generate token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "2hrs",
  });
};

// Helper to normalize branch reference
const normalizeBranch = async (branchRef) => {
  if (mongoose.Types.ObjectId.isValid(branchRef)) {
    const branch = await Branch.findById(branchRef);
    return branch?._id;
  }
  const branch = await Branch.findOne({ branch_id: branchRef });
  return branch?._id;
};

// @desc    Register new employee (Admin only)
// @route   POST /api/employees/register
export const registerEmployee = async (req, res) => {
  try {
    const { branch_id, ...employeeData } = req.body;

    // Validate branch
    const branch = await normalizeBranch(branch_id);
    if (!branch) {
      return res.status(400).json({ 
        success: false,
        message: "Branch not found" 
      });
    }

    // Check if employee exists
    const exists = await Employee.findOne({ email: employeeData.email });
    if (exists) {
      return res.status(400).json({ 
        success: false,
        message: "Employee already exists" 
      });
    }

    // Create employee
    const newEmployee = await Employee.create({
      ...employeeData,
      branch_id: branch
    });

    res.status(201).json({
      success: true,
      data: {
        _id: newEmployee._id,
        emp_id: newEmployee.emp_id,
        emp_name: newEmployee.emp_name,
        email: newEmployee.email,
        role: newEmployee.role,
        branch_id: branch
      }
    });

  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

// @desc    Authenticate employee
// @route   POST /api/employees/login
export const authEmployee = async (req, res) => {
  try {
    const { email, password } = req.body;

    const employee = await Employee.findOne({ email })
      .populate('branch_id', 'branch_id bname');
    
    if (!employee || !(await employee.comparePassword(password))) {
      return res.status(401).json({ 
        success: false,
        message: "Invalid credentials" 
      });
    }

    if (employee.status !== 'Active') {
      return res.status(403).json({ 
        success: false,
        message: "Account is inactive" 
      });
    }

    res.json({
      success: true,
      data: {
        _id: employee._id,
        emp_id: employee.emp_id,
        emp_name: employee.emp_name,
        email: employee.email,
        role: employee.role,
        branch: employee.branch_id,
        token: generateToken(employee._id)
      }
    });

  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

// @desc    Get all employees (Manager+)
// @route   GET /api/employees
export const getEmployees = async (req, res) => {
  try {
    // Admins see all, managers see only their branch
    const filter = req.employee.role === 'Admin' ? {} : { 
      branch_id: req.employee.branch_id 
    };

    const employees = await Employee.find(filter)
      .select('-password')
      .populate('branch_id', 'branch_id bname');

    res.json({
      success: true,
      count: employees.length,
      data: employees
    });

  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

// @desc    Get employees by branch (Manager+)
// @route   GET /api/employees/branch/:branchId
export const getEmployeesByBranch = async (req, res) => {
  try {
    // Admins can access any branch, managers only their own
    if (req.employee.role === 'Manager' && 
        !req.employee.branch_id.equals(req.params.branchId)) {
      return res.status(403).json({ 
        success: false,
        message: "Not authorized for this branch" 
      });
    }

    const employees = await Employee.find({ branch_id: req.params.branchId })
      .select('-password')
      .populate('branch_id', 'branch_id bname');

    res.json({
      success: true,
      count: employees.length,
      data: employees
    });

  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

// @desc    Get employee by ID (Employee+)
// @route   GET /api/employees/:id
export const getEmployeeById = async (req, res) => {
  try {
    // Employees can only view their own profile unless Manager/Admin
    if (req.employee.role === 'Employee' && 
        !req.employee._id.equals(req.params.id)) {
      return res.status(403).json({ 
        success: false,
        message: "Not authorized" 
      });
    }

    const employee = await Employee.findById(req.params.id)
      .select('-password')
      .populate('branch_id', 'branch_id bname');

    if (!employee) {
      return res.status(404).json({ 
        success: false,
        message: "Employee not found" 
      });
    }

    res.json({
      success: true,
      data: employee
    });

  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

// @desc    Get employee profile (self)
// @route   GET /api/employees/profile
export const getEmployeeProfile = async (req, res) => {
  try {
    const employee = await Employee.findById(req.employee._id)
      .select('-password')
      .populate('branch_id', 'branch_id bname');

    res.json({
      success: true,
      data: employee
    });

  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

// @desc    Update employee (self)
// @route   PUT /api/employees/:id
export const updateEmployee = async (req, res) => {
  try {
    // Employees can only update their own profile
    if (req.employee.role === 'Employee' && 
        !req.employee._id.equals(req.params.id)) {
      return res.status(403).json({ 
        success: false,
        message: "Not authorized" 
      });
    }

    const { password, role, branch_id, ...updateData } = req.body;

    // Prevent non-admins from updating sensitive fields
    if (req.employee.role !== 'Admin') {
      if (role) delete updateData.role;
      if (branch_id) delete updateData.branch_id;
    }

    const updatedEmployee = await Employee.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      data: updatedEmployee
    });

  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

// @desc    Update employee profile (self)
// @route   PUT /api/employees/profile
export const updateEmployeeProfile = async (req, res) => {
  try {
    const { password, ...updateData } = req.body;

    const updatedEmployee = await Employee.findByIdAndUpdate(
      req.employee._id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      data: updatedEmployee
    });

  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

// @desc    Update employee role (Manager+)
// @route   PUT /api/employees/:id/role
export const updateEmployeeRole = async (req, res) => {
  try {
    const { role } = req.body;

    // Managers can't assign Admin role or modify other managers
    if (req.employee.role === 'Manager') {
      if (role === 'Admin') {
        return res.status(403).json({ 
          success: false,
          message: "Not authorized to assign admin role" 
        });
      }

      const targetEmployee = await Employee.findById(req.params.id);
      if (targetEmployee?.role === 'Manager') {
        return res.status(403).json({ 
          success: false,
          message: "Not authorized to modify other managers" 
        });
      }
    }

    const updatedEmployee = await Employee.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    ).select('-password');

    res.json({
      success: true,
      data: updatedEmployee
    });

  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

// @desc    Delete employee (Admin only)
// @route   DELETE /api/employees/:id
export const deleteEmployee = async (req, res) => {
  try {
    // Prevent deleting self
    if (req.employee._id.equals(req.params.id)) {
      return res.status(400).json({ 
        success: false,
        message: "Cannot delete your own account" 
      });
    }

    const deletedEmployee = await Employee.findByIdAndDelete(req.params.id);

    if (!deletedEmployee) {
      return res.status(404).json({ 
        success: false,
        message: "Employee not found" 
      });
    }

    res.json({
      success: true,
      data: { _id: deletedEmployee._id }
    });

  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

// @desc    Search employees (Manager+)
// @route   GET /api/employees/search
export const searchEmployees = async (req, res) => {
  try {
    const { q } = req.query;
    let filter = {};

    // Managers can only search in their branch
    if (req.employee.role === 'Manager') {
      filter.branch_id = req.employee.branch_id;
    }

    if (q) {
      filter.$or = [
        { emp_name: { $regex: q, $options: 'i' } },
        { emp_id: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } }
      ];
    }

    const employees = await Employee.find(filter)
      .select('-password')
      .populate('branch_id', 'branch_id bname');

    res.json({
      success: true,
      count: employees.length,
      data: employees
    });

  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};