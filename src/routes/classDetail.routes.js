const express = require('express');
const router = express.Router();
const ClassDetailController = require('../controllers/classDetail.controller');
const { verifyToken } = require('../middlewares/auth.middleware');
const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.get('/:id', verifyToken, ClassDetailController.getClassDetails);
router.get('/:id/students', verifyToken, ClassDetailController.getStudents);
router.post('/:id/students', verifyToken, ClassDetailController.addStudent);
router.put('/:id/students/:studentId', verifyToken, ClassDetailController.updateStudent);
router.delete('/:id/students/bulk', verifyToken, ClassDetailController.deleteMultipleStudents);
router.delete('/:id/students/:studentId', verifyToken, ClassDetailController.deleteStudent);
router.get('/:id/exams', verifyToken, ClassDetailController.getClassExams);
router.get('/:id/export-students', verifyToken, ClassDetailController.exportStudentList);
router.post('/:id/import-students', verifyToken, upload.single('file'), ClassDetailController.importStudents);
router.get('/:id/import-template', verifyToken, ClassDetailController.getImportTemplate);
router.get('/:id/export-results', verifyToken, ClassDetailController.exportExamResults);

module.exports = router; 