// const DeThi = require('../models/DeThi');
// const CauHoi = require('../models/CauHoi');
// const DapAn = require('../models/DapAn');
// const pool = require('../config/database');
// const User = require('../models/User');
// const pdfjsLib = require('pdfjs-dist');
// const path = require('path');
// const pdfParse = require('pdf-parse');
// const PDFDocument = require('pdfkit');

// // Cấu hình worker
// pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// class ExamController {
//   static async createExam(req, res) {
//     const client = await pool.connect();
//     try {
//       console.log('Request body:', {
//         ...req.body,
//         questions: req.body.questions ? `${req.body.questions.length} questions` : undefined
//       });

//       const {
//         tende,
//         monhoc,
//         mucdich,
//         khoi,
//         ghichu,
//         questions
//       } = req.body;

//       // Validate references first
//       try {
//         // Check monhoc exists
//         const cleanMonhoc = (monhoc || '').trim().toUpperCase();
//         console.log('Checking subject with code:', {
//           original: monhoc,
//           cleaned: cleanMonhoc,
//           type: typeof monhoc
//         });
        
//         const monhocCheck = await client.query(
//           `SELECT idmonhoc, tenmonhoc 
//            FROM MONHOC 
//            WHERE UPPER(idmonhoc) = $1`,
//           [cleanMonhoc]
//         );
        
//         // List all available subjects for debugging
//         const allSubjects = await client.query(
//           'SELECT idmonhoc, tenmonhoc FROM MONHOC'
//         );
        
//         console.log('Database check results:', {
//           searchedCode: cleanMonhoc,
//           found: monhocCheck.rows.length > 0,
//           result: monhocCheck.rows,
//           allSubjects: allSubjects.rows
//         });

//         if (monhocCheck.rows.length === 0) {
//           return res.status(400).json({
//             success: false,
//             message: 'Môn học không tồn tại',
//             field: 'monhoc',
//             detail: {
//               providedCode: cleanMonhoc,
//               availableSubjects: allSubjects.rows.map(s => ({
//                 id: s.idmonhoc,
//                 name: s.tenmonhoc
//               }))
//             }
//           });
//         }

//         // Use the correct case from database
//         const correctMonhoc = monhocCheck.rows[0].idmonhoc;
        
//         // Check mucdich exists
//         const mucDichCheck = await client.query(
//           'SELECT idmucdich FROM MUCDICH WHERE idmucdich = $1',
//           [mucdich]
//         );
//         if (mucDichCheck.rows.length === 0) {
//           return res.status(400).json({
//             success: false,
//             message: 'Mục đích không tồn tại',
//             field: 'mucdich'
//           });
//         }

//         // Check khoi exists
//         const khoiCheck = await client.query(
//           'SELECT idkhoi FROM KHOI WHERE idkhoi = $1',
//           [khoi]
//         );
//         if (khoiCheck.rows.length === 0) {
//           return res.status(400).json({
//             success: false,
//             message: 'Khối không tồn tại',
//             field: 'khoi'
//           });
//         }

//         console.log('Reference checks passed:', {
//           monhoc: monhocCheck.rows[0],
//           mucdich: mucDichCheck.rows[0],
//           khoi: khoiCheck.rows[0]
//         });

//       } catch (checkError) {
//         console.error('Error checking references:', checkError);
//         throw checkError;
//       }

//       // Rest of your existing validation
//       if (!tende || !monhoc || !mucdich || !khoi || !Array.isArray(questions)) {
//         console.log('Validation failed:', {
//           tende: !!tende,
//           monhoc: !!monhoc,
//           mucdich: !!mucdich,
//           khoi: !!khoi,
//           questions: Array.isArray(questions)
//         });
//         return res.status(400).json({
//           success: false,
//           message: 'Thiếu thông tin bắt buộc để tạo đề thi',
//           missingFields: {
//             tende: !tende,
//             monhoc: !monhoc,
//             mucdich: !mucdich,
//             khoi: !khoi,
//             questions: !Array.isArray(questions)
//           }
//         });
//       }

//       // Check if user exists and has required permissions
//       if (!req.user || !req.user.id) {
//         throw new Error('Unauthorized - User not authenticated');
//       }

//       console.log('Starting transaction');
//       await client.query('BEGIN');

//       // 1. Tạo đề thi
//       console.log('Creating exam with params:', {
//         userId: req.user.id,
//         tende,
//         questionCount: questions.length,
//         monhoc,
//         mucdich,
//         khoi
//       });

