import Receipt from "../models/receipt.js";
import Branch from "../models/branch.js";
import Member from "../models/member.js";
import Group from "../models/group.js";
import Employee from "../models/employee.js";
import Transaction from "../models/transaction.js";

// Helper function to validate references
const validateReferences = async (branchId, memberId, groupId, receivedById, transactionId) => {
  const [branch, member, group, employee, transaction] = await Promise.all([
    Branch.findById(branchId),
    Member.findById(memberId),
    groupId ? Group.findById(groupId) : Promise.resolve(null),
    Employee.findById(receivedById),
    transactionId ? Transaction.findById(transactionId) : Promise.resolve(null)
  ]);

  if (!branch) throw new Error('Branch not found');
  if (!member) throw new Error('Member not found');
  if (groupId && !group) throw new Error('Group not found');
  if (!employee) throw new Error('Receiving employee not found');
  if (transactionId && !transaction) throw new Error('Transaction not found');
};

// @desc    Create a new receipt
// @route   POST /api/receipts
export const createReceipt = async (req, res) => {
  try {
    const { branch_id, member_id, group_id, transaction_id, received_by, ...receiptData } = req.body;

    // Validate references
    await validateReferences(
      branch_id,
      member_id,
      group_id,
      received_by || req.employee._id,
      transaction_id
    );

    // Validate cheque details if payment mode is Cheque
    if (receiptData.payment_mode === 'Cheque' && !receiptData.cheque_details?.cheque_no) {
      throw new Error('Cheque details are required for cheque payments');
    }

    // Validate online/bank transfer references
    if (['Online', 'Bank Transfer'].includes(receiptData.payment_mode) && !receiptData.transaction_id) {
      throw new Error('Transaction reference is required for online/bank transfer payments');
    }

    const receipt = await Receipt.create({
      ...receiptData,
      branch_id,
      member_id,
      group_id,
      transaction_id,
      received_by: received_by || req.employee._id
    });

    res.status(201).json({
      success: true,
      data: receipt
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get all receipts
// @route   GET /api/receipts
export const getReceipts = async (req, res) => {
  try {
    const { branch_id, member_id, group_id, status, startDate, endDate, payment_mode } = req.query;
    const filter = {};

    if (branch_id) filter.branch_id = branch_id;
    if (member_id) filter.member_id = member_id;
    if (group_id) filter.group_id = group_id;
    if (status) filter.status = status;
    if (payment_mode) filter.payment_mode = payment_mode;

    // Date range filter
    if (startDate || endDate) {
      filter.receipt_date = {};
      if (startDate) filter.receipt_date.$gte = new Date(startDate);
      if (endDate) filter.receipt_date.$lte = new Date(endDate);
    }

    const receipts = await Receipt.find(filter)
      .populate('branch_id', 'branch_id bname')
      .populate('member_id', 'member_id mem_name')
      .populate('group_id', 'group_id')
      .populate('transaction_id', 'transaction_id amount')
      .populate('received_by', 'emp_id emp_name')
      .sort({ receipt_date: -1 });

    res.json({
      success: true,
      count: receipts.length,
      data: receipts
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get receipt by ID
// @route   GET /api/receipts/:id
export const getReceiptById = async (req, res) => {
  try {
    const receipt = await Receipt.findOne({
      $or: [
        { _id: req.params.id },
        { receipt_id: req.params.id },
        { receipt_no: req.params.id }
      ]
    })
    .populate('branch_id', 'branch_id bname address')
    .populate('member_id', 'member_id mem_name phone')
    .populate('group_id', 'group_id')
    .populate('transaction_id', 'transaction_id amount transaction_type')
    .populate('received_by', 'emp_id emp_name');

    if (!receipt) {
      return res.status(404).json({
        success: false,
        message: "Receipt not found"
      });
    }

    res.json({
      success: true,
      data: receipt
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update receipt
// @route   PUT /api/receipts/:id
export const updateReceipt = async (req, res) => {
  try {
    // Prevent updating certain fields
    const { receipt_id, receipt_no, branch_id, member_id, ...updateData } = req.body;

    // Validate cheque details if payment mode is being updated to Cheque
    if (updateData.payment_mode === 'Cheque' && !updateData.cheque_details?.cheque_no) {
      throw new Error('Cheque details are required for cheque payments');
    }

    const receipt = await Receipt.findOneAndUpdate(
      { 
        $or: [
          { _id: req.params.id },
          { receipt_id: req.params.id }
        ]
      },
      updateData,
      { new: true, runValidators: true }
    )
    .populate('branch_id', 'branch_id bname')
    .populate('member_id', 'member_id mem_name')
    .populate('received_by', 'emp_id emp_name');

    if (!receipt) {
      return res.status(404).json({
        success: false,
        message: "Receipt not found"
      });
    }

    res.json({
      success: true,
      data: receipt
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Cancel receipt
// @route   PATCH /api/receipts/:id/cancel
export const cancelReceipt = async (req, res) => {
  try {
    const receipt = await Receipt.findOneAndUpdate(
      { 
        $or: [
          { _id: req.params.id },
          { receipt_id: req.params.id }
        ],
        status: { $ne: 'Cancelled' }
      },
      { status: 'Cancelled', remarks: req.body.remarks || 'Receipt cancelled' },
      { new: true }
    );

    if (!receipt) {
      return res.status(404).json({
        success: false,
        message: "Receipt not found or already cancelled"
      });
    }

    res.json({
      success: true,
      data: {
        receipt_id: receipt.receipt_id,
        receipt_no: receipt.receipt_no,
        status: receipt.status
      },
      message: "Receipt cancelled successfully"
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get receipt statistics
// @route   GET /api/receipts/stats
export const getReceiptStats = async (req, res) => {
  try {
    const { branch_id, startDate, endDate } = req.query;
    const match = {};

    if (branch_id) match.branch_id = new mongoose.Types.ObjectId(branch_id);
    
    // Date range filter
    if (startDate || endDate) {
      match.receipt_date = {};
      if (startDate) match.receipt_date.$gte = new Date(startDate);
      if (endDate) match.receipt_date.$lte = new Date(endDate);
    }

    const stats = await Receipt.aggregate([
      { $match: match },
      { $group: {
        _id: {
          year: { $year: "$receipt_date" },
          month: { $month: "$receipt_date" },
          payment_mode: "$payment_mode"
        },
        count: { $sum: 1 },
        totalAmount: { $sum: "$receipt_amount" }
      }},
      { $sort: { "_id.year": -1, "_id.month": -1 } },
      { $project: {
        year: "$_id.year",
        month: "$_id.month",
        payment_mode: "$_id.payment_mode",
        count: 1,
        totalAmount: 1,
        _id: 0
      }}
    ]);

    // Calculate overall totals
    const totals = await Receipt.aggregate([
      { $match: match },
      { $group: {
        _id: null,
        totalReceipts: { $sum: 1 },
        totalAmount: { $sum: "$receipt_amount" },
        averageAmount: { $avg: "$receipt_amount" }
      }},
      { $project: {
        _id: 0,
        totalReceipts: 1,
        totalAmount: 1,
        averageAmount: { $round: ["$averageAmount", 2] }
      }}
    ]);

    res.json({
      success: true,
      data: {
        monthlyStats: stats,
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