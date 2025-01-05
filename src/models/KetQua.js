const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class KetQua {
  constructor(data) {
    this.idketqua = data.idketqua || uuidv4();
    this.trangthai = data.trangthai;
    this.tglambai = Math.min(parseInt(data.tglambai) || 0, 32767);
    this.socaudung = data.socaudung || 0;
    this.socausai = data.socausai || 0;
    this.tongdiem = parseFloat(data.tongdiem) || 0;
  }

  async save() {
    const query = `
      INSERT INTO KETQUA (
        idketqua, trangthai, tglambai, 
        socaudung, socausai, tongdiem
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const values = [
      this.idketqua,
      this.trangthai,
      this.tglambai,
      this.socaudung,
      this.socausai,
      this.tongdiem
    ];

    try {
      console.log('Saving KetQua with values:', values);
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error saving KetQua:', error);
      throw error;
    }
  }

  static async findById(id) {
    const query = 'SELECT * FROM KETQUA WHERE idketqua = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }
}

module.exports = KetQua; 