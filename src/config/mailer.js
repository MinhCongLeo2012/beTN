const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER || 'minh0363217538@gmail.com',
    pass: process.env.EMAIL_APP_PASSWORD || 'hjym nipo iwyy kvhq'
  },
  tls: {
    rejectUnauthorized: false
  },
  debug: process.env.NODE_ENV !== 'production',
  logger: process.env.NODE_ENV !== 'production'
});

// Thêm cấu hình mặc định cho transporter
transporter.defaults = {
  from: {
    name: 'Hệ thống thi trực tuyến',
    address: process.env.EMAIL_USER || 'minh0363217538@gmail.com'
  }
};

// Verify connection configuration
transporter.verify()
  .then(() => {
    console.log('SMTP connection verified successfully');
  })
  .catch((error) => {
    console.error('SMTP verification failed:', error);
  });

module.exports = transporter; 