//       const examResult = await client.query(
//         `INSERT INTO DETHI (
//           iduser,
//           tende,
//           tongsocau,
//           ghichu,
//           ngaytao,
//           idmonhoc,
//           idmucdich,
//           idkhoi
//         ) VALUES ($1, $2, $3, $4, CURRENT_DATE, $5, $6, $7) RETURNING iddethi`,
//         [
//           req.user.id,
//           tende,
//           questions.length,
//           ghichu,
//           monhoc,
//           mucdich,
//           khoi
//         ]
//       ).catch(err => {
//         console.error('Database error creating exam:', {
//           code: err.code,
//           message: err.message,
//           detail: err.detail
//         });
//         throw err;
//       });

//       const examId = examResult.rows[0].iddethi;
//       console.log('Created exam with ID:', examId);

//       // 2. Thêm các câu hỏi và đáp án
//       for (const [index, question] of questions.entries()) {
//         try {
//           console.log(`Processing question ${index + 1}:`, {
//             noidung: !!question.noidung,
//             hasAnswers: !!(question.dap_an_a && question.dap_an_b && question.dap_an_c && question.dap_an_d),
//             dapandung: !!question.dapandung
//           });

//           // Validate question data
//           if (!question.noidung || !question.dapandung) {
//             throw new Error(`Câu hỏi ${index + 1} thiếu thông tin bắt buộc`);
//           }

//           // Thêm câu hỏi
//           const questionResult = await client.query(
//             `INSERT INTO CAUHOI (
//               iddethi,
//               noidung,
//               dap_an_a,
//               dap_an_b,
//               dap_an_c,
//               dap_an_d,
//               diem
//             ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING idcauhoi`,
//             [
//               examId,
//               question.noidung,
//               question.dap_an_a || '',
//               question.dap_an_b || '',
//               question.dap_an_c || '',
//               question.dap_an_d || '',
//               question.diem || 1
//             ]
//           );

//           const questionId = questionResult.rows[0].idcauhoi;
//           console.log(`Added question ${index + 1} with ID:`, questionId);

//           // Thêm đáp án
//           const answerResult = await client.query(
//             'INSERT INTO DAPAN (dapandung) VALUES ($1) RETURNING iddapan',
//             [question.dapandung]
//           );

//           const answerId = answerResult.rows[0].iddapan;

//           // Liên kết câu hỏi với đáp án và mức độ
//           await client.query(
//             'INSERT INTO CH_DA_MD (idcauhoi, iddapan, idmucdo) VALUES ($1, $2, $3)',
//             [questionId, answerId, question.mucdo || 'THONG_HIEU']
//           );

//         } catch (questionError) {
//           console.error(`Error processing question ${index + 1}:`, {
//             error: questionError,
//             question: question
//           });
//           throw questionError;
//         }
//       }

//       await client.query('COMMIT');
//       console.log('Exam creation completed successfully');

//       res.json({
//         success: true,
//         message: 'Tạo đề thi thành công',
//         data: { iddethi: examId }
//       });
//     } catch (error) {
//       await client.query('ROLLBACK');
//       console.error('Error in createExam:', {
//         name: error.name,
//         message: error.message,
//         code: error.code,
//         detail: error.detail,
//         constraint: error.constraint,
//         table: error.table
//       });
      
//       let statusCode = 500;
//       let errorMessage = 'Lỗi khi tạo đề thi';
//       let errorDetail = null;

//       // Handle specific error cases
//       if (error.message.includes('Unauthorized')) {
//         statusCode = 401;
//         errorMessage = 'Không có quyền tạo đề thi';
//       } else if (error.code === '23505') {
//         statusCode = 400;
//         errorMessage = 'Đề thi với tên này đã tồn tại';
//       } else if (error.code === '23503') {
//         statusCode = 400;
//         errorMessage = 'Dữ liệu tham chiếu không hợp lệ';
//         if (error.constraint) {
//           if (error.constraint.includes('monhoc')) {
//             errorDetail = 'Môn học không tồn tại';
//           } else if (error.constraint.includes('mucdich')) {
//             errorDetail = 'Mục đích không tồn tại';
//           } else if (error.constraint.includes('khoi')) {
//             errorDetail = 'Khối không tồn tại';
//           }
//         }
//       } else if (error.code === '23502') {
//         statusCode = 400;
//         errorMessage = 'Thiếu thông tin bắt buộc';
//       }

//       res.status(statusCode).json({
//         success: false,
//         message: errorMessage,
//         detail: errorDetail,
//         error: {
//           code: error.code,
//           constraint: error.constraint,
//           detail: error.detail,
//           message: error.message,
//           stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
//         }
//       });
//     } finally {
//       client.release();
//     }
//   }

