import mongoose from 'mongoose';

const PayoutSchema = new mongoose.Schema({
    payout_id: {
        type: String,
        unique: true
    },
    group_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
        required: true
    },
    month_number: {
        type: Number,
        required: true
    },
    member_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Member',
        required: true
    },
    payout_amount: {
        type: Number,
        required: true
    },
    processing_fee: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['Pending', 'Paid', 'Skipped'],
        default: 'Pending'
    },
    payment_date: {
        type: Date
    },
    transaction_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction'
    }
}, { timestamps: true });

// Auto-increment payout_id
PayoutSchema.pre('save', async function(next) {
    if (!this.isNew || this.payout_id) return next();
    
    try {
        const lastPayout = await this.constructor.findOne({}, {}, { sort: { 'payout_id': -1 } });
        let newId = 'PYT001'; // Default starting ID
        
        if (lastPayout && lastPayout.payout_id) {
            // Extract the numeric part and increment
            const lastIdNumber = parseInt(lastPayout.payout_id.replace('PYT', ''), 10);
            newId = `PYT${String(lastIdNumber + 1).padStart(3, '0')}`;
        }
        
        this.payout_id = newId;
        next();
    } catch (error) {
        next(error);
    }
});

export default mongoose.model('Payout', PayoutSchema);