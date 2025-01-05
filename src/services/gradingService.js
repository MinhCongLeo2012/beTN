const KetQua = require('../models/KetQua');
const KiemTra = require('../models/KiemTra');
const pool = require('../config/database');

class GradingService {
  static async gradeExam(examData, examId) {
    const client = await pool.connect();
    
    try {
      if (!examData.iduser) {
        throw new Error('iduser is required');
      }

      await client.query('BEGIN');

      // Lấy thông tin đề thi và câu hỏi
      const examQuery = `
        SELECT d.tende, d.tongsocau
        FROM DETHI d
        WHERE d.iddethi = $1
      `;
      const { rows: [examInfo] } = await client.query(examQuery, [examId]);

      // Lấy thông tin câu hỏi và đáp án đúng
      const query = `
        SELECT 
          c.idcauhoi, 
          c.diem, 
          d.dapandung, 
          c.noidung,
          c.dap_an_a, 
          c.dap_an_b, 
          c.dap_an_c, 
          c.dap_an_d,
          chmd.idmucdo,
          md.tenmucdo
        FROM CAUHOI c
        JOIN CH_DA_MD chmd ON c.idcauhoi = chmd.idcauhoi
        JOIN DAPAN d ON chmd.iddapan = d.iddapan
        JOIN MUCDO md ON chmd.idmucdo = md.idmucdo
        WHERE c.iddethi = $1
      `;
      
      const { rows: questions } = await client.query(query, [examId]);
      
      let socaudung = 0;
      let tongdiem = 0;
      let detailedAnswers = [];
      
      // Chấm điểm từng câu và lưu chi tiết
      for (const question of questions) {
        const userAnswer = examData.answers.find(a => a.idcauhoi === question.idcauhoi);
        
        // Chuyển đổi dapandung từ số sang chữ cái
        const dapandungMap = {
          '1': 'A',
          '2': 'B',
          '3': 'C',
          '4': 'D'
        };
        const correctAnswer = dapandungMap[question.dapandung];
        
        // So sánh đáp án - thêm normalization để đảm bảo so sánh chính xác
        const isCorrect = userAnswer && 
                         userAnswer.dapanchon && 
                         userAnswer.dapanchon.trim().toUpperCase() === correctAnswer;
        
        if (isCorrect) {
          socaudung++;
          tongdiem += parseFloat(question.diem);
        }

        detailedAnswers.push({
          idcauhoi: question.idcauhoi,
          noidung: question.noidung,
          dapanchon: userAnswer?.dapanchon?.trim().toUpperCase() || null,
          dapandung: correctAnswer,
          isCorrect: isCorrect,
          diem: isCorrect ? parseFloat(question.diem) : 0,
          mucdo: {
            id: question.idmucdo,
            ten: question.tenmucdo
          },
          cacDapAn: {
            A: question.dap_an_a,
            B: question.dap_an_b,
            C: question.dap_an_c,
            D: question.dap_an_d
          }
        });
      }

      const socausai = questions.length - socaudung;

      // Lưu kết quả
      const ketQua = new KetQua({
        trangthai: 'COMPLETED',
        tglambai: Math.floor(examData.tglambai),
        socaudung,
        socausai,
        tongdiem
      });

      const savedKetQua = await ketQua.save();

      // Cập nhật kết quả vào bảng KIEMTRA
      await KiemTra.update(examId, examData.iduser, {
        dapanchon: JSON.stringify(detailedAnswers),
        idketqua: savedKetQua.idketqua,
        idlop: examData.idlop,
        thoigian: examData.tglambai
      });

      await client.query('COMMIT');
      
      // Thêm truy vấn lấy thông tin học sinh
      const studentQuery = `
        SELECT u.hoten
        FROM "USER" u
        WHERE u.iduser = $1
      `;
      const { rows: [studentInfo] } = await client.query(studentQuery, [examData.iduser]);

      return {
        idketqua: savedKetQua.idketqua,
        tongdiem: parseFloat(tongdiem.toFixed(2)),
        socaudung,
        socausai,
        tongsocau: questions.length,
        tende: examInfo.tende,
        tglambai: examData.tglambai,
        chitiet: detailedAnswers,
        maxScore: questions.reduce((sum, q) => sum + parseFloat(q.diem), 0),
        studentName: studentInfo?.hoten || 'Không xác định'
      };

    } catch (error) {
      console.error('Lỗi trong gradeExam:', error);
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async getExamResult(resultId) {
    const client = await pool.connect();
    try {
      const ketqua = await KetQua.findById(resultId);
      if (!ketqua) return null;

      const kiemtra = await KiemTra.findByKetQua(resultId);

      return {
        idketqua: ketqua.idketqua,
        tongdiem: ketqua.tongdiem,
        socaudung: ketqua.socaudung,
        socausai: ketqua.socausai,
        tglambai: ketqua.tglambai,
        tende: kiemtra?.tende,
        tongsocau: kiemtra?.tongsocau,
        trangthai: ketqua.trangthai,
        chitiet: kiemtra?.dapanchon || []
      };

    } catch (error) {
      console.error('Error in getExamResult:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = GradingService; 