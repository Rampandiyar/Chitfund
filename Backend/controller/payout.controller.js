import Payout from "../models/payout.js";
import Group from "../models/group.js";
import Member from "../models/member.js";
import Transaction from "../models/transaction.js";
import mongoose from "mongoose";

// Helper function to validate references
const validateReferences = async (group_id, member_id) => {
  const [group, member] = await Promise.all([
    Group.findById(group_id),
    Member.findById(member_id)
  ]);

  if (!group) throw new Error('Group not found');
  if (!member) throw new Error('Member not found');
  
  return { group, member };
};

// @desc    Create a new payout
// @route   POST /api/payouts
export const createPayout = async (req, res) => {
  try {
    const { group_id, member_id, ...payoutData } = req.body;

    // Validate references
    await validateReferences(group_id, member_id);

    // Verify member belongs to group
    const group = await Group.findById(group_id);
    if (!group.members.some(m => m.member_id.equals(member_id))) {
      throw new Error('Member does not belong to this group');
    }

    // Create the payout
    const payout = await Payout.create({
      ...payoutData,
      group_id,
      member_id,
      status: 'Pending' // Default status
    });

    res.status(201).json({
      success: true,
      data: payout
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get all payouts with filters
// @route   GET /api/payouts
export const getPayouts = async (req, res) => {
  try {
    const { 
      group_id, 
      member_id,
      month_number,
      status,
      startDate,
      endDate,
      minAmount,
      maxAmount
    } = req.query;
    
    const filter = {};

    if (group_id) filter.group_id = group_id;
    if (member_id) filter.member_id = member_id;
    if (month_number) filter.month_number = month_number;
    if (status) filter.status = status;

    // Date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    // Amount range filter
    if (minAmount || maxAmount) {
      filter.payout_amount = {};
      if (minAmount) filter.payout_amount.$gte = parseFloat(minAmount);
      if (maxAmount) filter.payout_amount.$lte = parseFloat(maxAmount);
    }

    const payouts = await Payout.find(filter)
      .populate('group_id', 'group_id group_name')
      .populate('member_id', 'member_id mem_name')
      .populate('transaction_id', 'transaction_id amount')
      .sort({ month_number: -1, createdAt: -1 });

    res.json({
      success: true,
      count: payouts.length,
      data: payouts
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get payout by ID
// @route   GET /api/payouts/:id
export const getPayoutById = async (req, res) => {
  try {
    const payout = await Payout.findOne({
      $or: [
        { _id: req.params.id },
        { payout_id: req.params.id }
      ]
    })
    .populate('group_id', 'group_id group_name')
    .populate('member_id', 'member_id mem_name')
    .populate('transaction_id', 'transaction_id amount date');

    if (!payout) {
      return res.status(404).json({
        success: false,
        message: "Payout not found"
      });
    }

    res.json({
      success: true,
      data: payout
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Process payout payment
// @route   POST /api/payouts/:id/process
export const processPayout = async (req, res) => {
  try {
    const { transaction_id } = req.body;

    // Validate transaction exists
    const transaction = await Transaction.findById(transaction_id);
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    const payout = await Payout.findOneAndUpdate(
      { 
        $or: [
          { _id: req.params.id },
          { payout_id: req.params.id }
        ],
        status: 'Pending' // Only process pending payouts
      },
      { 
        status: 'Paid',
        payment_date: new Date(),
        transaction_id
      },
      { new: true }
    )
    .populate('group_id', 'group_id group_name')
    .populate('member_id', 'member_id mem_name')
    .populate('transaction_id', 'transaction_id amount date');

    if (!payout) {
      return res.status(404).json({
        success: false,
        message: "Pending payout not found"
      });
    }

    res.json({
      success: true,
      data: payout,
      message: "Payout processed successfully"
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Skip payout
// @route   POST /api/payouts/:id/skip
export const skipPayout = async (req, res) => {
  try {
    const payout = await Payout.findOneAndUpdate(
      { 
        $or: [
          { _id: req.params.id },
          { payout_id: req.params.id }
        ],
        status: 'Pending' // Only skip pending payouts
      },
      { 
        status: 'Skipped',
        payment_date: new Date()
      },
      { new: true }
    );

    if (!payout) {
      return res.status(404).json({
        success: false,
        message: "Pending payout not found"
      });
    }

    res.json({
      success: true,
      data: payout,
      message: "Payout skipped successfully"
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get payout statistics
// @route   GET /api/payouts/stats
export const getPayoutStats = async (req, res) => {
  try {
    const { group_id, startDate, endDate } = req.query;
    const match = {};

    if (group_id) match.group_id = new mongoose.Types.ObjectId(group_id);
    
    // Date range filter
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) match.createdAt.$lte = new Date(endDate);
    }

    const stats = await Payout.aggregate([
      { $match: match },
      { 
        $group: {
          _id: {
            status: "$status",
            month: "$month_number"
          },
          count: { $sum: 1 },
          totalAmount: { $sum: "$payout_amount" },
          totalFees: { $sum: "$processing_fee" }
        }
      },
      {
        $group: {
          _id: "$_id.status",
          totalPayouts: { $sum: "$count" },
          totalAmount: { $sum: "$totalAmount" },
          totalFees: { $sum: "$totalFees" },
          months: {
            $push: {
              month: "$_id.month",
              count: "$count",
              amount: "$totalAmount"
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          status: "$_id",
          totalPayouts: 1,
          totalAmount: 1,
          totalFees: 1,
          months: 1
        }
      },
      { $sort: { status: 1 } }
    ]);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get member payouts
// @route   GET /api/members/:member_id/payouts
export const getMemberPayouts = async (req, res) => {
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

    const payouts = await Payout.find({ member_id: member._id })
      .populate('group_id', 'group_id group_name')
      .populate('transaction_id', 'transaction_id amount date')
      .sort({ month_number: -1 });

    res.json({
      success: true,
      data: payouts
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};