import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema({
    notification_id: {
        type: String,
        unique: true
    },
    recipient_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: 'recipient_type'
    },
    recipient_type: {
        type: String,
        required: true,
        enum: ['Employee', 'Member']
    },
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    message: {
        type: String,
        required: true,
        trim: true,
        maxlength: 500
    },
    notification_type: {
        type: String,
        required: true,
        enum: ['Payment', 'Auction', 'Installment', 'Group', 'System', 'Alert', 'Reminder', 'Other'],
        default: 'System'
    },
    related_entity: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'related_entity_type'
    },
    related_entity_type: {
        type: String,
        enum: ['Booking', 'Group', 'Installment', 'Payout', 'Transaction', null]
    },
    is_read: {
        type: Boolean,
        default: false
    },
    read_at: {
        type: Date
    },
    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Critical'],
        default: 'Medium'
    },
    created_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    },
    expiry_date: {
        type: Date,
        default: function() {
            // Default expiry 30 days from creation
            const date = new Date();
            date.setDate(date.getDate() + 30);
            return date;
        }
    }
}, { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Pre-save hook to generate notification_id
NotificationSchema.pre('save', async function (next) {
    if (!this.isNew || this.notification_id) return next();
    
    try {
        const lastNotification = await this.constructor.findOne({}, {}, { sort: { 'notification_id': -1 } });
        let newId = 'NOT001';
        
        if (lastNotification && lastNotification.notification_id) {
            const lastIdNumber = parseInt(lastNotification.notification_id.replace('NOT', ''), 10);
            newId = `NOT${String(lastIdNumber + 1).padStart(3, '0')}`;
        }
        
        this.notification_id = newId;
        next();
    } catch (error) {
        next(error);
    }
});

// Virtual for formatted created_at date
NotificationSchema.virtual('formatted_date').get(function() {
    return this.createdAt.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
});

// Indexes for better query performance
NotificationSchema.index({ recipient_id: 1, recipient_type: 1 });
NotificationSchema.index({ is_read: 1 });
NotificationSchema.index({ notification_type: 1 });
NotificationSchema.index({ createdAt: -1 });

// Static method to get unread count for a recipient
NotificationSchema.statics.getUnreadCount = async function(recipientId, recipientType) {
    return this.countDocuments({
        recipient_id: recipientId,
        recipient_type: recipientType,
        is_read: false,
        expiry_date: { $gt: new Date() }
    });
};

export default mongoose.model('Notification', NotificationSchema);