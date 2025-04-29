import Notification from "../models/notification.js";
import Employee from "../models/employee.js";
import Member from "../models/member.js";
import mongoose from "mongoose";

// Helper function to validate recipient
const validateRecipient = async (recipient_type, recipient_id) => {
  if (recipient_type === 'Employee') {
    const employee = await Employee.findById(recipient_id);
    if (!employee) throw new Error('Employee recipient not found');
  } else if (recipient_type === 'Member') {
    const member = await Member.findById(recipient_id);
    if (!member) throw new Error('Member recipient not found');
  }
};

// @desc    Create a new notification
// @route   POST /api/notifications
export const createNotification = async (req, res) => {
  try {
    const { recipient_type, recipient_id, ...notificationData } = req.body;

    // Validate recipient
    await validateRecipient(recipient_type, recipient_id);

    // Create the notification
    const notification = await Notification.create({
      ...notificationData,
      recipient_type,
      recipient_id,
      created_by: req.employee._id
    });

    res.status(201).json({
      success: true,
      data: notification
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get all notifications with filters
// @route   GET /api/notifications
export const getNotifications = async (req, res) => {
  try {
    const { 
      recipient_type,
      recipient_id,
      notification_type,
      is_read,
      startDate,
      endDate
    } = req.query;
    
    const filter = {};

    if (recipient_type) filter.recipient_type = recipient_type;
    if (recipient_id) filter.recipient_id = recipient_id;
    if (notification_type) filter.notification_type = notification_type;
    if (is_read) filter.is_read = is_read === 'true';

    // Date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const notifications = await Notification.find(filter)
      .populate('recipient_id', 'member_id mem_name emp_id emp_name')
      .populate('created_by', 'emp_id emp_name')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: notifications.length,
      data: notifications
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get notification by ID
// @route   GET /api/notifications/:id
export const getNotificationById = async (req, res) => {
  try {
    const notification = await Notification.findOne({
      $or: [
        { _id: req.params.id },
        { notification_id: req.params.id }
      ]
    })
    .populate('recipient_id', 'member_id mem_name emp_id emp_name')
    .populate('created_by', 'emp_id emp_name');

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found"
      });
    }

    res.json({
      success: true,
      data: notification
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Mark notification as read
// @route   PATCH /api/notifications/:id/read
export const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { 
        $or: [
          { _id: req.params.id },
          { notification_id: req.params.id }
        ]
      },
      { 
        is_read: true,
        read_at: new Date()
      },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found"
      });
    }

    res.json({
      success: true,
      data: notification,
      message: "Notification marked as read"
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get unread notifications count
// @route   GET /api/notifications/unread/count
export const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({ 
      recipient_type: req.query.recipient_type || 'Employee',
      recipient_id: req.query.recipient_id || req.employee._id,
      is_read: false
    });

    res.json({
      success: true,
      data: { count }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get notifications for current user
// @route   GET /api/notifications/my
export const getMyNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({
      recipient_type: 'Employee',
      recipient_id: req.employee._id
    })
    .sort({ createdAt: -1 })
    .limit(10);

    res.json({
      success: true,
      data: notifications
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get notification statistics
// @route   GET /api/notifications/stats
export const getNotificationStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const match = {};

    // Date range filter
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) match.createdAt.$lte = new Date(endDate);
    }

    const stats = await Notification.aggregate([
      { $match: match },
      { 
        $group: {
          _id: {
            notification_type: "$notification_type",
            is_read: "$is_read"
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: "$_id.notification_type",
          total: { $sum: "$count" },
          read: { 
            $sum: {
              $cond: [{ $eq: ["$_id.is_read", true] }, "$count", 0]
            }
          },
          unread: { 
            $sum: {
              $cond: [{ $eq: ["$_id.is_read", false] }, "$count", 0]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          notification_type: "$_id",
          total: 1,
          read: 1,
          unread: 1,
          read_percentage: {
            $round: [
              { $multiply: [
                { $divide: ["$read", "$total"] },
                100
              ]},
              2
            ]
          }
        }
      },
      { $sort: { notification_type: 1 } }
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