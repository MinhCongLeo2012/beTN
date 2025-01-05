const GradingService = require('../services/gradingService');

exports.submitExam = async (req, res) => {
  try {
    const { examId } = req.params;
    const answers = req.body;
    
    // Lấy iduser từ request body hoặc từ token
    const iduser = answers.iduser || req.user?.iduser;

    // Tạo object mới với đầy đủ thông tin
    const examData = {
      ...answers,
      iduser: iduser,
      examId: examId,
      tglambai: parseInt(answers.tglambai) || 0,
      // Ensure answers is always an array, even if empty
      answers: Array.isArray(answers.answers) ? answers.answers : []
    };

    // Kiểm tra và log thông tin
    console.log('Submitting exam with data:', {
      examId,
      iduser: examData.iduser,
      answersCount: examData.answers.length,
      answers: examData.answers
    });

    if (!examData.iduser) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const result = await GradingService.gradeExam(examData, examId);
    
    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error in submitExam:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.getExamResult = async (req, res) => {
  try {
    const { resultId } = req.params;
    const result = await GradingService.getExamResult(resultId);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy kết quả bài kiểm tra'
      });
    }

    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error in getExamResult:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}; 