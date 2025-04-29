import mongoose from "mongoose";

const TransactionSchema = new mongoose.Schema({
    transaction_id: {
        type: String,
        unique: true
    },
    branch_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Branch',
        required: true
    },
    member_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Member',
        required: function() {
            // Required for all transaction types except certain types
            return !['Commission', 'Other'].includes(this.transaction_type);
        }
    },
    group_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
        required: function() {
            // Required only for Installment and Auction types
            return ['Installment', 'Auction'].includes(this.transaction_type);
        }
    },
    transaction_type: {
        type: String,
        enum: ['Deposit', 'Withdrawal', 'Installment', 'Auction', 'Commission', 'Penalty', 'Other'],
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0.01,
        validate: {
            validator: function(v) {
                // For withdrawals and deposits, amount should be positive
                if (['Withdrawal', 'Deposit'].includes(this.transaction_type)) {
                    return v > 0;
                }
                return true;
            },
            message: 'Amount must be positive for withdrawals and deposits'
        }
    },
    transaction_date: {
        type: Date,
        default: Date.now,
        validate: {
            validator: function(v) {
                // Transaction date shouldn't be in the future
                return v <= new Date();
            },
            message: 'Transaction date cannot be in the future'
        }
    },
    description: {
        type: String,
        required: function() {
            return this.transaction_type === 'Other';
        }
    },
    payment_mode: {
        type: String,
        enum: ['Cash', 'Cheque', 'Online', 'Bank Transfer'],
        default: 'Cash',
        required: true
    },
    reference_id: {
        type: String,
        required: function() {
            return ['Cheque', 'Online', 'Bank Transfer'].includes(this.payment_mode);
        }
    },
    recorded_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true
    },
    status: {
        type: String,
        enum: ['Pending', 'Completed', 'Failed', 'Reversed'],
        default: 'Completed'
    },
    related_transaction: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction'
    }
}, { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for formatted amount
TransactionSchema.virtual('formatted_amount').get(function() {
    return `₹${this.amount.toLocaleString('en-IN')}`;
});

// Virtual for formatted date
TransactionSchema.virtual('formatted_date').get(function() {
    return this.transaction_date.toLocaleDateString('en-IN');
});

// Pre-save hook to generate transaction_id
TransactionSchema.pre('save', async function (next) {
    if (!this.isNew || this.transaction_id) return next();
    
    try {
        const lastTransaction = await this.constructor.findOne({}, {}, { sort: { 'transaction_id': -1 } });
        const yearSuffix = new Date().getFullYear().toString().slice(-2);
        let newId = `TXN${yearSuffix}001`;
        
        if (lastTransaction && lastTransaction.transaction_id) {
            const lastIdPrefix = lastTransaction.transaction_id.slice(0, 5);
            const lastIdNumber = parseInt(lastTransaction.transaction_id.slice(5), 10);
            
            // Reset counter if year changed
            if (lastIdPrefix !== `TXN${yearSuffix}`) {
                newId = `TXN${yearSuffix}001`;
            } else {
                newId = `TXN${yearSuffix}${String(lastIdNumber + 1).padStart(3, '0')}`;
            }
        }
        
        this.transaction_id = newId;
        next();
    } catch (error) {
        next(error);
    }
});

// Validate payment reference for non-cash transactions
TransactionSchema.pre('save', function(next) {
    if (this.payment_mode !== 'Cash' && !this.reference_id) {
        throw new Error('Reference ID is required for non-cash payments');
    }
    next();
});

// ... rest of your schema code ...

// Indexes for better query performance (remove transaction_id index)
TransactionSchema.index({ member_id: 1 });
TransactionSchema.index({ group_id: 1 });
TransactionSchema.index({ transaction_date: -1 });
TransactionSchema.index({ transaction_type: 1 });

// Static method to get transactions summary
TransactionSchema.statics.getSummary = async function(memberId) {
    return this.aggregate([
        { $match: { member_id: new mongoose.Types.ObjectId(memberId) } },
        { $group: {
            _id: '$transaction_type',
            totalAmount: { $sum: '$amount' },
            count: { $sum: 1 }
        }}
    ]);
};

export default mongoose.model('Transaction', TransactionSchema);