//   static async getExams(req, res) {
//     const client = await pool.connect();
//     try {
//       const result = await client.query('SELECT * FROM DETHI ORDER BY ngaytao DESC');
//       res.json(result.rows);
//     } catch (error) {
//       console.error('Error getting exams:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Lỗi khi lấy danh sách đề thi'
//       });
//     } finally {
//       client.release();
//     }
//   }

//   static async searchExams(req, res) {
//     try {
//       // Implement search logic here
//       res.json([]);
//     } catch (error) {
//       res.status(500).json({
//         success: false,
//         message: 'Lỗi khi tìm kiếm đề thi'
//       });
//     }
//   }

//   static async getExamById(req, res) {
//     try {
//       const { id } = req.params;
//       const userId = req.user.id;

//       const query = `
//         SELECT d.* 
//         FROM DETHI d
//         WHERE d.iddethi = $1 AND d.iduser = $2
//       `;
      
//       const result = await pool.query(query, [id, userId]);
      
//       if (result.rows.length === 0) {
//         return res.status(404).json({
//           success: false,
//           message: 'Không tìm thấy đề thi'
//         });
//       }

//       res.json({
//         success: true,
//         data: result.rows[0]
//       });
//     } catch (error) {
//       res.status(500).json({
//         success: false,
//         message: 'Lỗi khi lấy thông tin đề thi',
//         error: error.message
//       });
//     }
//   }

//   static async deleteExam(req, res) {
//     const client = await pool.connect();
//     try {
//       const userId = req.user.id;
      
//       // Kiểm tra quyền sở hữu đề thi
//       const examCheck = await client.query(
//         'SELECT iduser FROM DETHI WHERE iddethi = $1',
//         [req.params.id]
//       );

//       if (examCheck.rows.length === 0) {
//         return res.status(404).json({
//           success: false,
//           message: 'Không tìm thấy đề thi'
//         });
//       }

//       if (examCheck.rows[0].iduser !== userId) {
//         return res.status(403).json({
//           success: false,
//           message: 'Bạn không có quyền xóa đề thi này'
//         });
//       }

//       await client.query('BEGIN');

//       // 1. Xóa các bản ghi trong KIEMTRA
//       await client.query(
//         'DELETE FROM KIEMTRA WHERE iddethi = $1',
//         [req.params.id]
//       );

//       // 2. Xóa các bản ghi trong CH_DA_MD và lấy danh sách IDDAPAN
//       const dapAnIds = await client.query(
//         'SELECT DISTINCT iddapan FROM CH_DA_MD WHERE idcauhoi IN (SELECT idcauhoi FROM CAUHOI WHERE iddethi = $1)',
//         [req.params.id]
//       );

//       await client.query(
//         'DELETE FROM CH_DA_MD WHERE idcauhoi IN (SELECT idcauhoi FROM CAUHOI WHERE iddethi = $1)',
//         [req.params.id]
//       );

//       // 3. Xóa các câu hỏi
//       await client.query(
//         'DELETE FROM CAUHOI WHERE iddethi = $1',
//         [req.params.id]
//       );

//       // 4. Xóa các đáp án
//       if (dapAnIds.rows.length > 0) {
//         const dapAnIdsArray = dapAnIds.rows.map(row => row.iddapan);
//         await client.query(
//           'DELETE FROM DAPAN WHERE iddapan = ANY($1)',
//           [dapAnIdsArray]
//         );
//       }

//       // 5. Cuối cùng xóa đề thi
//       await client.query(
//         'DELETE FROM DETHI WHERE iddethi = $1',
//         [req.params.id]
//       );

//       await client.query('COMMIT');
      
//       res.json({ 
//         success: true,
//         message: 'Xóa đề thi và dữ liệu liên quan thành công'
//       });
//     } catch (error) {
//       console.error('Error in deleteExam:', error);
//       await client.query('ROLLBACK');
//       res.status(500).json({
//         success: false,
//         message: 'Lỗi khi xóa đề thi',
//         error: error.message
//       });
//     } finally {
//       client.release();
//     }
//   }

//   static async getAllExams(req, res) {
//     const client = await pool.connect();
//     try {
//       const userId = req.user.id;
      
//       if (!userId) {
//         return res.status(401).json({
//           success: false,
//           message: 'Unauthorized - User ID not found'
//         });
//       }

