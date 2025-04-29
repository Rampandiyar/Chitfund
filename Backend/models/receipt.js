import mongoose from "mongoose";

const ReceiptSchema = new mongoose.Schema({
    receipt_id: {
        type: String,
        unique: true,
    },
    branch_id: {
        type: mongoose.Schema.Types.ObjectId, 
        required: true,
        ref: 'Branch'
    },
    member_id: {
        type: mongoose.Schema.Types.ObjectId, 
        required: true,
        ref: 'Member'
    },
    group_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group'
    },
    receipt_date: {
        type: Date,
        required: true,
        default: Date.now
    },
    receipt_amount: {
        type: Number,
        required: true,
    },
    receipt_no: {
        type: String,
    },
    payment_mode: {
        type: String,
        enum: ['Cash', 'Cheque', 'Online', 'Bank Transfer'],
        default: 'Cash'
    },
    cheque_details: {
        cheque_no: String,
        bank_name: String,
        branch_name: String,
        cheque_date: Date
    },
    transaction_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction'
    },
    received_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true
    },
    remarks: {
        type: String
    },
    status: {
        type: String,
        enum: ['Pending', 'Completed', 'Cancelled'],
        default: 'Completed'
    }
}, { timestamps: true });

// Pre-save hook to generate receipt_id and receipt_no
ReceiptSchema.pre('save', async function (next) {
    if (!this.isNew) return next();
    
    try {
        // Generate receipt_id
        const lastReceipt = await this.constructor.findOne({}, {}, { sort: { 'receipt_id': -1 } });
        let newId = 'RCP001';
        if (lastReceipt && lastReceipt.receipt_id) {
            const lastIdNumber = parseInt(lastReceipt.receipt_id.replace('RCP', ''), 10);
            newId = `RCP${String(lastIdNumber + 1).padStart(3, '0')}`;
        }
        this.receipt_id = newId;
        
        // Generate receipt_no (branch-year-sequence)
        const branch = await mongoose.model('Branch').findById(this.branch_id);
        const branchCode = branch.bname.substring(0, 3).toUpperCase();
        const year = new Date().getFullYear().toString().slice(-2);
        
        const lastReceiptNo = await this.constructor.findOne(
            { branch_id: this.branch_id },
            {}, 
            { sort: { 'receipt_no': -1 } }
        );
        
        let sequence = 1;
        if (lastReceiptNo && lastReceiptNo.receipt_no) {
            const lastSeq = parseInt(lastReceiptNo.receipt_no.split('-')[2], 10);
            sequence = lastSeq + 1;
        }
        
        this.receipt_no = `${branchCode}-${year}-${sequence.toString().padStart(5, '0')}`;
        
        next();
    } catch (error) {
        next(error);
    }
});

export default mongoose.model("Receipt", ReceiptSchema);