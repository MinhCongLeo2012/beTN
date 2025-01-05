const pool = require('../config/database');
const ClassDetail = require('../models/ClassDetail');
const ExcelJS = require('exceljs');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');

const ClassDetailController = {
  // Lấy thông tin chi tiết lớp học
  getClassDetails: async (req, res) => {
    const client = await pool.connect();
    try {
      const { id } = req.params;
      
      const query = `
        SELECT l.*, u.hoten as teacher_name,
        (SELECT COUNT(*) FROM HOATDONG WHERE idlop = l.idlop) as student_count
        FROM LOPHOC l
        JOIN HOATDONG h ON l.idlop = h.idlop
        JOIN "USER" u ON h.iduser = u.iduser
        WHERE l.idlop = $1 AND u.vaitro = 'TEACHER'
      `;
      
      const result = await client.query(query, [id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy thông tin lớp học'
        });
      }

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy thông tin lớp học',
        error: error.message
      });
    } finally {
      client.release();
    }
  },

  // Lấy danh sách học sinh trong lớp
  getStudents: async (req, res) => {
    const client = await pool.connect();
    try {
      const { id: classId } = req.params;
      console.log('Fetching students for class ID:', classId);

      const query = `
        SELECT DISTINCT
          u.iduser,
          u.hoten,
          u.email,
          h.sbd as sobaodanh,
          (
            SELECT COUNT(DISTINCT k2.iddethi)
            FROM KIEMTRA k2
            WHERE k2.iduser = u.iduser 
            AND k2.idlop = $1
          ) as completed_exams,
          (
            SELECT COUNT(DISTINCT k3.iddethi)
            FROM KIEMTRA k3
            WHERE k3.idlop = $1
          ) as total_exams
        FROM "USER" u
        JOIN HOATDONG h ON u.iduser = h.iduser 
        WHERE h.idlop = $1 
          AND u.vaitro = 'STUDENT'
        ORDER BY h.sbd NULLS LAST, u.hoten
      `;
      
      console.log('Executing query:', query);
      console.log('With parameters:', [classId]);
      
      const result = await client.query(query, [classId]);
      
      console.log('Query result:', result.rows);
      
      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      console.error('Detailed error:', {
        message: error.message,
        stack: error.stack,
        query: error.query,
        parameters: error.parameters
      });
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy danh sách học sinh',
        error: error.message
      });
    } finally {
      client.release();
    }
  },

  // Thêm học sinh vào lớp
  addStudent: async (req, res) => {
    const client = await pool.connect();
    try {
      const { id: classId } = req.params;
      const { email, studentId } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email học sinh là bắt buộc'
        });
      }

      await client.query('BEGIN');

      // Kiểm tra học sinh có tồn tại
      const findUserQuery = `
        SELECT iduser, hoten, email 
        FROM "USER" 
        WHERE email = $1 AND vaitro = 'STUDENT'
      `;
      const userResult = await client.query(findUserQuery, [email]);

      if (userResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy học sinh với email này'
        });
      }

      const student = userResult.rows[0];

      // Kiểm tra học sinh đã trong lớp chưa
      const checkExistQuery = `
        SELECT * FROM HOATDONG 
        WHERE idlop = $1 AND iduser = $2
      `;
      const existResult = await client.query(checkExistQuery, [classId, student.iduser]);

      if (existResult.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'Học sinh này đã có trong lớp'
        });
      }

      // Kiểm tra số báo danh đã tồn tại trong lớp chưa
      if (studentId) {
        const checkSBDQuery = `
          SELECT * FROM HOATDONG 
          WHERE idlop = $1 AND sbd = $2
        `;
        const sbdResult = await client.query(checkSBDQuery, [classId, studentId]);

        if (sbdResult.rows.length > 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            message: 'Số báo danh này đã được sử dụng trong lớp'
          });
        }
      }

      // Thêm học sinh vào lớp
      const insertQuery = `
        INSERT INTO HOATDONG (idlop, iduser, sbd)
        VALUES ($1, $2, $3)
        RETURNING *
      `;
      const insertResult = await client.query(insertQuery, [
        classId, 
        student.iduser, 
        studentId || null
      ]);

      // Cập nhật sĩ số
      const updateSiSoQuery = `
        UPDATE LOPHOC 
        SET siso = (
          SELECT COUNT(*) 
          FROM HOATDONG 
          WHERE idlop = $1 AND iduser IN (
            SELECT iduser 
            FROM "USER" 
            WHERE vaitro = 'STUDENT'
          )
        )
        WHERE idlop = $1
        RETURNING siso
      `;
      
      const sisoResult = await client.query(updateSiSoQuery, [classId]);

      await client.query('COMMIT');

      res.status(201).json({
        success: true,
        message: 'Thêm học sinh vào lớp thành công',
        data: {
          iduser: student.iduser,
          hoten: student.hoten,
          email: student.email,
          sbd: insertResult.rows[0].sbd
        },
        siso: sisoResult.rows[0].siso
      });

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error in addStudent:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi thêm học sinh vào lớp',
        error: error.message
      });
    } finally {
      client.release();
    }
  },

  // Cập nhật thông tin học sinh
  updateStudent: async (req, res) => {
    const client = await pool.connect();
    try {
      const { id: classId, studentId } = req.params;
      const { email, studentId: sbd } = req.body;

      await client.query('BEGIN');

      // Cập nhật số báo danh trong HOATDONG
      const updateHoatDongQuery = `
        UPDATE HOATDONG 
        SET sbd = $1
        WHERE idlop = $2 AND iduser = $3
        RETURNING *
      `;
      
      const result = await client.query(updateHoatDongQuery, [sbd, classId, studentId]);
      
      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy học sinh trong lớp'
        });
      }

      await client.query('COMMIT');
      res.json({
        success: true,
        message: 'Cập nhật thông tin học sinh thành công',
        data: result.rows[0]
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error in updateStudent:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi cập nhật thông tin học sinh',
        error: error.message
      });
    } finally {
      client.release();
    }
  },

  // Xóa một học sinh
  deleteStudent: async (req, res) => {
    const client = await pool.connect();
    try {
      const { id: classId, studentId } = req.params;

      // Kiểm tra nếu là route xóa nhiều
      if (studentId === 'bulk') {
        return this.deleteMultipleStudents(req, res);
      }

      await client.query('BEGIN');

      // Xóa học sinh từ HOATDONG
      const deleteQuery = `
        DELETE FROM HOATDONG 
        WHERE idlop = $1 AND iduser = $2
        RETURNING *
      `;
      const result = await client.query(deleteQuery, [classId, studentId]);

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy học sinh trong lớp'
        });
      }

      // Cập nhật sĩ số
      const updateSiSoQuery = `
        UPDATE LOPHOC 
        SET siso = (
          SELECT COUNT(*) 
          FROM HOATDONG 
          WHERE idlop = $1 AND iduser IN (
            SELECT iduser 
            FROM "USER" 
            WHERE vaitro = 'STUDENT'
          )
        )
        WHERE idlop = $1
        RETURNING siso
      `;
      
      const sisoResult = await client.query(updateSiSoQuery, [classId]);

      await client.query('COMMIT');

      res.json({
        success: true,
        message: 'Xóa học sinh thành công',
        data: result.rows[0],
        siso: sisoResult.rows[0].siso
      });

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error in deleteStudent:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi xóa học sinh',
        error: error.message
      });
    } finally {
      client.release();
    }
  },

  // Thêm phương thức xóa nhiều học sinh
  deleteMultipleStudents: async (req, res) => {
    const client = await pool.connect();
    try {
      const { id: classId } = req.params;
      const { studentIds } = req.body;

      if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Danh sách học sinh cần xóa không hợp lệ'
        });
      }

      await client.query('BEGIN');

      // Xóa nhiều học sinh từ HOATDONG
      const deleteQuery = `
        DELETE FROM HOATDONG 
        WHERE idlop = $1 AND iduser = ANY($2::uuid[])
        RETURNING *
      `;
      
      const result = await client.query(deleteQuery, [classId, studentIds]);

      // Cập nhật sĩ số
      const updateSiSoQuery = `
        UPDATE LOPHOC 
        SET siso = (
          SELECT COUNT(*) 
          FROM HOATDONG 
          WHERE idlop = $1 AND iduser IN (
            SELECT iduser 
            FROM "USER" 
            WHERE vaitro = 'STUDENT'
          )
        )
        WHERE idlop = $1
        RETURNING siso
      `;
      
      const sisoResult = await client.query(updateSiSoQuery, [classId]);

      await client.query('COMMIT');

      res.json({
        success: true,
        message: `Đã xóa ${result.rowCount} học sinh khỏi lớp`,
        deletedCount: result.rowCount,
        siso: sisoResult.rows[0].siso
      });

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error in deleteMultipleStudents:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi xóa học sinh',
        error: error.message
      });
    } finally {
      client.release();
    }
  },

  // Thêm phương thức mới
  getClassExams: async (req, res) => {
    const client = await pool.connect();
    try {
      const { id: classId } = req.params;
      
      const query = `
        SELECT 
          d.iddethi,
          d.tende,
          d.ngaytao,
          (
            SELECT COUNT(DISTINCT k2.iduser)
            FROM KIEMTRA k2
            JOIN KETQUA kq ON k2.idketqua = kq.idketqua
            WHERE k2.iddethi = d.iddethi 
            AND k2.idlop = $1
          ) as total_submissions,
          (
            SELECT COUNT(DISTINCT h.iduser)
            FROM HOATDONG h
            JOIN "USER" u ON h.iduser = u.iduser
            WHERE h.idlop = $1
            AND u.vaitro = 'STUDENT'
          ) as total_students
        FROM DETHI d
        WHERE d.iddethi IN (
          SELECT DISTINCT iddethi 
          FROM KIEMTRA 
          WHERE idlop = $1
        )
        ORDER BY d.ngaytao DESC
      `;
      
      const result = await client.query(query, [classId]);
      
      // Format kết quả
      const formattedResults = result.rows.map(row => ({
        ...row,
        luot_lam: row.total_submissions || 0,
        tong_hoc_sinh: row.total_students || 0,
        completion_rate: `${row.total_submissions || 0}/${row.total_students || 0}`
      }));

      res.json({
        success: true,
        data: formattedResults
      });
    } catch (error) {
      console.error('Error getting class exams:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy danh sách đề thi',
        error: error.message
      });
    } finally {
      client.release();
    }
  },

  exportStudentList: async (req, res) => {
    const client = await pool.connect();
    try {
      const { id: classId } = req.params;
      
      // Lấy thông tin lớp học
      const classQuery = `
        SELECT l.*, u.hoten as teacher_name
        FROM LOPHOC l
        JOIN HOATDONG h ON l.idlop = h.idlop
        JOIN "USER" u ON h.iduser = u.iduser
        WHERE l.idlop = $1 AND u.vaitro = 'TEACHER'
        LIMIT 1
      `;
      const classInfo = await client.query(classQuery, [classId]);

      if (classInfo.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy thông tin lớp học'
        });
      }

      // Sửa lại query lấy danh sách học sinh
      const studentQuery = `
        SELECT 
          u.hoten,
          u.email,
          h.sbd as sobaodanh,
          COALESCE(COUNT(DISTINCT k.idketqua), 0) as completed_exams,
          COALESCE((
            SELECT COUNT(DISTINCT d.iddethi) 
            FROM DETHI d 
            JOIN KIEMTRA kt ON d.iddethi = kt.iddethi 
            WHERE kt.idlop = $1
          ), 0) as total_exams
        FROM "USER" u
        JOIN HOATDONG h ON u.iduser = h.iduser
        LEFT JOIN KIEMTRA k ON k.iduser = u.iduser AND k.idlop = h.idlop
        WHERE h.idlop = $1 AND u.vaitro = 'STUDENT'
        GROUP BY u.hoten, u.email, h.sbd
        ORDER BY 
          CASE WHEN h.sbd IS NULL THEN 1 ELSE 0 END,
          h.sbd NULLS LAST,
          u.hoten
      `;
      
      const students = await client.query(studentQuery, [classId]);

      // Tạo workbook mới
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Danh sách học sinh');

      // Thiết lập header và style
      worksheet.columns = [
        { header: 'STT', key: 'stt', width: 5 },
        { header: 'Họ và tên', key: 'hoten', width: 30 },
        { header: 'Email', key: 'email', width: 35 },
        { header: 'Số báo danh', key: 'sobaodanh', width: 15 },
        { header: 'Số bài đã làm', key: 'completed', width: 15 }
      ];

      // Style cho header
      worksheet.getRow(1).font = { bold: true, size: 14 };
      worksheet.getRow(2).font = { bold: true, size: 12 };
      worksheet.getRow(3).font = { bold: true, size: 12 };
      worksheet.getRow(5).font = { bold: true };

      // Thêm thông tin lớp học
      worksheet.mergeCells('A1:E1');
      worksheet.getCell('A1').value = `LỚP: ${classInfo.rows[0].tenlop.toUpperCase()}`;
      worksheet.getCell('A1').alignment = { horizontal: 'center' };

      worksheet.mergeCells('A2:E2');
      worksheet.getCell('A2').value = `Năm học: ${classInfo.rows[0].namhoc}`;
      worksheet.getCell('A2').alignment = { horizontal: 'center' };

      worksheet.mergeCells('A3:E3');
      worksheet.getCell('A3').value = `Giáo viên: ${classInfo.rows[0].teacher_name}`;
      worksheet.getCell('A3').alignment = { horizontal: 'center' };

      // Thêm dòng trống
      worksheet.addRow([]);

      // Thêm header cho bảng dữ liệu
      const headerRow = worksheet.addRow([
        'STT',
        'Họ và tên',
        'Email',
        'Số báo danh',
        'Số bài đã làm'
      ]);
      headerRow.eachCell((cell) => {
        cell.font = { bold: true };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' }
        };
      });

      // Thêm dữ liệu học sinh
      students.rows.forEach((student, index) => {
        const row = worksheet.addRow({
          stt: index + 1,
          hoten: student.hoten,
          email: student.email,
          sobaodanh: student.sobaodanh || '',
          completed: `${student.completed_exams}/${student.total_exams}`
        });

        // Căn giữa các cột STT, Số báo danh và Số bài đã làm
        row.getCell(1).alignment = { horizontal: 'center' };
        row.getCell(4).alignment = { horizontal: 'center' };
        row.getCell(5).alignment = { horizontal: 'center' };
      });

      // Thêm border cho tất cả các ô có dữ liệu
      worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });
      });

      // Hàm để chuẩn hóa tên file
      const sanitizeFilename = (filename) => {
        return filename
          .toLowerCase()
          .replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, 'a')
          .replace(/[èéẹẻẽêềếệểễ]/g, 'e')
          .replace(/[ìíịỉĩ]/g, 'i')
          .replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, 'o')
          .replace(/[ùúụủũưừứựửữ]/g, 'u')
          .replace(/[ỳýỵỷỹ]/g, 'y')
          .replace(/đ/g, 'd')
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '')
          .replace(/-+/g, '-')
          .trim();
      };

      // Set response headers với tên file đã được chuẩn hóa
      const safeFilename = sanitizeFilename(classInfo.rows[0].tenlop);
      const timestamp = new Date().toISOString().split('T')[0];
      
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=danh-sach-${safeFilename}-${timestamp}.xlsx`
      );

      // Gửi file
      await workbook.xlsx.write(res);
      res.end();

    } catch (error) {
      console.error('Error exporting student list:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi xuất danh sách học sinh',
        error: error.message
      });
    } finally {
      client.release();
    }
  },

  // Thêm method tạo file mẫu
  getImportTemplate: async (req, res) => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Danh sách học sinh');

      // Định dạng cột
      worksheet.columns = [
        { header: 'Họ và tên', key: 'hoten', width: 30 },
        { header: 'Email', key: 'email', width: 35 },
        { header: 'Số báo danh', key: 'sobaodanh', width: 15 }
      ];

      // Style cho header
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      // Thêm dữ liệu mẫu
      worksheet.addRow({
        hoten: 'Nguyễn Văn A',
        email: 'nguyenvana@gmail.com',
        sobaodanh: '001'
      });
      worksheet.addRow({
        hoten: 'Trần Thị B',
        email: 'tranthib@gmail.com',
        sobaodanh: '002'
      });

      // Thêm data validation cho cột email
      worksheet.dataValidations.add('B2:B1000', {
        type: 'custom',
        formulae: ['=AND(ISNUMBER(SEARCH("@gmail.com",B2)),LEN(B2)>10)'],
        showErrorMessage: true,
        errorStyle: 'error',
        errorTitle: 'Email không hợp lệ',
        error: 'Email phải có định dạng @gmail.com'
      });

      // Thêm ghi chú cho header
      const emailCell = worksheet.getCell('B1');
      emailCell.note = 'Email phải có định dạng @gmail.com';

      // Thêm border cho tất cả các ô có dữ liệu
      worksheet.eachRow((row) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });
      });

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        'attachment; filename=mau-danh-sach-hoc-sinh.xlsx'
      );

      await workbook.xlsx.write(res);
      res.end();

    } catch (error) {
      console.error('Error creating template:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi tạo file mẫu',
        error: error.message
      });
    }
  },

  importStudents: async (req, res) => {
    const client = await pool.connect();
    try {
      const { id: classId } = req.params;
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng tải lên file Excel'
        });
      }

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(req.file.buffer);
      const worksheet = workbook.getWorksheet(1);

      // Kiểm tra header
      const headerRow = worksheet.getRow(1);
      const expectedHeaders = ['Họ và tên', 'Email', 'Số báo danh'];
      const actualHeaders = headerRow.values.slice(1);

      if (!expectedHeaders.every((header, index) => header === actualHeaders[index])) {
        return res.status(400).json({
          success: false,
          message: 'File không đúng định dạng. Vui lòng tải file mẫu và thử lại'
        });
      }

      await client.query('BEGIN');

      // Mã hóa mật khẩu mặc định
      const defaultPassword = '123';
      const hashedPassword = await bcrypt.hash(defaultPassword, 10);

      const results = [];
      const errors = [];
      let rowNumber = 1;

      // Đọc từng dòng dữ liệu
      for (let i = 2; i <= worksheet.rowCount; i++) {
        rowNumber = i;
        const row = worksheet.getRow(i);
        const student = {
          hoten: row.getCell(1).value?.toString().trim(),
          email: row.getCell(2).value?.toString().trim(),
          sobaodanh: row.getCell(3).value?.toString().trim()
        };

        // Validate dữ liệu
        if (!student.hoten || !student.email) {
          errors.push(`Dòng ${rowNumber}: Thiếu họ tên hoặc email`);
          continue;
        }

        // Kiểm tra định dạng email
        if (!student.email.endsWith('@gmail.com')) {
          errors.push(`Dòng ${rowNumber}: Email phải có định dạng @gmail.com`);
          continue;
        }

        // Kiểm tra email trùng lặp trong file Excel
        const duplicateInFile = worksheet.getRows(2, i-2)?.some(r => 
          r.getCell(2).value?.toString().trim() === student.email
        );
        if (duplicateInFile) {
          errors.push(`Dòng ${rowNumber}: Email ${student.email} bị trùng lặp trong file`);
          continue;
        }

        try {
          // Kiểm tra email tồn tại trong database
          const existingUser = await client.query(
            'SELECT iduser FROM "USER" WHERE email = $1',
            [student.email]
          );

          let userId;
          if (existingUser.rows.length > 0) {
            userId = existingUser.rows[0].iduser;
            
            // Kiểm tra học sinh đã trong lớp chưa
            const existingInClass = await client.query(
              'SELECT 1 FROM HOATDONG WHERE iduser = $1 AND idlop = $2',
              [userId, classId]
            );

            if (existingInClass.rows.length > 0) {
              errors.push(`Dòng ${rowNumber}: Email ${student.email} đã tồn tại trong lớp`);
              continue;
            }
          } else {
            // Tạo user mới với mật khẩu mặc định đã mã hóa
            const newUser = await client.query(
              `INSERT INTO "USER" (iduser, hoten, email, matkhau, vaitro)
               VALUES ($1, $2, $3, $4, 'STUDENT')
               RETURNING iduser`,
              [uuidv4(), student.hoten, student.email, hashedPassword]
            );
            userId = newUser.rows[0].iduser;
          }

          // Thêm vào HOATDONG
          await client.query(
            'INSERT INTO HOATDONG (iduser, idlop, sbd) VALUES ($1, $2, $3)',
            [userId, classId, student.sobaodanh || null]
          );

          results.push({
            email: student.email,
            status: 'success'
          });
        } catch (error) {
          errors.push(`Dòng ${rowNumber}: ${error.message}`);
        }
      }

      // Cập nhật sĩ số lớp
      await client.query(`
        UPDATE LOPHOC 
        SET siso = (
          SELECT COUNT(*) 
          FROM HOATDONG 
          WHERE idlop = $1 AND iduser IN (
            SELECT iduser 
            FROM "USER" 
            WHERE vaitro = 'STUDENT'
          )
        )
        WHERE idlop = $1
      `, [classId]);

      await client.query('COMMIT');

      res.json({
        success: true,
        message: `Đã thêm ${results.length} học sinh vào lớp`,
        results,
        errors: errors.length > 0 ? errors : undefined
      });

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error importing students:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi import danh sách học sinh',
        error: error.message
      });
    } finally {
      client.release();
    }
  },

  // Thêm method mới để xuất kết quả thi
  exportExamResults: async (req, res) => {
    const client = await pool.connect();
    try {
      const { id: classId } = req.params;
      const { examId } = req.query;
      
      // Lấy thông tin lớp và đề thi
      const headerQuery = `
        SELECT 
          l.tenlop,
          l.namhoc,
          d.tende
        FROM LOPHOC l
        JOIN KIEMTRA k ON l.idlop = k.idlop
        JOIN DETHI d ON k.iddethi = d.iddethi
        WHERE l.idlop = $1 AND d.iddethi = $2
        LIMIT 1
      `;
      const headerInfo = await client.query(headerQuery, [classId, examId]);

      if (headerInfo.rows.length === 0) {
        throw new Error('Không tìm thấy thông tin lớp hoặc đề thi');
      }

      // Query lấy kết quả thi của học sinh
      const resultQuery = `
        SELECT 
          u.hoten,
          u.email,
          h.sbd,
          TO_CHAR(u.ngaysinh, 'DD/MM/YYYY') as ngaysinh,
          CASE 
            WHEN LOWER(u.gioitinh) = 'male' THEN 'Nam'
            WHEN LOWER(u.gioitinh) = 'female' THEN 'Nữ'
            ELSE ''
          END as gioitinh,
          kq.tongdiem
        FROM "USER" u
        JOIN HOATDONG h ON u.iduser = h.iduser
        JOIN KIEMTRA k ON u.iduser = k.iduser AND k.idlop = h.idlop
        LEFT JOIN KETQUA kq ON k.idketqua = kq.idketqua
        WHERE h.idlop = $1 
          AND k.iddethi = $2 
          AND u.vaitro = 'STUDENT'
        ORDER BY COALESCE(h.sbd::text, u.hoten)
      `;
      
      const results = await client.query(resultQuery, [classId, examId]);

      // Tạo workbook mới
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Kết quả thi');

      // Thêm tiêu đề
      worksheet.mergeCells('A1:G1');
      worksheet.getCell('A1').value = `LỚP: ${headerInfo.rows[0].tenlop.toUpperCase()}`;
      worksheet.getCell('A1').font = { bold: true, size: 14 };
      worksheet.getCell('A1').alignment = { horizontal: 'center' };

      worksheet.mergeCells('A2:G2');
      worksheet.getCell('A2').value = `Năm học: ${headerInfo.rows[0].namhoc}`;
      worksheet.getCell('A2').font = { bold: true, size: 12 };
      worksheet.getCell('A2').alignment = { horizontal: 'center' };

      worksheet.mergeCells('A3:G3');
      worksheet.getCell('A3').value = `Đề thi: ${headerInfo.rows[0].tende}`;
      worksheet.getCell('A3').font = { bold: true, size: 12 };
      worksheet.getCell('A3').alignment = { horizontal: 'center' };

      // Thêm dòng trống
      worksheet.addRow([]);

      // Thiết lập header cho bảng dữ liệu
      const headerRow = worksheet.addRow([
        'STT',
        'Họ và tên',
        'Email',
        'Số báo danh',
        'Ngày sinh',
        'Giới tính',
        'Điểm'
      ]);
      headerRow.font = { bold: true };
      headerRow.alignment = { horizontal: 'center' };

      // Thiết lập độ rộng cột
      worksheet.columns = [
        { width: 5 },  // STT
        { width: 30 }, // Họ và tên
        { width: 35 }, // Email
        { width: 15 }, // Số báo danh
        { width: 15 }, // Ngày sinh
        { width: 10 }, // Giới tính
        { width: 10 }  // Điểm
      ];

      // Thêm dữ liệu học sinh
      results.rows.forEach((student, index) => {
        const row = worksheet.addRow([
          index + 1,
          student.hoten,
          student.email,
          student.sbd || '',
          student.ngaysinh || '',
          student.gioitinh || '',
          student.tongdiem || 0
        ]);

        // Căn giữa các cột cần thiết
        row.getCell(1).alignment = { horizontal: 'center' }; // STT
        row.getCell(4).alignment = { horizontal: 'center' }; // SBD
        row.getCell(5).alignment = { horizontal: 'center' }; // Ngày sinh
        row.getCell(6).alignment = { horizontal: 'center' }; // Giới tính
        row.getCell(7).alignment = { horizontal: 'center' }; // Điểm
      });

      // Format cột điểm
      worksheet.getColumn(7).numFmt = '#,##0.00';

      // Thêm border cho tất cả các ô có dữ liệu
      worksheet.eachRow((row) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });
      });

      // Set response headers
      const safeFilename = headerInfo.rows[0].tenlop
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-');
      const timestamp = new Date().toISOString().split('T')[0];
      
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=ket-qua-thi-${safeFilename}-${timestamp}.xlsx`
      );

      // Gửi file
      await workbook.xlsx.write(res);
      res.end();

    } catch (error) {
      console.error('Error exporting exam results:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi xuất kết quả thi',
        error: error.message
      });
    } finally {
      client.release();
    }
  }
};

module.exports = ClassDetailController;