//       const query = `
//         SELECT 
//           d.*,
//           u.hoten as teacher_name,
//           json_agg(
//             DISTINCT jsonb_build_object(
//               'idcauhoi', ch.idcauhoi,
//               'noidung', ch.noidung,
//               'dap_an_a', ch.dap_an_a,
//               'dap_an_b', ch.dap_an_b,
//               'dap_an_c', ch.dap_an_c,
//               'dap_an_d', ch.dap_an_d,
//               'diem', ch.diem,
//               'mucdo', cdm.idmucdo,
//               'dapan', da.dapandung
//             )
//           ) FILTER (WHERE ch.idcauhoi IS NOT NULL) as questions
//         FROM DETHI d
//         JOIN "USER" u ON d.iduser = u.iduser
//         LEFT JOIN CAUHOI ch ON d.iddethi = ch.iddethi
//         LEFT JOIN CH_DA_MD cdm ON ch.idcauhoi = cdm.idcauhoi
//         LEFT JOIN DAPAN da ON cdm.iddapan = da.iddapan
//         WHERE d.iduser = $1
//         GROUP BY d.iddethi, u.hoten
//         ORDER BY d.ngaytao DESC
//       `;
      
//       const result = await client.query(query, [userId]);

//       res.json({
//         success: true,
//         data: result.rows
//       });
//     } catch (error) {
//       console.error('Error in getAllExams:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Lỗi khi lấy danh sách đề thi',
//         error: error.message
//       });
//     } finally {
//       client.release();
//     }
//   }

//   static async updateExam(req, res) {
//     const client = await pool.connect();
//     try {
//       console.log('Received update request:', {
//         params: req.params,
//         body: req.body,
//         userId: req.user.id
//       });

//       await client.query('BEGIN');
      
//       const { id } = req.params;
//       const { tende, idmucdich } = req.body;
//       const userId = req.user.id;

//       console.log('Checking exam ownership:', {
//         examId: id,
//         userId: userId
//       });

//       const examCheck = await client.query(
//         'SELECT * FROM DETHI WHERE iddethi = $1 AND iduser = $2',
//         [id, userId]
//       );

//       console.log('Exam check result:', examCheck.rows);

//       if (examCheck.rows.length === 0) {
//         throw new Error('Không tìm thấy đề thi hoặc bạn không có quyền cập nhật');
//       }

//       console.log('Updating exam with data:', {
//         tende,
//         idmucdich,
//         id
//       });

//       const result = await client.query(
//         'UPDATE DETHI SET tende = $1, idmucdich = $2 WHERE iddethi = $3 RETURNING *',
//         [tende, idmucdich, id]
//       );

//       console.log('Update result:', result.rows[0]);

//       await client.query('COMMIT');

//       res.json({
//         success: true,
//         message: 'Cập nhật đề thi thành công',
//         data: result.rows[0]
//       });
//     } catch (error) {
//       console.error('Update error:', error);
//       await client.query('ROLLBACK');
//       res.status(500).json({
//         success: false,
//         message: error.message || 'Không thể cập nhật đề thi'
//       });
//     } finally {
//       client.release();
//     }
//   }

//   static async assignExam(req, res) {
//     const client = await pool.connect();
//     try {
//       const { id } = req.params; // exam id
//       const { duration, startDate, endDate, classes } = req.body;

//       console.log('Received assignment request:', {
//         examId: id,
//         duration,
//         startDate,
//         endDate,
//         classes
//       });

//       // Start transaction
//       await client.query('BEGIN');

//       // Check if exam exists
//       const examCheck = await client.query(
//         'SELECT * FROM DETHI WHERE iddethi = $1',
//         [id]
//       );

//       console.log('Exam check result:', examCheck.rows);

//       if (examCheck.rows.length === 0) {
//         throw new Error('Không tìm thấy đề thi');
//       }

//       // Delete existing assignments for this exam (if any)
//       await client.query(
//         'DELETE FROM KIEMTRA WHERE iddethi = $1',
//         [id]
//       );

//       console.log('Inserting assignments for classes:', classes);

//       // Insert into KIEMTRA for each class
//       for (const classId of classes) {
//         try {
//           const insertResult = await client.query(
//             `INSERT INTO KIEMTRA (
//               iddethi,
//               idlop,
//               iduser,
//               thoigian,
//               tgbatdau,
//               tgketthuc
//             ) VALUES ($1, $2, $3, $4, $5, $6)
//             RETURNING *`,
//             [
//               id,
//               classId,
//               req.user.id, // Using the authenticated user's ID
//               duration,
//               new Date(startDate).toISOString(),
//               new Date(endDate).toISOString()
//             ]
//           );

