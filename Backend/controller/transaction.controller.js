import Transaction from "../models/transaction.js";
import Member from "../models/member.js";
import Group from "../models/group.js";
import Branch from "../models/branch.js";
import Employee from "../models/employee.js";

// Helper to validate references
const validateReferences = async (branchId, memberId, groupId, employeeId) => {
  const [branch, member, group, employee] = await Promise.all([
    branchId ? Branch.findById(branchId) : Promise.resolve(null),
    memberId ? Member.findById(memberId) : Promise.resolve(null),
    groupId ? Group.findById(groupId) : Promise.resolve(null),
    employeeId ? Employee.findById(employeeId) : Promise.resolve(null)
  ]);

  if (branchId && !branch) throw new Error('Branch not found');
  if (memberId && !member) throw new Error('Member not found');
  if (groupId && !group) throw new Error('Group not found');
  if (employeeId && !employee) throw new Error('Employee not found');
};

// @desc    Create a transaction
// @route   POST /api/transactions
export const createTransaction = async (req, res) => {
  try {
    const { branch_id, member_id, group_id, recorded_by, ...transactionData } = req.body;

    // Validate references
    await validateReferences(
      branch_id,
      member_id,
      group_id,
      recorded_by || req.employee._id
    );

    // Additional validation based on transaction type
    if (transactionData.transaction_type === 'Installment' && !group_id) {
      throw new Error('Group ID is required for installment transactions');
    }

    if (['Deposit', 'Withdrawal'].includes(transactionData.transaction_type) && !member_id) {
      throw new Error('Member ID is required for deposit/withdrawal transactions');
    }

    const transaction = await Transaction.create({
      ...transactionData,
      branch_id,
      member_id,
      group_id,
      recorded_by: recorded_by || req.employee._id
    });

    res.status(201).json({
      success: true,
      data: transaction
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get all transactions
// @route   GET /api/transactions
export const getTransactions = async (req, res) => {
  try {
    const { 
      branch_id, 
      member_id, 
      group_id, 
      type, 
      status, 
      mode, 
      startDate, 
      endDate,
      minAmount,
      maxAmount
    } = req.query;

    const filter = {};

    if (branch_id) filter.branch_id = branch_id;
    if (member_id) filter.member_id = member_id;
    if (group_id) filter.group_id = group_id;
    if (type) filter.transaction_type = type;
    if (status) filter.status = status;
    if (mode) filter.payment_mode = mode;

    // Date range filter
    if (startDate || endDate) {
      filter.transaction_date = {};
      if (startDate) filter.transaction_date.$gte = new Date(startDate);
      if (endDate) filter.transaction_date.$lte = new Date(endDate);
    }

    // Amount range filter
    if (minAmount || maxAmount) {
      filter.amount = {};
      if (minAmount) filter.amount.$gte = parseFloat(minAmount);
      if (maxAmount) filter.amount.$lte = parseFloat(maxAmount);
    }

    const transactions = await Transaction.find(filter)
      .populate('branch_id', 'branch_id bname')
      .populate('member_id', 'member_id mem_name')
      .populate('group_id', 'group_id')
      .populate('recorded_by', 'emp_id emp_name')
      .sort({ transaction_date: -1 });

    res.json({
      success: true,
      count: transactions.length,
      data: transactions
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get transaction by ID
// @route   GET /api/transactions/:id
export const getTransactionById = async (req, res) => {
  try {
    const transaction = await Transaction.findOne({
      $or: [
        { _id: req.params.id },
        { transaction_id: req.params.id }
      ]
    })
    .populate('branch_id', 'branch_id bname')
    .populate('member_id', 'member_id mem_name phone')
    .populate('group_id', 'group_id')
    .populate('recorded_by', 'emp_id emp_name')
    .populate('related_transaction', 'transaction_id amount transaction_type');

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found"
      });
    }

    res.json({
      success: true,
      data: transaction
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update transaction
// @route   PUT /api/transactions/:id
export const updateTransaction = async (req, res) => {
  try {
    // Prevent updating certain fields
    const { transaction_id, branch_id, member_id, group_id, recorded_by, ...updateData } = req.body;

    // Additional validation for status changes
    if (updateData.status === 'Reversed' && !updateData.related_transaction) {
      throw new Error('Related transaction required when reversing');
    }

    const transaction = await Transaction.findOneAndUpdate(
      { 
        $or: [
          { _id: req.params.id },
          { transaction_id: req.params.id }
        ]
      },
      updateData,
      { new: true, runValidators: true }
    )
    .populate('branch_id', 'branch_id bname')
    .populate('member_id', 'member_id mem_name')
    .populate('recorded_by', 'emp_id emp_name');

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found"
      });
    }

    res.json({
      success: true,
      data: transaction
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Reverse a transaction
// @route   POST /api/transactions/:id/reverse
export const reverseTransaction = async (req, res) => {
  try {
    const original = await Transaction.findOne({
      $or: [
        { _id: req.params.id },
        { transaction_id: req.params.id }
      ]
    });

    if (!original) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found"
      });
    }

    if (original.status === 'Reversed') {
      return res.status(400).json({
        success: false,
        message: "Transaction already reversed"
      });
    }

    // Create reversal transaction
    const reversal = await Transaction.create({
      ...original.toObject(),
      _id: undefined,
      transaction_id: undefined,
      amount: -original.amount,
      status: 'Completed',
      description: `Reversal of ${original.transaction_id}`,
      related_transaction: original._id
    });

    // Update original transaction
    original.status = 'Reversed';
    original.related_transaction = reversal._id;
    await original.save();

    res.status(201).json({
      success: true,
      data: {
        original: original,
        reversal: reversal
      },
      message: "Transaction reversed successfully"
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get transaction summary
// @route   GET /api/transactions/summary
export const getTransactionSummary = async (req, res) => {
  try {
    const { branch_id, member_id, group_id, type, startDate, endDate } = req.query;

    const match = {};
    if (branch_id) match.branch_id = new mongoose.Types.ObjectId(branch_id);
    if (member_id) match.member_id = new mongoose.Types.ObjectId(member_id);
    if (group_id) match.group_id = new mongoose.Types.ObjectId(group_id);
    if (type) match.transaction_type = type;

    // Date range filter
    if (startDate || endDate) {
      match.transaction_date = {};
      if (startDate) match.transaction_date.$gte = new Date(startDate);
      if (endDate) match.transaction_date.$lte = new Date(endDate);
    }

    const summary = await Transaction.aggregate([
      { $match: match },
      { $group: {
        _id: '$transaction_type',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        avgAmount: { $avg: '$amount' }
      }},
      { $project: {
        transactionType: '$_id',
        count: 1,
        totalAmount: { $round: ['$totalAmount', 2] },
        avgAmount: { $round: ['$avgAmount', 2] },
        _id: 0
      }},
      { $sort: { totalAmount: -1 } }
    ]);

    // Calculate overall totals
    const totals = await Transaction.aggregate([
      { $match: match },
      { $group: {
        _id: null,
        totalTransactions: { $sum: 1 },
        netAmount: { $sum: '$amount' }
      }}
    ]);

    res.json({
      success: true,
      data: {
        byType: summary,
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

// @desc    Get member transaction summary
// @route   GET /api/members/:id/transactions/summary
export const getMemberTransactionSummary = async (req, res) => {
  try {
    const member = await Member.findOne({
      $or: [
        { _id: req.params.id },
        { member_id: req.params.id }
      ]
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member not found"
      });
    }

    const summary = await Transaction.getSummary(member._id);

    res.json({
      success: true,
      data: {
        member_id: member.member_id,
        mem_name: member.mem_name,
        transactions: summary
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};