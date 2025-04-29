import mongoose from "mongoose";

const SchemeSchema = new mongoose.Schema({
    scheme_id: {
        type: String,
        unique: true,
    },
    scheme_name: {
        type: String,
        required: true,
    },
    chit_amount: {
        type: Number,
        required: true,
    },
    duration_months: {
        type: Number,
        required: true,
    },
    installment_amount: {
        type: Number,
        required: true,
    },
    commission_rate: {
        type: Number,
        required: true,
    },
    min_members: {
        type: Number,
        required: true,
    },
    max_members: {
        type: Number,
        required: true,
    },
    auction_frequency: {
        type: String,
        enum: ['Monthly', 'Weekly', 'Biweekly'],
        default: 'Monthly'
    },
    enabled: {
        type: Boolean,
        default: true,
    },
    created_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    },
    description: {
        type: String
    }
}, { timestamps: true });

// Pre-save hook to generate scheme_id
SchemeSchema.pre('save', async function (next) {
    if (!this.isNew || this.scheme_id) return next();
    try {
        const lastScheme = await this.constructor.findOne({}, {}, { sort: { 'scheme_id': -1 } });
        let newId = 'SCH001';
        if (lastScheme && lastScheme.scheme_id) {
            const lastIdNumber = parseInt(lastScheme.scheme_id.replace('SCH', ''), 10);
            newId = `SCH${String(lastIdNumber + 1).padStart(3, '0')}`;
        }
        this.scheme_id = newId;
        next();
    } catch (error) {
        next(error);
    }
});

export default mongoose.model('Scheme', SchemeSchema);