//           console.log(`Inserted assignment for class ${classId}:`, insertResult.rows[0]);

//         } catch (insertError) {
//           console.error(`Error inserting assignment for class ${classId}:`, insertError);
//           throw insertError;
//         }
//       }

//       await client.query('COMMIT');

//       console.log('Assignment completed successfully');

//       res.json({
//         success: true,
//         message: 'Giao đề thi thành công',
//         data: {
//           iddethi: id,
//           classes: classes,
//           duration: duration,
//           startDate: startDate,
//           endDate: endDate
//         }
//       });

//     } catch (error) {
//       await client.query('ROLLBACK');
//       console.error('Error in assignExam:', error);
      
//       let statusCode = 500;
//       let message = 'Lỗi khi giao đề thi';

//       if (error.message === 'Không tìm thấy đề thi') {
//         statusCode = 404;
//         message = error.message;
//       } else if (error.code === '23505') { // Unique violation
//         statusCode = 400;
//         message = 'Đề thi đã được giao cho lớp này';
//       } else if (error.code === '23503') { // Foreign key violation
//         statusCode = 400;
//         message = 'Lớp học không tồn tại';
//       }

//       res.status(statusCode).json({
//         success: false,
//         message: message,
//         error: {
//           code: error.code,
//           detail: error.detail,
//           message: error.message
//         }
//       });
//     } finally {
//       client.release();
//     }
//   }

//   static async getExamInfo(req, res) {
//     const client = await pool.connect();
//     try {
//       const { id } = req.params;
//       const userId = req.user.id;

//       // Kiểm tra đề thi và mục đích
//       const query = `
//         SELECT 
//           d.iddethi,
//           d.tende,
//           d.tongsocau as socau,
//           d.idmucdich,
//           k.thoigian,
//           k.tgbatdau as thoigianbatdau,
//           k.tgketthuc as thoigianketthuc,
//           (
//             SELECT COUNT(*) 
//             FROM KIEMTRA kt 
//             WHERE kt.iddethi = d.iddethi 
//             AND kt.iduser = $2 
//             AND kt.idketqua IS NOT NULL
//           ) as so_lan_lam
//         FROM DETHI d
//         JOIN KIEMTRA k ON d.iddethi = k.iddethi
//         WHERE d.iddethi = $1
//       `;

//       const result = await client.query(query, [id, userId]);

//       if (result.rows.length === 0) {
//         return res.status(404).json({
//           success: false,
//           message: 'Không tìm thấy thông tin đề thi'
//         });
//       }

//       res.json({
//         success: true,
//         data: result.rows[0]
//       });
//     } catch (error) {
//       console.error('Error in getExamInfo:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Lỗi khi lấy thông tin đề thi',
//         error: error.message
//       });
//     } finally {
//       client.release();
//     }
//   }

//   static async getExamForStudent(req, res) {
//     const client = await pool.connect();
//     try {
//       const { id } = req.params;
//       const userId = req.user.id;

//       // Lấy thông tin học sinh
//       const studentQuery = `
//         SELECT hoten
//         FROM "USER"
//         WHERE iduser = $1
//       `;
//       const studentResult = await client.query(studentQuery, [userId]);

//       // Sửa lại query để lấy thêm thông tin mức độ
//       const examQuery = `
//         SELECT 
//           d.iddethi,
//           d.tende,
//           d.ghichu,
//           k.thoigian,
//           json_agg(
//             json_build_object(
//               'idcauhoi', ch.idcauhoi,
//               'noidung', ch.noidung,
//               'dap_an_a', ch.dap_an_a,
//               'dap_an_b', ch.dap_an_b,
//               'dap_an_c', ch.dap_an_c,
//               'dap_an_d', ch.dap_an_d,
//               'mucdo', cdm.idmucdo,
//               'diem', ch.diem
//             ) ORDER BY ch.idcauhoi
//           ) as questions
//         FROM DETHI d
//         JOIN KIEMTRA k ON d.iddethi = k.iddethi
//         JOIN CAUHOI ch ON d.iddethi = ch.iddethi
//         LEFT JOIN CH_DA_MD cdm ON ch.idcauhoi = cdm.idcauhoi
//         WHERE d.iddethi = $1
//         GROUP BY d.iddethi, k.thoigian
//       `;
      
//       const examResult = await client.query(examQuery, [id]);

//       if (examResult.rows.length === 0) {
//         return res.status(404).json({
//           success: false,
//           message: 'Không tìm thấy bài thi'
//         });
//       }

