const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class ClassDetail {
  constructor(data) {
    this.idlop = data.idlop;
    this.tenlop = data.tenlop;
    this.namhoc = data.namhoc;
    this.siso = data.siso || 0;
  }

  static async findById(id) {
    const query = `
      SELECT l.*, COUNT(DISTINCT h.iduser) as total_students
      FROM LOPHOC l
      LEFT JOIN HOATDONG h ON l.idlop = h.idlop
      WHERE l.idlop = $1
      GROUP BY l.idlop, l.tenlop, l.namhoc, l.siso
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  static async createStudent(data) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const studentId = uuidv4();
      const userQuery = `
        INSERT INTO "USER" (iduser, hoten, email, vaitro)
        VALUES ($1, $2, $3, 'STUDENT')
        RETURNING *
      `;
      const userResult = await client.query(userQuery, [
        studentId,
        data.hoten,
        data.email
      ]);

      await client.query('COMMIT');
      return userResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async getStudents(classId) {
    const query = `
      SELECT 
        u.iduser,
        u.hoten,
        u.email,
        h.sbd as sobaodanh,
        COUNT(k.idketqua) as completed_exams,
        (SELECT COUNT(*) FROM DETHI d 
         JOIN KIEMTRA kt ON d.iddethi = kt.iddethi 
         WHERE kt.idlop = $1) as total_exams
      FROM "USER" u
      JOIN HOATDONG h ON u.iduser = h.iduser
      LEFT JOIN KIEMTRA k ON k.iduser = u.iduser AND k.idlop = h.idlop
      WHERE h.idlop = $1 AND u.vaitro = 'STUDENT'
      GROUP BY u.iduser, u.hoten, u.email, h.sbd
      ORDER BY COALESCE(h.sbd, ''), u.hoten
    `;
    const result = await pool.query(query, [classId]);
    return result.rows;
  }

  static async addStudentToClass(classId, userId, studentId = null) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const hoatdongQuery = `
        INSERT INTO HOATDONG (iduser, idlop, sbd)
        VALUES ($1, $2, $3)
        RETURNING *
      `;
      const result = await client.query(hoatdongQuery, [userId, classId, studentId]);
      
      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = ClassDetail; 