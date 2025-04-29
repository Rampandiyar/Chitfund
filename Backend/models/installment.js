import mongoose from "mongoose";

const InstallmentSchema = new mongoose.Schema({
  installment_id: {
    type: String,
    unique: true
  },
  group_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true
  },
  member_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Member',
    required: true
  },
  scheme_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Scheme',
    required: true
  },
  installment_number: {
    type: Number,
  },
  installment_period: {
    type: String, // "Month 1", "Week 2", etc.
  },
  due_date: {
    type: Date,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  paid_date: {
    type: Date
  },
  paid_amount: {
    type: Number,
    default: 0
  },
  pending_amount: {
    type: Number,
    default: function() {
      return this.amount - (this.paid_amount || 0);
    }
  },
  status: {
    type: String,
    enum: ['Pending', 'Paid', 'Partial', 'Late'],
    default: 'Pending'
  },
  late_fee: {
    type: Number,
    default: 0
  },
  collected_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  payment_mode: {
    type: String,
    enum: ['Cash', 'Cheque', 'Online', 'Bank Transfer'],
    default: 'Cash'
  },
  transaction_id: {
    type: String
  }
}, { timestamps: true });

// Pre-save hook to generate installment_id, auto-increment installment_number, 
// calculate pending amount and installment period
InstallmentSchema.pre('save', async function(next) {
  try {
    // Generate installment_id if it's a new document
    if (this.isNew && !this.installment_id) {
      const lastInstallment = await this.constructor.findOne({}, {}, { sort: { 'installment_id': -1 } });
      let newId = 'INS001';
      
      if (lastInstallment && lastInstallment.installment_id) {
        const lastIdNumber = parseInt(lastInstallment.installment_id.replace('INS', ''), 10);
        newId = `INS${String(lastIdNumber + 1).padStart(3, '0')}`;
      }
      
      this.installment_id = newId;
    }
    
    // Auto-increment installment_number for this member in this group
    if (this.isNew && !this.installment_number) {
      const lastInstallment = await this.constructor.findOne(
        { 
          group_id: this.group_id,
          member_id: this.member_id 
        }, 
        {}, 
        { sort: { 'installment_number': -1 } }
      );
      
      this.installment_number = lastInstallment ? lastInstallment.installment_number + 1 : 1;
    }
    
    // Calculate pending amount
    this.pending_amount = this.amount - (this.paid_amount || 0);
    
    // Set status based on payment
    if (this.paid_amount && this.paid_amount > 0) {
      if (this.pending_amount <= 0) {
        this.status = 'Paid';
      } else if (this.paid_amount < this.amount) {
        this.status = 'Partial';
      }
    }
    
    // If due date has passed and not fully paid, mark as Late
    if (this.due_date < new Date() && this.pending_amount > 0) {
      this.status = 'Late';
    }
    
    // Generate installment period based on scheme and installment number
    if (this.isNew && !this.installment_period && this.scheme_id) {
      try {
        const Scheme = mongoose.model('Scheme');
        const scheme = await Scheme.findById(this.scheme_id);
        
        if (scheme) {
          if (scheme.auction_frequency === 'Monthly') {
            this.installment_period = `Month ${this.installment_number}`;
          } else if (scheme.auction_frequency === 'Weekly') {
            this.installment_period = `Week ${this.installment_number}`;
          } else if (scheme.auction_frequency === 'Biweekly') {
            this.installment_period = `Biweek ${this.installment_number}`;
          }
        }
      } catch (error) {
        // If scheme lookup fails, use default format
        this.installment_period = `Period ${this.installment_number}`;
      }
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Virtual property for progress percentage
InstallmentSchema.virtual('paymentProgress').get(function() {
  if (!this.amount || this.amount === 0) return 0;
  return Math.min(100, Math.round((this.paid_amount || 0) * 100 / this.amount));
});

export default mongoose.model('Installment', InstallmentSchema);