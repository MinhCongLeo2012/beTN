const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth.routes');
const examRoutes = require('./routes/exam.routes');
const classRoutes = require('./routes/class.routes');
const classDetailRoutes = require('./routes/classDetail.routes');
const gradingRoutes = require('./routes/gradingRoutes');
const adminRoutes = require('./routes/admin.routes');
const app = express();

// Debug environment variables
console.log('Loading environment variables:', {
  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_APP_PASSWORD: process.env.EMAIL_APP_PASSWORD,
  ENV_PATH: path.resolve(__dirname, '../.env')
});

// Middleware
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/exam', examRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/class-details', classDetailRoutes);
app.use('/api/grading', gradingRoutes);
app.use('/api', adminRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Lỗi server', 
    error: err.message 
  });
});

module.exports = app; 