import mongoose from 'mongoose';

const BookingSchema = new mongoose.Schema({
    booking_id: {
        type: String,
        unique: true
    },
    member_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Member',
        required: true
    },
    group_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
        required: true
    },
    preferred_month: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['Pending', 'Confirmed', 'Rejected'],
        default: 'Pending'
    },
    confirmed_month: {
        type: Number
    },
    booking_fee: {
        type: Number,
        default: 0
    },
    booked_at: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// Auto-increment booking_id similar to Employee model
BookingSchema.pre('save', async function (next) {
    if (!this.isNew || this.booking_id) return next();
    
    try {
        const lastBooking = await this.constructor.findOne({}, {}, { sort: { 'booking_id': -1 } });
        let newId = 'BKG001'; // Default starting ID
        
        if (lastBooking && lastBooking.booking_id) {
            // Extract the numeric part and increment
            const lastIdNumber = parseInt(lastBooking.booking_id.replace('BKG', ''), 10);
            newId = `BKG${String(lastIdNumber + 1).padStart(3, '0')}`;
        }
        
        this.booking_id = newId;
        next();
    } catch (error) {
        next(error);
    }
});

export default mongoose.model('Booking', BookingSchema);