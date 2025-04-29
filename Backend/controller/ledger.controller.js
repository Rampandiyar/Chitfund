import Ledger from "../models/ledger.js";
import Transaction from "../models/transaction.js";
import Member from "../models/member.js";
import Group from "../models/group.js";
import Branch from "../models/branch.js";
import mongoose from "mongoose";

// @desc    Create a new ledger entry
// @route   POST /api/ledgers
export const createLedgerEntry = async (req, res) => {
  try {
    const { branch_id, member_id, group_id, transaction_id, debit, credit, description, reference } = req.body;

    // Validate required fields
    if (!branch_id || !member_id || !transaction_id) {
      return res.status(400).json({
        success: false,
        message: "Branch ID, Member ID and Transaction ID are required"
      });
    }

    // Validate references exist
    const [branch, member, transaction, group] = await Promise.all([
      Branch.findById(branch_id),
      Member.findById(member_id),
      Transaction.findById(transaction_id),
      group_id ? Group.findById(group_id) : Promise.resolve(null)
    ]);

    if (!branch) throw new Error('Branch not found');
    if (!member) throw new Error('Member not found');
    if (!transaction) throw new Error('Transaction not found');
    if (group_id && !group) throw new Error('Group not found');

    // Get the last balance for this member
    const lastEntry = await Ledger.findOne({ member_id })
      .sort({ createdAt: -1 })
      .limit(1);

    const lastBalance = lastEntry ? lastEntry.balance : 0;
    const newBalance = lastBalance + (credit || 0) - (debit || 0);

    // Create the ledger entry
    const ledgerEntry = await Ledger.create({
      branch_id,
      member_id,
      group_id,
      transaction_id,
      date: new Date(),
      debit,
      credit,
      balance: newBalance,
      description,
      reference
    });

    res.status(201).json({
      success: true,
      data: ledgerEntry
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get all ledger entries with filters
// @route   GET /api/ledgers
export const getLedgerEntries = async (req, res) => {
  try {
    const { 
      branch_id, 
      member_id, 
      group_id,
      transaction_id,
      startDate, 
      endDate,
      minAmount,
      maxAmount
    } = req.query;
    
    const filter = {};

    if (branch_id) filter.branch_id = branch_id;
    if (member_id) filter.member_id = member_id;
    if (group_id) filter.group_id = group_id;
    if (transaction_id) filter.transaction_id = transaction_id;

    // Date range filter
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    // Amount range filter
    if (minAmount || maxAmount) {
      filter.$or = [
        { debit: {} },
        { credit: {} }
      ];
      if (minAmount) {
        filter.$or[0].debit.$gte = parseFloat(minAmount);
        filter.$or[1].credit.$gte = parseFloat(minAmount);
      }
      if (maxAmount) {
        filter.$or[0].debit.$lte = parseFloat(maxAmount);
        filter.$or[1].credit.$lte = parseFloat(maxAmount);
      }
    }

    const ledgerEntries = await Ledger.find(filter)
      .populate('branch_id', 'branch_id bname')
      .populate('member_id', 'member_id mem_name')
      .populate('group_id', 'group_id group_name')
      .populate('transaction_id', 'transaction_id description')
      .sort({ date: -1, createdAt: -1 });

    res.json({
      success: true,
      count: ledgerEntries.length,
      data: ledgerEntries
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get ledger entry by ID
// @route   GET /api/ledgers/:id
export const getLedgerEntryById = async (req, res) => {
  try {
    const ledgerEntry = await Ledger.findOne({
      $or: [
        { _id: req.params.id },
        { ledger_id: req.params.id }
      ]
    })
    .populate('branch_id', 'branch_id bname')
    .populate('member_id', 'member_id mem_name')
    .populate('group_id', 'group_id group_name')
    .populate('transaction_id', 'transaction_id description');

    if (!ledgerEntry) {
      return res.status(404).json({
        success: false,
        message: "Ledger entry not found"
      });
    }

    res.json({
      success: true,
      data: ledgerEntry
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get member's ledger statement
// @route   GET /api/members/:member_id/ledger
export const getMemberLedger = async (req, res) => {
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

    const { startDate, endDate } = req.query;
    const filter = { member_id: member._id };

    // Date range filter
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const ledgerEntries = await Ledger.find(filter)
      .populate('branch_id', 'branch_id bname')
      .populate('group_id', 'group_id group_name')
      .populate('transaction_id', 'transaction_id description')
      .sort({ date: 1, createdAt: 1 });

    // Calculate opening and closing balances
    let openingBalance = 0;
    let closingBalance = 0;

    if (ledgerEntries.length > 0) {
      const firstEntry = await Ledger.findOne({ member_id: member._id })
        .sort({ date: 1, createdAt: 1 })
        .limit(1);

      openingBalance = firstEntry.balance - firstEntry.credit + firstEntry.debit;
      closingBalance = ledgerEntries[ledgerEntries.length - 1].balance;
    }

    res.json({
      success: true,
      data: {
        member: {
          member_id: member.member_id,
          mem_name: member.mem_name
        },
        opening_balance: openingBalance,
        closing_balance: closingBalance,
        transactions: ledgerEntries,
        count: ledgerEntries.length
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update ledger entry
// @route   PUT /api/ledgers/:id
export const updateLedgerEntry = async (req, res) => {
  try {
    // Prevent updating certain fields
    const { 
      ledger_id, 
      branch_id, 
      member_id, 
      transaction_id,
      balance,
      ...updateData 
    } = req.body;

    const ledgerEntry = await Ledger.findOneAndUpdate(
      { 
        $or: [
          { _id: req.params.id },
          { ledger_id: req.params.id }
        ]
      },
      updateData,
      { new: true, runValidators: true }
    )
    .populate('branch_id', 'branch_id bname')
    .populate('member_id', 'member_id mem_name')
    .populate('transaction_id', 'transaction_id description');

    if (!ledgerEntry) {
      return res.status(404).json({
        success: false,
        message: "Ledger entry not found"
      });
    }

    res.json({
      success: true,
      data: ledgerEntry
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get ledger statistics
// @route   GET /api/ledgers/stats
export const getLedgerStats = async (req, res) => {
  try {
    const { branch_id, startDate, endDate } = req.query;
    const match = {};

    if (branch_id) match.branch_id = new mongoose.Types.ObjectId(branch_id);
    
    // Date range filter
    if (startDate || endDate) {
      match.date = {};
      if (startDate) match.date.$gte = new Date(startDate);
      if (endDate) match.date.$lte = new Date(endDate);
    }

    const stats = await Ledger.aggregate([
      { $match: match },
      { 
        $group: {
          _id: null,
          totalDebit: { $sum: "$debit" },
          totalCredit: { $sum: "$credit" },
          count: { $sum: 1 },
          members: { $addToSet: "$member_id" }
        }
      },
      {
        $project: {
          _id: 0,
          totalDebit: 1,
          totalCredit: 1,
          count: 1,
          memberCount: { $size: "$members" }
        }
      }
    ]);

    res.json({
      success: true,
      data: stats[0] || {
        totalDebit: 0,
        totalCredit: 0,
        count: 0,
        memberCount: 0
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};