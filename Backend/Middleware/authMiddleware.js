import jwt from "jsonwebtoken";
import Employee from "../models/employee.js";

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith("Bearer")) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.employee = await Employee.findById(decoded.id)
        .select("-password")
        .populate('branch_id', 'branch_id bname');
      return next();  // Added return here
    } catch (error) {
      return res.status(401).json({  // Added return here
        success: false,
        message: "Not authorized, token failed" 
      });
    }
  }

  if (!token) {
    return res.status(401).json({  // Added return here
      success: false,
      message: "Not authorized, no token" 
    });
  }
};

// Admin middleware
const admin = (req, res, next) => {
  if (req.employee?.role === "Admin") {
    next();
  } else {
    res.status(403).json({ 
      success: false,
      message: "Not authorized as admin" 
    });
  }
};

// Manager middleware
const manager = (req, res, next) => {
  if (req.employee?.role === "Manager" || req.employee?.role === "Admin") {
    next();
  } else {
    res.status(403).json({ 
      success: false,
      message: "Not authorized as manager" 
    });
  }
};

// Employee middleware (basic access)
const employee = (req, res, next) => {
  if (req.employee?.role === "Employee" || 
      req.employee?.role === "Manager" || 
      req.employee?.role === "Admin") {
    next();
  } else {
    res.status(403).json({ 
      success: false,
      message: "Not authorized" 
    });
  }
};

// Branch-specific access
const sameBranchOrAdmin = (req, res, next) => {
  if (req.employee.role === "Admin" || 
      req.employee.branch_id._id.equals(req.params.branchId)) {
    next();
  } else {
    res.status(403).json({ 
      success: false,
      message: "Not authorized for this branch" 
    });
  }
};

export { protect, admin, manager, employee, sameBranchOrAdmin };