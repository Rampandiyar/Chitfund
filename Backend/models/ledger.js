import mongoose from "mongoose";

const LedgerSchema = new mongoose.Schema({
    ledger_id: {
        type: String,
        unique: true,
    },
    branch_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Branch",
        required: true,
    },
    member_id: {
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Member",
        required: true,
    },
    group_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Group"
    },
    transaction_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Transaction",
        required: true
    },
    date: {
        type: Date,
        required: true,
        default: Date.now
    },
    debit: {
        type: Number,
        default: 0
    },
    credit: {
        type: Number,
        default: 0
    },
    balance: {
        type: Number,
        required: true
    },
    description: {
        type: String
    },
    reference: {
        type: String
    }
}, { timestamps: true });

// Pre-save hook to generate ledger_id
LedgerSchema.pre('save', async function (next) {
    if (!this.isNew || this.ledger_id) return next();
    try {
        const lastLedger = await this.constructor.findOne({}, {}, { sort: { 'ledger_id': -1 } });
        let newId = 'LGR001';
        if (lastLedger && lastLedger.ledger_id) {
            const lastIdNumber = parseInt(lastLedger.ledger_id.replace('LGR', ''), 10);
            newId = `LGR${String(lastIdNumber + 1).padStart(3, '0')}`;
        }
        this.ledger_id = newId;
        next();
    } catch (error) {
        next(error);
    }
});

export default mongoose.model("Ledger", LedgerSchema);