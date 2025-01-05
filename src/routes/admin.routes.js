const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/admin.controller');
const { verifyToken, checkAdminRole } = require('../middlewares/auth.middleware');

// Áp dụng middleware cho tất cả routes admin
router.use(verifyToken, checkAdminRole);

// Admin routes - User management
router.get('/admin/users', AdminController.getUsers);
router.get('/admin/users/:id', AdminController.getUser);
router.post('/admin/users', AdminController.createUser);
router.put('/admin/users/:id', AdminController.updateUser);
router.delete('/admin/users/:id', AdminController.deleteUser);

// Admin routes - Exam management
router.get('/admin/exams', AdminController.getExams);
router.get('/admin/exams/:id', AdminController.getExam);
router.post('/admin/exams', AdminController.createExam);
router.put('/admin/exams/:id', AdminController.updateExam);
router.delete('/admin/exams/:id', AdminController.deleteExam);

module.exports = router; 