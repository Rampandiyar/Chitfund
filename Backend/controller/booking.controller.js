import Booking from "../models/booking.js";
import Member from "../models/member.js";
import Group from "../models/group.js";
import mongoose from "mongoose";

// Helper function to validate references
const validateReferences = async (member_id, group_id) => {
  const [member, group] = await Promise.all([
    Member.findById(member_id),
    Group.findById(group_id)
  ]);

  if (!member) throw new Error('Member not found');
  if (!group) throw new Error('Group not found');
  
  return { member, group };
};

// @desc    Create a new booking
// @route   POST /api/bookings
export const createBooking = async (req, res) => {
  try {
    const { member_id, group_id, preferred_month, ...bookingData } = req.body;

    // Validate references
    const { group } = await validateReferences(member_id, group_id);

    // Verify member belongs to group
    if (!group.members.some(m => m.member_id.equals(member_id))) {
      throw new Error('Member does not belong to this group');
    }

    // Validate preferred month (1-12)
    if (preferred_month < 1 || preferred_month > 12) {
      throw new Error('Preferred month must be between 1 and 12');
    }

    // Create the booking
    const booking = await Booking.create({
      ...bookingData,
      member_id,
      group_id,
      preferred_month,
      status: 'Pending' // Default status
    });

    res.status(201).json({
      success: true,
      data: booking
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get all bookings with filters
// @route   GET /api/bookings
export const getBookings = async (req, res) => {
  try {
    const { 
      member_id, 
      group_id,
      status,
      preferred_month,
      confirmed_month,
      startDate,
      endDate
    } = req.query;
    
    const filter = {};

    if (member_id) filter.member_id = member_id;
    if (group_id) filter.group_id = group_id;
    if (status) filter.status = status;
    if (preferred_month) filter.preferred_month = preferred_month;
    if (confirmed_month) filter.confirmed_month = confirmed_month;

    // Date range filter
    if (startDate || endDate) {
      filter.booked_at = {};
      if (startDate) filter.booked_at.$gte = new Date(startDate);
      if (endDate) filter.booked_at.$lte = new Date(endDate);
    }

    const bookings = await Booking.find(filter)
      .populate('member_id', 'member_id mem_name')
      .populate('group_id', 'group_id group_name')
      .sort({ booked_at: -1 });

    res.json({
      success: true,
      count: bookings.length,
      data: bookings
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get booking by ID
// @route   GET /api/bookings/:id
export const getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findOne({
      $or: [
        { _id: req.params.id },
        { booking_id: req.params.id }
      ]
    })
    .populate('member_id', 'member_id mem_name')
    .populate('group_id', 'group_id group_name');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    res.json({
      success: true,
      data: booking
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Confirm booking
// @route   POST /api/bookings/:id/confirm
export const confirmBooking = async (req, res) => {
  try {
    const { confirmed_month } = req.body;

    // Validate confirmed month (1-12)
    if (confirmed_month < 1 || confirmed_month > 12) {
      throw new Error('Confirmed month must be between 1 and 12');
    }

    const booking = await Booking.findOneAndUpdate(
      { 
        $or: [
          { _id: req.params.id },
          { booking_id: req.params.id }
        ],
        status: 'Pending' // Only confirm pending bookings
      },
      { 
        status: 'Confirmed',
        confirmed_month
      },
      { new: true }
    )
    .populate('member_id', 'member_id mem_name')
    .populate('group_id', 'group_id group_name');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Pending booking not found"
      });
    }

    res.json({
      success: true,
      data: booking,
      message: "Booking confirmed successfully"
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Reject booking
// @route   POST /api/bookings/:id/reject
export const rejectBooking = async (req, res) => {
  try {
    const booking = await Booking.findOneAndUpdate(
      { 
        $or: [
          { _id: req.params.id },
          { booking_id: req.params.id }
        ],
        status: 'Pending' // Only reject pending bookings
      },
      { 
        status: 'Rejected'
      },
      { new: true }
    )
    .populate('member_id', 'member_id mem_name')
    .populate('group_id', 'group_id group_name');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Pending booking not found"
      });
    }

    res.json({
      success: true,
      data: booking,
      message: "Booking rejected successfully"
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get booking statistics
// @route   GET /api/bookings/stats
export const getBookingStats = async (req, res) => {
  try {
    const { group_id, startDate, endDate } = req.query;
    const match = {};

    if (group_id) match.group_id = new mongoose.Types.ObjectId(group_id);
    
    // Date range filter
    if (startDate || endDate) {
      match.booked_at = {};
      if (startDate) match.booked_at.$gte = new Date(startDate);
      if (endDate) match.booked_at.$lte = new Date(endDate);
    }

    const stats = await Booking.aggregate([
      { $match: match },
      { 
        $group: {
          _id: {
            status: "$status",
            preferred_month: "$preferred_month"
          },
          count: { $sum: 1 },
          confirmed_months: {
            $push: {
              $cond: [
                { $eq: ["$status", "Confirmed"] },
                "$confirmed_month",
                null
              ]
            }
          }
        }
      },
      {
        $group: {
          _id: "$_id.status",
          total: { $sum: "$count" },
          preferred_months: {
            $push: {
              month: "$_id.preferred_month",
              count: "$count"
            }
          },
          confirmed_months: { $push: "$confirmed_months" }
        }
      },
      {
        $project: {
          _id: 0,
          status: "$_id",
          total: 1,
          preferred_months: 1,
          confirmed_months: {
            $reduce: {
              input: "$confirmed_months",
              initialValue: [],
              in: { $concatArrays: ["$$value", "$$this"] }
          }
        }
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

// @desc    Get member bookings
// @route   GET /api/members/:member_id/bookings
export const getMemberBookings = async (req, res) => {
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

    const bookings = await Booking.find({ member_id: member._id })
      .populate('group_id', 'group_id group_name')
      .sort({ booked_at: -1 });

    res.json({
      success: true,
      data: bookings
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};