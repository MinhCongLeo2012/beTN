const LopHoc = require('../models/LopHoc');
const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class ClassController {
  static async getAllClasses(req, res) {
    const client = await pool.connect();
    try {
      console.log('Request user:', req.user);
      
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized - Please login again'
        });
      }

      const userId = req.user.iduser || req.user.id;
      console.log('User ID:', userId);
      
      // Kiểm tra user trong database
      const userCheck = await client.query(
        'SELECT iduser FROM "USER" WHERE iduser = $1',
        [userId]
      );

      if (userCheck.rows.length === 0) {
        return res.status(401).json({
          success: false,
          message: 'User not found in database'
        });
      }

      const query = `
        SELECT DISTINCT l.*, u.hoten as teacher_name 
        FROM LOPHOC l
        JOIN HOATDONG h ON l.idlop = h.idlop
        JOIN "USER" u ON h.iduser = u.iduser
        WHERE h.iduser = $1
        ORDER BY l.namhoc DESC, l.tenlop ASC
      `;
      
      console.log('Executing query:', query);
      console.log('With userId:', userId);
      
      const result = await client.query(query, [userId]);
      console.log('Query result:', result.rows);

      return res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      console.error('Error in getAllClasses:', {
        message: error.message,
        stack: error.stack,
        query: error.query,
        parameters: error.parameters
      });
      
      return res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy danh sách lớp học',
        error: error.message
      });
    } finally {
      client.release();
    }
  }

  static async getClassById(req, res) {
    try {
      const { id } = req.params;
      const classDetails = await LopHoc.findById(id);
      
      if (!classDetails) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy lớp học'
        });
      }

      res.json({
        success: true,
        data: classDetails
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy thông tin lớp học',
        error: error.message
      });
    }
  }

  static async createClass(req, res) {
    const client = await pool.connect();
    try {
      console.log('Creating class with data:', req.body);
      console.log('User info:', req.user);
      
      await client.query('BEGIN');
      
      const { tenlop, namhoc } = req.body;
      const userId = req.user.iduser || req.user.id;

      // Tạo lớp học mới
      const lopHoc = new LopHoc({ 
        tenlop, 
        namhoc
      });
      
      const savedClass = await lopHoc.save();
      console.log('Saved class:', savedClass);

      // Thêm bản ghi vào HOATDONG
      try {
        const hoatdongQuery = `
          INSERT INTO HOATDONG (iduser, idlop, sbd) 
          VALUES ($1, $2, NULL)
          RETURNING *
        `;
        const hoatdongResult = await client.query(hoatdongQuery, [userId, savedClass.idlop]);
        console.log('Added HOATDONG record:', hoatdongResult.rows[0]);
      } catch (hoatdongError) {
        // Nếu thêm HOATDONG thất bại, rollback và throw error
        await client.query('ROLLBACK');
        throw new Error(`Lỗi khi thêm hoạt động: ${hoatdongError.message}`);
      }

      await client.query('COMMIT');
      
      // Lấy thông tin đầy đủ của lớp học vừa tạo
      const fullClassInfo = await client.query(`
        SELECT l.*, u.hoten as teacher_name 
        FROM LOPHOC l
        JOIN HOATDONG h ON l.idlop = h.idlop
        JOIN "USER" u ON h.iduser = u.iduser
        WHERE l.idlop = $1
      `, [savedClass.idlop]);

      res.status(201).json({
        success: true,
        message: 'Tạo lớp học thành công',
        data: fullClassInfo.rows[0]
      });
    } catch (error) {
      console.error('Error in createClass:', {
        message: error.message,
        stack: error.stack
      });
      await client.query('ROLLBACK');
      res.status(500).json({
        success: false,
        message: 'Lỗi khi tạo lớp học',
        error: error.message
      });
    } finally {
      client.release();
    }
  }

  static async updateClass(req, res) {
    const client = await pool.connect();
    try {
      const { id } = req.params;
      const { tenlop, namhoc } = req.body;
      const userId = req.user.iduser || req.user.id;

      // Kiểm tra quyền sở hữu lớp học
      const ownershipCheck = await client.query(`
        SELECT 1 FROM HOATDONG 
        WHERE idlop = $1 AND iduser = $2
      `, [id, userId]);

      if (ownershipCheck.rows.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Bạn không có quyền chỉnh sửa lớp học này'
        });
      }

      const lopHoc = new LopHoc({
        idlop: id,
        tenlop,
        namhoc
      });

      const updatedClass = await lopHoc.update();
      
      // Lấy thông tin đầy đủ sau khi update
      const fullClassInfo = await client.query(`
        SELECT l.*, u.hoten as teacher_name 
        FROM LOPHOC l
        JOIN HOATDONG h ON l.idlop = h.idlop
        JOIN "USER" u ON h.iduser = u.iduser
        WHERE l.idlop = $1
      `, [id]);

      res.json({
        success: true,
        message: 'Cập nhật lớp học thành công',
        data: fullClassInfo.rows[0]
      });
    } catch (error) {
      console.error('Error in updateClass:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi cập nhật lớp học',
        error: error.message
      });
    } finally {
      client.release();
    }
  }

  static async deleteClass(req, res) {
    const client = await pool.connect();
    try {
      const { id } = req.params;
      const userId = req.user.iduser || req.user.id;

      // Kiểm tra quyền sở hữu lớp học
      const ownershipCheck = await client.query(`
        SELECT 1 FROM HOATDONG 
        WHERE idlop = $1 AND iduser = $2
      `, [id, userId]);

      if (ownershipCheck.rows.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Bạn không có quyền xóa lớp học này'
        });
      }

      await client.query('BEGIN');

      // Xóa các bản ghi liên quan
      await client.query('DELETE FROM HOATDONG WHERE idlop = $1', [id]);
      await client.query('DELETE FROM KIEMTRA WHERE idlop = $1', [id]);
      
      // Xóa lớp học
      const result = await client.query(
        'DELETE FROM LOPHOC WHERE idlop = $1 RETURNING *',
        [id]
      );

      await client.query('COMMIT');

      res.json({
        success: true,
        message: 'Xóa lớp học thành công',
        data: result.rows[0]
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error in deleteClass:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi xóa lớp học',
        error: error.message
      });
    } finally {
      client.release();
    }
  }

  static async getStudentClasses(req, res) {
    const client = await pool.connect();
    try {
      const studentId = req.params.studentId;

      const query = `
        SELECT l.*, u.hoten as teacher_name
        FROM LOPHOC l
        JOIN HOATDONG h ON l.idlop = h.idlop
        JOIN HOATDONG h2 ON l.idlop = h2.idlop
        JOIN "USER" u ON h2.iduser = u.iduser
        WHERE h.iduser = $1
        AND u.vaitro = 'TEACHER'
      `;

      const result = await client.query(query, [studentId]);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      console.error('Error getting student classes:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy danh sách lớp học',
        error: error.message
      });
    } finally {
      client.release();
    }
  }
}

module.exports = ClassController; 