//       res.json({
//         success: true,
//         data: {
//           ...examResult.rows[0],
//           studentInfo: studentResult.rows[0]
//         }
//       });

//     } catch (error) {
//       console.error('Error in getExamForStudent:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Lỗi khi lấy thông tin bài thi',
//         error: error.message
//       });
//     } finally {
//       client.release();
//     }
//   }

//   static async parseExamFile(req, res) {
//     try {
//       if (!req.file) {
//         return res.status(400).json({
//           success: false,
//           message: 'Không tìm thấy file'
//         });
//       }

//       const buffer = req.file.buffer;
//       const data = await pdfParse(buffer);
//       const content = data.text;

//       const questions = [];
//       // Tách các dòng và loại bỏ dòng trống, đồng thời chuẩn hóa khoảng trắng
//       const lines = content.split('\n')
//         .map(line => line.trim())
//         .filter(line => line.length > 0);
      
//       let currentQuestion = null;
//       let currentOptions = [];
//       let questionContent = [];
//       let questionLevel = 'THONG_HIEU';
//       let extractedAnswer = null;
//       let correctAnswer = null;
//       let isReadingQuestion = false;

//       for (let i = 0; i < lines.length; i++) {
//         const line = lines[i].trim();
//         const nextLine = i < lines.length - 1 ? lines[i + 1].trim() : '';
        
//         // Cải thiện regex để nhận dạng câu hỏi chính xác hơn
//         const questionMatch = line.match(/^Câu\s*(\d+)\s*:?\s*(.*)/i);
//         const nextQuestionMatch = nextLine.match(/^Câu\s*(\d+)\s*:?\s*(.*)/i);

//         if (questionMatch) {
//           // Xử lý câu hỏi trước đó nếu có
//           if (currentQuestion && currentOptions.length > 0) {
//             const cleanContent = questionContent.join(' ')
//               .replace(/^Câu\s+\d+:\s*/i, '')
//               .replace(/\s*\((VDC|TH|NB|VD)\)/gi, '')
//               .trim();

//             if (correctAnswer) {
//               currentOptions = currentOptions.map(opt => ({
//                 ...opt,
//                 isCorrect: opt.letter === correctAnswer
//               }));
//             }

//             questions.push({
//               content: cleanContent,
//               level: questionLevel,
//               points: 0,
//               options: currentOptions
//             });
//           }

//           // Khởi tạo câu hỏi mới
//           currentQuestion = questionMatch[2];
//           questionContent = [currentQuestion];
//           currentOptions = [];
//           correctAnswer = null;
//           isReadingQuestion = true;
          
//           // Xác định mức độ
//           const levelMatch = line.match(/\((VDC|TH|NB|VD)\)/i);
//           if (levelMatch) {
//             const level = levelMatch[1].toUpperCase();
//             switch (level) {
//               case 'VDC': questionLevel = 'VAN_DUNG_CAO'; break;
//               case 'VD': questionLevel = 'VAN_DUNG'; break;
//               case 'NB': questionLevel = 'NHAN_BIET'; break;
//               case 'TH': questionLevel = 'THONG_HIEU'; break;
//             }
//           }

//           continue;
//         }

//         // Cải thiện nhận dạng đáp án
//         const optionMatch = line.match(/^([A-D])[\.|\)](.+)/i);
//         if (optionMatch) {
//           isReadingQuestion = false;
//           currentOptions.push({
//             letter: optionMatch[1].toUpperCase(),
//             text: optionMatch[2].trim(),
//             isCorrect: false
//           });
//           continue;
//         }

//         // Nhận dạng đáp án đúng
//         const answerPatterns = [
//           /^Đáp\s*án\s*:\s*([A-D])/i,
//           /^([A-D])\s*\(?đáp\s*án\s*đúng\)?/i,
//           /^Chọn\s*([A-D])/i,
//           /^([A-D])\s*là\s*đúng/i
//         ];

//         let isAnswer = false;
//         for (const pattern of answerPatterns) {
//           const match = line.match(pattern);
//           if (match) {
//             correctAnswer = match[1].toUpperCase();
//             isAnswer = true;
//             break;
//           }
//         }

//         if (!isAnswer && isReadingQuestion && !nextQuestionMatch) {
//           // Thêm vào nội dung câu hỏi nếu không phải là đáp án và đang đọc câu hỏi
//           questionContent.push(line);
//         }
//       }

//       // Xử lý câu hỏi cuối cùng
//       if (currentQuestion && currentOptions.length > 0) {
//         const cleanContent = questionContent.join(' ')
//           .replace(/^Câu\s+\d+:\s*/i, '')
//           .replace(/\s*\((VDC|TH|NB|VD)\)/gi, '')
//           .trim();

