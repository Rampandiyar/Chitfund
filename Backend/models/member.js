import mongoose from "mongoose";

const MemberSchema = new mongoose.Schema({
    member_id: {
        type: String,
        unique: true,
    },
    branch_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Branch',
        required: true,
    },
    mem_name: {
        type: String,
        required: true,
    },
    gender: {
        type: String,
        required: true,
    },
    dob: {
        type: Date,
        required: true,
    },
    age: {
        type: Number,
        required: true,
    },
    address: {
        type: String,
        required: true,
    },
    pincode: {
        type: Number,
        required: true,
    },
    phone: {
        type: String,
        required: true,
    },
    mobile: {
        type: String,
        required: true,
    },
    nominee_name: {
        type: String,
        required: true,
    },
    nominee_relation: {
        type: String,
        required: true
    },
    uid: {
        type: String,
        required: true,
        unique: true,
    },
    photo: {
        type: String,
        default: '../assets/user.png'
    },
    active: {
        type: Boolean,
        default: true, 
    },
    registered_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    },
    registration_date: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// Pre-save hook to generate member_id
MemberSchema.pre('save', async function (next) {
    if (!this.isNew || this.member_id) return next();
    try {
        const lastMember = await this.constructor.findOne({}, {}, { sort: { 'member_id': -1 } });
        let newId = 'MEM001';
        if (lastMember && lastMember.member_id) {
            const lastIdNumber = parseInt(lastMember.member_id.replace('MEM', ''), 10);
            newId = `MEM${String(lastIdNumber + 1).padStart(3, '0')}`;
        }
        this.member_id = newId;
        next();
    } catch (error) {
        next(error);
    }
});

export default mongoose.model('Member', MemberSchema);