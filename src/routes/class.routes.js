const express = require('express');
const router = express.Router();
const ClassController = require('../controllers/class.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

// Basic CRUD routes
router.get('/', verifyToken, ClassController.getAllClasses);
router.get('/:id', verifyToken, ClassController.getClassById);
router.post('/', verifyToken, ClassController.createClass);
router.put('/:id', verifyToken, ClassController.updateClass);
router.delete('/:id', verifyToken, ClassController.deleteClass);
router.get('/student/:studentId', verifyToken, ClassController.getStudentClasses);

module.exports = router; 