//         if (correctAnswer) {
//           currentOptions = currentOptions.map(opt => ({
//             ...opt,
//             isCorrect: opt.letter === correctAnswer
//           }));
//         }

//         questions.push({
//           content: cleanContent,
//           level: questionLevel,
//           points: 0,
//           options: currentOptions
//         });
//       }

//       const parsedData = {
//         title: 'Đề thi mới',
//         questions: questions
//       };

//       res.json({
//         success: true,
//         data: parsedData
//       });

//     } catch (error) {
//       console.error('Error parsing exam file:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Lỗi khi xử lý file đề thi',
//         error: error.message
//       });
//     }
//   }

//   static async getExamsByClass(req, res) {
//     const client = await pool.connect();
//     try {
//       const { classId } = req.params;
//       const userId = req.user.id;

//       const query = `
//         SELECT DISTINCT ON (d.iddethi)
//           d.iddethi,
//           d.tende,
//           k.thoigian,
//           k.tgbatdau,
//           k.tgketthuc,
//           CASE 
//             WHEN EXISTS (
//               SELECT 1 
//               FROM KETQUA kq
//               JOIN KIEMTRA kt ON kt.idketqua = kq.idketqua
//               WHERE kt.iduser = $1 
//               AND kt.iddethi = d.iddethi
//             ) THEN 'completed'
//             ELSE 'pending'
//           END as trangthai,
//           COALESCE(
//             (
//               SELECT kq.tongdiem 
//               FROM KETQUA kq
//               JOIN KIEMTRA kt ON kt.idketqua = kq.idketqua
//               WHERE kt.iduser = $1 
//               AND kt.iddethi = d.iddethi
//               LIMIT 1
//             ), 
//             NULL
//           ) as diem
//         FROM DETHI d
//         JOIN KIEMTRA k ON d.iddethi = k.iddethi
//         WHERE k.idlop = $2
//         ORDER BY d.iddethi, k.tgbatdau DESC
//       `;

//       const result = await client.query(query, [userId, classId]);

//       res.json({
//         success: true,
//         data: result.rows
//       });
//     } catch (error) {
//       console.error('Error in getExamsByClass:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Lỗi khi lấy danh sách đề thi',
//         error: error.message
//       });
//     } finally {
//       client.release();
//     }
//   }

//   static async getExamTemplate(req, res) {
//     try {
//       const doc = new PDFDocument({
//         size: 'A4',
//         margins: {
//           top: 50,
//           bottom: 50,
//           left: 72,
//           right: 72
//         },
//         bufferPages: true,
//         autoFirstPage: true,
//         info: {
//           Title: 'Đề Thi Mẫu',
//           Author: 'Hệ Thống Thi Trực Tuyến'
//         }
//       });

//       // Register font
//       doc.registerFont('CustomFont', path.join(__dirname, '../../fonts/Roboto-Regular.ttf'));
      
//       res.setHeader('Content-Type', 'application/pdf');
//       res.setHeader('Content-Disposition', 'attachment; filename=de_thi_mau.pdf');

//       doc.pipe(res);
//       doc.font('CustomFont');

//       // Nội dung mẫu với định dạng mới
//       const questions = [
//         {
//           number: 1,
//           level: 'NB',
//           content: 'Trong các số sau, số nào là số nguyên tố?',
//           options: ['4', '7', '9', '10'],
//           answer: 'Đáp án: B'
//         },
//         {
//           number: 2,
//           level: 'TH', 
//           content: 'Tính tổng: 2 + 2 = ?',
//           options: ['3', '4', '5', '6'],
//           answer: 'B (đáp án đúng)'
//         },
//         {
//           number: 3,
//           level: 'VD',
//           content: 'Giải phương trình: x + 5 = 10',
//           options: ['x = 15', 'x = 2', 'x = 5', 'x = -5'],
//           answer: 'C là đúng'
//         },
//         {
//           number: 4,
//           level: 'VDC',
//           content: 'Một người đi xe đạp với vận tốc 15 km/h trong 2 giờ. Quãng đường đi được là:',
//           options: ['15 km', '20 km', '30 km', '45 km'],
//           answer: 'Chọn C'
//         }
//       ];

//       // Tiêu đề
//       doc.fontSize(16)
//          .text('ĐỀ THI MẪU', {
//            align: 'center',
//            underline: true
//          })
//          .moveDown(2);

