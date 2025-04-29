import Installment from "../models/installment.js";
import Group from "../models/group.js";
import Member from "../models/member.js";
import Scheme from "../models/scheme.js";
import Employee from "../models/employee.js";
import Receipt from "../models/receipt.js";

// Helper function to validate references
const validateReferences = async (groupId, memberId, schemeId, collectedById) => {
  const [group, member, scheme, employee] = await Promise.all([
    Group.findById(groupId),
    Member.findById(memberId),
    Scheme.findById(schemeId),
    collectedById ? Employee.findById(collectedById) : Promise.resolve(null)
  ]);

  if (!group) throw new Error('Group not found');
  if (!member) throw new Error('Member not found');
  if (!scheme) throw new Error('Scheme not found');
  if (collectedById && !employee) throw new Error('Collecting employee not found');
  
  return { group, member, scheme, employee };
};

// @desc    Create an installment
// @route   POST /api/installments
export const createInstallment = async (req, res) => {
  try {
    const { group_id, member_id, scheme_id, collected_by, ...installmentData } = req.body;

    // Validate references
    const { group, member } = await validateReferences(
      group_id,
      member_id,
      scheme_id,
      collected_by || req.employee._id
    );

    // Verify member belongs to group
    if (!group.members.some(m => m.member_id.equals(member_id))) {
      throw new Error('Member does not belong to this group');
    }

    const installment = await Installment.create({
      ...installmentData,
      group_id,
      member_id,
      scheme_id,
      collected_by: collected_by || req.employee._id
    });

    res.status(201).json({
      success: true,
      data: installment
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get all installments
// @route   GET /api/installments
export const getInstallments = async (req, res) => {
  try {
    const { 
      group_id, 
      member_id, 
      scheme_id,
      status, 
      overdue, 
      startDate, 
      endDate,
      minAmount,
      maxAmount
    } = req.query;
    
    const filter = {};

    if (group_id) filter.group_id = group_id;
    if (member_id) filter.member_id = member_id;
    if (scheme_id) filter.scheme_id = scheme_id;
    if (status) filter.status = status;

    // Overdue filter
    if (overdue === 'true') {
      filter.due_date = { $lt: new Date() };
      filter.status = { $in: ['Pending', 'Partial', 'Late'] };
    }

    // Date range filter
    if (startDate || endDate) {
      filter.due_date = {};
      if (startDate) filter.due_date.$gte = new Date(startDate);
      if (endDate) filter.due_date.$lte = new Date(endDate);
    }

    // Amount range filter
    if (minAmount || maxAmount) {
      filter.amount = {};
      if (minAmount) filter.amount.$gte = parseFloat(minAmount);
      if (maxAmount) filter.amount.$lte = parseFloat(maxAmount);
    }

    const installments = await Installment.find(filter)
      .populate('group_id', 'group_id')
      .populate('member_id', 'member_id mem_name phone')
      .populate('scheme_id', 'scheme_id scheme_name')
      .populate('collected_by', 'emp_id emp_name')
      .sort({ due_date: 1 });

    res.json({
      success: true,
      count: installments.length,
      data: installments
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get installment by ID
// @route   GET /api/installments/:id
export const getInstallmentById = async (req, res) => {
  try {
    const installment = await Installment.findOne({
      $or: [
        { _id: req.params.id },
        { installment_id: req.params.id }
      ]
    })
    .populate('group_id', 'group_id')
    .populate('member_id', 'member_id mem_name phone')
    .populate('scheme_id', 'scheme_id scheme_name')
    .populate('collected_by', 'emp_id emp_name');

    if (!installment) {
      return res.status(404).json({
        success: false,
        message: "Installment not found"
      });
    }

    res.json({
      success: true,
      data: installment
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Record installment payment
// @route   POST /api/installments/:id/pay
export const recordPayment = async (req, res) => {
  try {
    const { paid_amount, payment_mode, collected_by, receipt_remarks } = req.body;

    const installment = await Installment.findOne({
      $or: [
        { _id: req.params.id },
        { installment_id: req.params.id }
      ]
    });

    if (!installment) {
      return res.status(404).json({
        success: false,
        message: "Installment not found"
      });
    }

    if (installment.status === 'Paid' && installment.pending_amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Installment already fully paid"
      });
    }

    // Calculate late fee if payment is late
    let lateFee = 0;
    if (new Date() > installment.due_date) {
      const daysLate = Math.ceil((new Date() - installment.due_date) / (1000 * 60 * 60 * 24));
      // Get scheme to determine late fee rate
      const scheme = await Scheme.findById(installment.scheme_id);
      const lateFeeRate = scheme?.late_fee_rate || 0.02; // Default 2% per day
      lateFee = installment.amount * lateFeeRate * daysLate;
    }

    // Update installment
    installment.paid_amount = (installment.paid_amount || 0) + paid_amount;
    installment.paid_date = new Date();
    installment.late_fee = lateFee;
    installment.status = installment.pending_amount <= paid_amount ? 'Paid' : 
                         (installment.paid_amount > 0 ? 'Partial' : 'Pending');
    installment.payment_mode = payment_mode;
    installment.collected_by = collected_by || req.employee._id;

    await installment.save();

    // Create receipt
    const receipt = await Receipt.create({
      branch_id: (await Member.findById(installment.member_id)).branch_id,
      member_id: installment.member_id,
      group_id: installment.group_id,
      receipt_amount: paid_amount,
      payment_mode,
      received_by: collected_by || req.employee._id,
      remarks: receipt_remarks || `Payment for ${installment.installment_period} installment`,
      status: 'Completed'
    });

    res.json({
      success: true,
      data: {
        installment,
        receipt
      },
      message: "Payment recorded successfully"
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update installment
// @route   PUT /api/installments/:id
export const updateInstallment = async (req, res) => {
  try {
    // Prevent updating certain fields
    const { 
      installment_id, 
      group_id, 
      member_id, 
      scheme_id,
      paid_amount,
      paid_date,
      status,
      ...updateData 
    } = req.body;

    const installment = await Installment.findOneAndUpdate(
      { 
        $or: [
          { _id: req.params.id },
          { installment_id: req.params.id }
        ]
      },
      updateData,
      { new: true, runValidators: true }
    )
    .populate('group_id', 'group_id')
    .populate('member_id', 'member_id mem_name')
    .populate('scheme_id', 'scheme_id scheme_name');

    if (!installment) {
      return res.status(404).json({
        success: false,
        message: "Installment not found"
      });
    }

    res.json({
      success: true,
      data: installment
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get installment statistics
// @route   GET /api/installments/stats
export const getInstallmentStats = async (req, res) => {
  try {
    const { group_id, member_id, scheme_id } = req.query;
    const match = {};

    if (group_id) match.group_id = new mongoose.Types.ObjectId(group_id);
    if (member_id) match.member_id = new mongoose.Types.ObjectId(member_id);
    if (scheme_id) match.scheme_id = new mongoose.Types.ObjectId(scheme_id);

    const stats = await Installment.aggregate([
      { $match: match },
      { $group: {
        _id: {
          status: "$status",
          scheme: "$scheme_id"
        },
        count: { $sum: 1 },
        totalAmount: { $sum: "$amount" },
        totalPaid: { $sum: "$paid_amount" },
        totalLateFees: { $sum: "$late_fee" }
      }},
      { $lookup: {
        from: "schemes",
        localField: "_id.scheme",
        foreignField: "_id",
        as: "scheme"
      }},
      { $unwind: "$scheme" },
      { $project: {
        status: "$_id.status",
        scheme_id: "$scheme.scheme_id",
        scheme_name: "$scheme.scheme_name",
        count: 1,
        totalAmount: 1,
        totalPaid: 1,
        totalLateFees: 1,
        _id: 0
      }},
      { $sort: { "scheme.scheme_name": 1, status: 1 } }
    ]);

    // Calculate overall totals
    const totals = await Installment.aggregate([
      { $match: match },
      { $group: {
        _id: null,
        totalInstallments: { $sum: 1 },
        totalAmount: { $sum: "$amount" },
        totalPaid: { $sum: "$paid_amount" },
        totalLateFees: { $sum: "$late_fee" },
        paidPercentage: { 
          $avg: { 
            $cond: [
              { $eq: ["$status", "Paid"] }, 
              100, 
              { $multiply: [
                { $divide: ["$paid_amount", "$amount"] },
                100
              ]}
            ]
          } 
        }
      }},
      { $project: {
        _id: 0,
        totalInstallments: 1,
        totalAmount: 1,
        totalPaid: 1,
        totalLateFees: 1,
        paidPercentage: { $round: ["$paidPercentage", 2] }
      }}
    ]);

    res.json({
      success: true,
      data: {
        byStatus: stats,
        overall: totals[0] || {}
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get upcoming installments for member
// @route   GET /api/members/:member_id/installments/upcoming
export const getUpcomingInstallments = async (req, res) => {
  try {
    const member = await Member.findOne({
      $or: [
        { _id: req.params.member_id },
        { member_id: req.params.member_id }
      ]
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member not found"
      });
    }

    const installments = await Installment.find({
      member_id: member._id,
      due_date: { $gte: new Date() },
      status: { $in: ['Pending', 'Partial'] }
    })
    .populate('group_id', 'group_id')
    .populate('scheme_id', 'scheme_id scheme_name')
    .sort({ due_date: 1 });

    res.json({
      success: true,
      data: installments
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};