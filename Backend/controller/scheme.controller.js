import Scheme from "../models/scheme.js";
import Employee from "../models/employee.js";

// @desc    Create a new scheme
// @route   POST /api/schemes
export const createScheme = async (req, res) => {
  try {
    const { created_by, ...schemeData } = req.body;

    // Validate creator exists if provided
    if (created_by) {
      const creator = await Employee.findById(created_by);
      if (!creator) {
        return res.status(400).json({
          success: false,
          message: "Creator employee not found"
        });
      }
    }

    // Validate installment amount calculation
    const calculatedInstallment = schemeData.chit_amount / schemeData.duration_months;
    if (Math.abs(calculatedInstallment - schemeData.installment_amount) > 1) {
      return res.status(400).json({
        success: false,
        message: `Installment amount should be approximately ${calculatedInstallment.toFixed(2)} for this scheme`
      });
    }

    // Validate min/max members
    if (schemeData.min_members >= schemeData.max_members) {
      return res.status(400).json({
        success: false,
        message: "Minimum members must be less than maximum members"
      });
    }

    const scheme = await Scheme.create({
      ...schemeData,
      created_by: created_by || req.employee._id
    });

    res.status(201).json({
      success: true,
      data: scheme
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get all schemes
// @route   GET /api/schemes
export const getSchemes = async (req, res) => {
  try {
    const { enabled, type, search } = req.query;
    const filter = {};

    if (enabled) filter.enabled = enabled === 'true';
    if (search) {
      filter.$or = [
        { scheme_name: { $regex: search, $options: 'i' } },
        { scheme_id: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by approximate scheme size if type provided
    if (type) {
      const ranges = {
        small: { $lt: 100000 },
        medium: { $gte: 100000, $lt: 500000 },
        large: { $gte: 500000 }
      };
      if (ranges[type]) filter.chit_amount = ranges[type];
    }

    const schemes = await Scheme.find(filter)
      .populate('created_by', 'emp_id emp_name')
      .sort({ chit_amount: -1 });

    res.json({
      success: true,
      count: schemes.length,
      data: schemes
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get scheme by ID
// @route   GET /api/schemes/:id
export const getSchemeById = async (req, res) => {
  try {
    const scheme = await Scheme.findOne({
      $or: [
        { _id: req.params.id },
        { scheme_id: req.params.id }
      ]
    }).populate('created_by', 'emp_id emp_name role');

    if (!scheme) {
      return res.status(404).json({
        success: false,
        message: "Scheme not found"
      });
    }

    // Calculate derived values
    const totalCommission = scheme.chit_amount * (scheme.commission_rate / 100);
    const netPayout = scheme.chit_amount - totalCommission;

    res.json({
      success: true,
      data: {
        ...scheme.toObject(),
        total_commission: totalCommission,
        net_payout: netPayout
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update scheme
// @route   PUT /api/schemes/:id
export const updateScheme = async (req, res) => {
  try {
    // Prevent updating scheme_id
    if (req.body.scheme_id) {
      delete req.body.scheme_id;
    }

    // Don't allow changing created_by
    if (req.body.created_by) {
      delete req.body.created_by;
    }

    const scheme = await Scheme.findOneAndUpdate(
      { 
        $or: [
          { _id: req.params.id },
          { scheme_id: req.params.id }
        ]
      },
      req.body,
      { new: true, runValidators: true }
    ).populate('created_by', 'emp_id emp_name');

    if (!scheme) {
      return res.status(404).json({
        success: false,
        message: "Scheme not found"
      });
    }

    res.json({
      success: true,
      data: scheme
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Toggle scheme status
// @route   PATCH /api/schemes/:id/status
export const toggleSchemeStatus = async (req, res) => {
  try {
    const scheme = await Scheme.findOneAndUpdate(
      { 
        $or: [
          { _id: req.params.id },
          { scheme_id: req.params.id }
        ]
      },
      { enabled: req.body.enabled },
      { new: true }
    );

    if (!scheme) {
      return res.status(404).json({
        success: false,
        message: "Scheme not found"
      });
    }

    res.json({
      success: true,
      data: {
        scheme_id: scheme.scheme_id,
        scheme_name: scheme.scheme_name,
        enabled: scheme.enabled
      },
      message: `Scheme ${scheme.enabled ? 'enabled' : 'disabled'} successfully`
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get scheme statistics
// @route   GET /api/schemes/stats
export const getSchemeStats = async (req, res) => {
  try {
    const stats = await Scheme.aggregate([
      {
        $group: {
          _id: null,
          totalSchemes: { $sum: 1 },
          activeSchemes: { $sum: { $cond: [{ $eq: ["$enabled", true] }, 1, 0] } },
          averageChitAmount: { $avg: "$chit_amount" },
          minChitAmount: { $min: "$chit_amount" },
          maxChitAmount: { $max: "$chit_amount" }
        }
      },
      {
        $project: {
          _id: 0,
          totalSchemes: 1,
          activeSchemes: 1,
          inactiveSchemes: { $subtract: ["$totalSchemes", "$activeSchemes"] },
          averageChitAmount: { $round: ["$averageChitAmount", 2] },
          minChitAmount: 1,
          maxChitAmount: 1
        }
      }
    ]);

    res.json({
      success: true,
      data: stats[0] || {}
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete scheme
// @route   DELETE /api/schemes/:id
export const deleteScheme = async (req, res) => {
  try {
    // Check if any groups are using this scheme
    const groupCount = await mongoose.model('Group').countDocuments({ 
      scheme_id: req.params.id 
    });

    if (groupCount > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete scheme with active groups"
      });
    }

    const scheme = await Scheme.findOneAndDelete({
      $or: [
        { _id: req.params.id },
        { scheme_id: req.params.id }
      ]
    });

    if (!scheme) {
      return res.status(404).json({
        success: false,
        message: "Scheme not found"
      });
    }

    res.json({
      success: true,
      data: {
        scheme_id: scheme.scheme_id,
        scheme_name: scheme.scheme_name
      },
      message: "Scheme deleted successfully"
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};