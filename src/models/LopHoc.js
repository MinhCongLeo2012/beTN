const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class LopHoc {
  constructor(data) {
    this.idlop = data.idlop || uuidv4();
    this.tenlop = data.tenlop;
    this.siso = data.siso || 0;
    this.namhoc = data.namhoc;
  }

  async save() {
    console.log('Saving class with data:', {
      idlop: this.idlop,
      tenlop: this.tenlop,
      siso: this.siso,
      namhoc: this.namhoc
    });

    const query = `
      INSERT INTO LOPHOC (idlop, tenlop, siso, namhoc)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const values = [this.idlop, this.tenlop, this.siso, this.namhoc];
    
    try {
      const result = await pool.query(query, values);
      console.log('Save result:', result.rows[0]);
      return result.rows[0];
    } catch (error) {
      console.error('Error saving class:', {
        error: error.message,
        query: query,
        values: values
      });
      throw error;
    }
  }

  static async findById(id) {
    const query = 'SELECT * FROM LOPHOC WHERE idlop = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  static async findAll() {
    const query = 'SELECT * FROM LOPHOC ORDER BY namhoc DESC, tenlop ASC';
    const result = await pool.query(query);
    return result.rows;
  }

  async update() {
    const query = `
      UPDATE LOPHOC 
      SET tenlop = $1, namhoc = $2
      WHERE idlop = $3
      RETURNING *
    `;
    const values = [this.tenlop, this.namhoc, this.idlop];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async delete(id) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Xóa các bản ghi liên quan trong HOATDONG
      await client.query('DELETE FROM HOATDONG WHERE idlop = $1', [id]);
      
      // Xóa các bản ghi liên quan trong KIEMTRA
      await client.query('DELETE FROM KIEMTRA WHERE idlop = $1', [id]);
      
      // Kiểm tra xem lớp học có tồn tại không
      const checkClass = await client.query(
        'SELECT * FROM LOPHOC WHERE idlop = $1',
        [id]
      );
      
      if (checkClass.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      // Cuối cùng xóa lớp học
      const result = await client.query(
        'DELETE FROM LOPHOC WHERE idlop = $1 RETURNING *',
        [id]
      );
      
      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error deleting class:', error);
      throw new Error(`Không thể xóa lớp học: ${error.message}`);
    } finally {
      client.release();
    }
  }
}

module.exports = LopHoc; 