//       // Phần hướng dẫn
//       doc.fontSize(12)
//          .text('HƯỚNG DẪN ĐỊNH DẠNG:', {
//            underline: true
//          })
//          .moveDown();

//       // Giải thích định dạng câu hỏi
//       doc.fontSize(11)
//          .text('Mỗi câu hỏi được định dạng theo cấu trúc:')
//          .text('Câu n: (mức độ) nội dung câu hỏi', { indent: 30 })
//          .moveDown();

//       // Giải thích mức độ
//       doc.text('Trong đó mức độ bao gồm:')
//          .text('- NB: Nhận biết', { indent: 30 })
//          .text('- TH: Thông hiểu', { indent: 30 })
//          .text('- VD: Vận dụng', { indent: 30 })
//          .text('- VDC: Vận dụng cao', { indent: 30 })
//          .moveDown(2);

//       // Thêm các câu hỏi mẫu với định dạng mới
//       questions.forEach((q) => {
//         // Định dạng câu hỏi theo yêu cầu: "Câu n: (mức độ) nội dung câu hỏi"
//         doc.fontSize(12)
//            .text(`Câu ${q.number}: (${q.level}) ${q.content}`)
//            .moveDown();

//         // Các lựa chọn
//         const optionIndent = 30;
//         q.options.forEach((opt, i) => {
//           doc.fontSize(11)
//              .text(`${String.fromCharCode(65 + i)}. ${opt}`, {
//                indent: optionIndent
//              });
//         });

//         // Đáp án
//         doc.moveDown(0.5)
//            .fontSize(11)
//            .text(q.answer, {
//              indent: optionIndent
//            })
//            .moveDown(1.5);
//       });

//       doc.end();

//     } catch (error) {
//       console.error('Error creating template:', error);
//       if (!res.headersSent) {
//         res.status(500).json({
//           success: false,
//           message: 'Lỗi khi tạo file mẫu',
//           error: error.message
//         });
//       }
//     }
//   }

//   static async getSubjects(req, res) {
//     const client = await pool.connect();
//     try {
//       const result = await client.query('SELECT * FROM MONHOC ORDER BY tenmonhoc');
//       res.json({
//         success: true,
//         data: result.rows
//       });
//     } catch (error) {
//       console.error('Error getting subjects:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Lỗi khi lấy danh sách môn học'
//       });
//     } finally {
//       client.release();
//     }
//   }

//   static async initializeSubjects(req, res) {
//     const client = await pool.connect();
//     try {
//       await client.query('BEGIN');

//       // Default subjects
//       const defaultSubjects = [
//         { id: 'TOAN', name: 'Toán Học' },
//         { id: 'VLY', name: 'Vật Lý' },
//         { id: 'HOA', name: 'Hóa Học' },
//         { id: 'SINH', name: 'Sinh Học' },
//         { id: 'MT', name: 'Mỹ Thuật' },
//         { id: 'TIN', name: 'Tin Học' },
//         { id: 'VAN', name: 'Ngữ Văn' },
//         { id: 'NN1', name: 'Ngoại Ngữ 1' },
//         { id: 'NN2', name: 'Ngoại Ngữ 2' },
//         { id: 'SU', name: 'Lịch Sử' },
//         { id: 'DIA', name: 'Địa Lý' },
//         { id: 'CN', name: 'Công Nghệ' },
//         { id: 'GDTC', name: 'Giáo Dục Thể Chất' },
//         { id: 'AN', name: 'Âm Nhạc' },
//         { id: 'GDQPAN', name: 'Giáo Dục Quốc Phòng An Ninh' },
//         { id: 'GDKTPL', name: 'Giáo Dục Kinh Tế và Pháp Luật' },
//         { id: 'TDTTS', name: 'Tiếng Dân Tộc Thiểu Số' }
//       ];

//       for (const subject of defaultSubjects) {
//         await client.query(
//           `INSERT INTO MONHOC (idmonhoc, tenmonhoc)
//            VALUES ($1, $2)
//            ON CONFLICT (idmonhoc) DO UPDATE
//            SET tenmonhoc = EXCLUDED.tenmonhoc`,
//           [subject.id, subject.name]
//         );
//       }

//       await client.query('COMMIT');

//       res.json({
//         success: true,
//         message: 'Khởi tạo dữ liệu môn học thành công',
//         data: defaultSubjects
//       });
//     } catch (error) {
//       await client.query('ROLLBACK');
//       console.error('Error initializing subjects:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Lỗi khi khởi tạo dữ liệu môn học',
//         error: error.message
//       });
//     } finally {
//       client.release();
//     }
//   }
// }

// module.exports = ExamController;