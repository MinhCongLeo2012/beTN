const express = require('express');
const router = express.Router();
const GradingController = require('../controllers/gradingController');

router.post('/exams/:examId/submit', GradingController.submitExam);
router.get('/results/:resultId', GradingController.getExamResult);

module.exports = router; 