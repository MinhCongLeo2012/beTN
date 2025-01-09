const express = require('express');
const router = express.Router();
const ExamController = require('../controllers/exam.controller');
const { verifyToken } = require('../middlewares/auth.middleware');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// Đặt các route cụ thể trước route có parameter
router.get('/template', verifyToken, ExamController.getExamTemplate); // Đặt trước /:id
router.post('/parse', verifyToken, upload.single('file'), ExamController.parseExamFile);

// Các routes có parameter đặt sau
router.get('/', verifyToken, ExamController.getAllExams);
router.post('/create', verifyToken, ExamController.createExam);
router.get('/:id', verifyToken, ExamController.getExamById);
router.delete('/:id', verifyToken, ExamController.deleteExam);
router.put('/:id', verifyToken, ExamController.updateExam);
router.post('/assign/:id', verifyToken, ExamController.assignExam);
router.get('/:id/info', verifyToken, ExamController.getExamInfo);
router.get('/:id/student', verifyToken, ExamController.getExamForStudent);
router.get('/class/:classId', verifyToken, ExamController.getExamsByClass);

module.exports = router;