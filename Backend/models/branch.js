import mongoose from "mongoose";

const BranchSchema = new mongoose.Schema({
    branch_id: {
        type: String,
        unique: true,
    },
    bname: {
        type: String,
        required: true,
        unique: true,
    },
    parent_id: {
        type: String,
        required: true,
    },
    start_date: {
        type: Date,
        required: true,
    },
    status: {
        type: String,
        enum: ['Active', 'Inactive'],
        default: 'Active'
    }
}, { timestamps: true });

// Auto-increment branch_id
BranchSchema.pre('save', async function (next) {
    if (!this.isNew || this.branch_id) return next();
    
    try {
        const lastBranch = await this.constructor.findOne({}, {}, { sort: { 'branch_id': -1 } });
        let newId = 'BRN001'; // Default starting ID
        
        if (lastBranch && lastBranch.branch_id) {
            // Extract the numeric part and increment
            const lastIdNumber = parseInt(lastBranch.branch_id.replace('BRN', ''), 10);
            newId = `BRN${String(lastIdNumber + 1).padStart(3, '0')}`;
        }
        
        this.branch_id = newId;
        next();
    } catch (error) {
        next(error);
    }
});

export default mongoose.model("Branch", BranchSchema);