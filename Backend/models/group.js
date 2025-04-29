import mongoose from 'mongoose';

const groupSchema = new mongoose.Schema({
    group_id: {
        type: String,
        unique: true
    },
    branch_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Branch',
        required: true
    },
    scheme_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Scheme',
        required: true
    },
    start_date: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: ['Forming', 'Active', 'Completed'],
        default: 'Forming'
    },
    members: [{
        member_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Member',
            required: true
        },
        join_date: {
            type: Date,
            default: Date.now
        },
        payout_month: {
            type: Number,
            min: 1,
            required: true
        },
        payout_received: {
            type: Boolean,
            default: false
        }
    }],
    current_month: {
        type: Number,
        default: 1
    }
}, { timestamps: true });

// Auto-increment group_id
groupSchema.pre('save', async function(next) {
    if (!this.isNew || this.group_id) return next();
    
    try {
        const lastGroup = await this.constructor.findOne({}, {}, { sort: { 'group_id': -1 } });
        let newId = 'GRP001'; // Default starting ID
        
        if (lastGroup && lastGroup.group_id) {
            // Extract the numeric part and increment
            const lastIdNumber = parseInt(lastGroup.group_id.replace('GRP', ''), 10);
            newId = `GRP${String(lastIdNumber + 1).padStart(3, '0')}`;
        }
        
        this.group_id = newId;
        next();
    } catch (error) {
        next(error);
    }
});

// Validation to ensure unique payout months and check against scheme duration
groupSchema.pre('save', async function(next) {
    try {
        // Check for duplicate payout months
        const payoutMonths = this.members.map(m => m.payout_month);
        if (new Set(payoutMonths).size !== payoutMonths.length) {
            throw new Error('Duplicate payout months not allowed');
        }
        
        // Fetch the scheme document to get duration
        const scheme = await mongoose.model('Scheme').findById(this.scheme_id);
        if (!scheme) {
            throw new Error('Referenced scheme not found');
        }
        
        // Validate each member's payout month against scheme duration
        for (const member of this.members) {
            if (member.payout_month > scheme.duration_months) {
                throw new Error(
                    `Payout month ${member.payout_month} exceeds scheme duration of ${scheme.duration_months} months`
                );
            }
        }
        
        next();
    } catch (error) {
        next(error);
    }
});

// Add a static method to validate payout months against scheme duration
groupSchema.statics.validatePayoutMonths = async function(groupData) {
    const scheme = await mongoose.model('Scheme').findById(groupData.scheme_id);
    if (!scheme) {
        throw new Error('Referenced scheme not found');
    }
    
    for (const member of groupData.members) {
        if (member.payout_month > scheme.duration_months) {
            throw new Error(
                `Payout month ${member.payout_month} exceeds scheme duration of ${scheme.duration_months} months`
            );
        }
    }
    
    return true;
};

export default mongoose.model('Group', groupSchema);