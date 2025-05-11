import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const EmployeeSchema = new mongoose.Schema({
    emp_id: {
        type: String,
        unique: true
    },
    emp_name: {
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
    phone: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6, 
    },
    status: {
        type: String,
        default: 'Active',
    },
    address: {
        type: String,
        required: true,
    },
    role: {  
        type: String,
        enum: ['Admin', 'Manager', 'Employee'], 
        default: 'Employee', 
    },
// models/Employee.js
photo: {
    type: String,
    default: ''
  },
    branch_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Branch',
        required: true
    },
    joining_date: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// Pre-save hooks and methods remain the same as in your original
EmployeeSchema.pre('save', async function (next) {
    if (!this.isNew || this.emp_id) return next();
    try {
        const lastEmployee = await this.constructor.findOne({}, {}, { sort: { 'emp_id': -1 } });
        let newId = 'EMP001';
        if (lastEmployee && lastEmployee.emp_id) {
            const lastIdNumber = parseInt(lastEmployee.emp_id.replace('EMP', ''), 10);
            newId = `EMP${String(lastIdNumber + 1).padStart(3, '0')}`;
        }
        this.emp_id = newId;
        next();
    } catch (error) {
        next(error);
    }
});

EmployeeSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

EmployeeSchema.methods.comparePassword = async function (enteredPassword) {
    try {
        return await bcrypt.compare(enteredPassword, this.password);
    } catch (error) {
        throw error;
    }
};

EmployeeSchema.statics.findByEmail = async function (email) {
    try {
        return await this.findOne({ email });
    } catch (error) {
        throw error;
    }
};

export default mongoose.model('Employee', EmployeeSchema);