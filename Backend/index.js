import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import employeeRoutes from './routes/Employee.js';
import branchRoutes from "./routes/Branch.js";
import groupRoutes from "./routes/Group.js";
import ledgerRoutes from "./routes/Ledger.js";
import memberRoutes from "./routes/Member.js";
import recieptRoutes from "./routes/Receipt.js";
import schemeRoutes from "./routes/Scheme.js";
import transactionRoutes from "./routes/Transaction.js";
import installmentRoutes from './routes/Installment.js';
import notificationRoutes from './routes/Notification.js';
import payoutRoutes from './routes/Payout.js';
import bookingRoutes from './routes/Booking.js';

import cors from 'cors';
dotenv.config();

const app = express();
app.use(cors({ origin: 'http://localhost:4200', credentials: true }));
app.use(express.json());  

app.use('/api/employees', employeeRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/ledgers', ledgerRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/reciepts', recieptRoutes);
app.use('/api/schemes', schemeRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/installments', installmentRoutes);
app.use('/api/notifications', notificationRoutes); 
app.use('/api/payouts', payoutRoutes); 
app.use('/api/bookings', bookingRoutes);

app.use((err, req, res, next) => {
    const statusCode = err.status || 500;
    const message = err.message || "Something went wrong";
    return res.status(statusCode).json({
        success: [200, 201, 204].includes(statusCode),
        status: statusCode,
        message: message,
        data: err.data || null,
    });
});

const connectMongoose = async () => {
    try {
        await mongoose.connect(process.env.MONGO_CONNECT);
        console.log('MongoDB Connected...');
    } catch (error) {
        console.error('Error connecting to MongoDB:', error.message);
        process.exit(1);
    }
};

app.listen(4000, () => {
    connectMongoose();
    console.log('Server running on port 4000');
});
