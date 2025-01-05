const pool = require('../config/database');

class KiemTra {
  constructor(data) {
    this.iddethi = data.iddethi;
    this.idketqua = data.idketqua;
    this.idlop = data.idlop;
    this.iduser = data.iduser;
    this.thoigian = data.thoigian;
    this.tgbatdau = data.tgbatdau;
    this.tgketthuc = data.tgketthuc;
    this.dapanchon = data.dapanchon;
  }

  async save() {
    const query = `
      INSERT INTO KIEMTRA (
        iddethi, idketqua, idlop, iduser, 
        thoigian, tgbatdau, tgketthuc, dapanchon
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const values = [
      this.iddethi,
      this.idketqua,
      this.idlop,
      this.iduser,
      this.thoigian,
      this.tgbatdau,
      this.tgketthuc,
      this.dapanchon ? JSON.stringify(this.dapanchon) : null
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async update(iddethi, iduser, data) {
    if (!iduser) {
      throw new Error('iduser is required');
    }

    let kiemtra = await this.findByDeThiAndUser(iddethi, iduser);
    
    if (!kiemtra) {
      console.log('Không tìm thấy bài kiểm tra, tạo mới...', { iddethi, iduser });
      kiemtra = await this.createExamAttempt({
        iddethi,
        iduser,
        idlop: data.idlop,
        thoigian: data.thoigian
      });
    }

    const query = `
      UPDATE KIEMTRA 
      SET dapanchon = $1, 
          idketqua = $2, 
          tgketthuc = CURRENT_TIMESTAMP
      WHERE iddethi = $3 AND iduser = $4
      RETURNING *
    `;
    const values = [
      data.dapanchon ? JSON.stringify(data.dapanchon) : null,
      data.idketqua,
      iddethi,
      iduser
    ];

    try {
      const result = await pool.query(query, values);
      console.log('Cập nhật KIEMTRA thành công:', result.rows[0]);
      return result.rows[0];
    } catch (error) {
      console.error('Lỗi khi cập nhật KIEMTRA:', error);
      throw error;
    }
  }

  static async findByDeThiAndUser(iddethi, iduser) {
    const query = `
      SELECT * FROM KIEMTRA 
      WHERE iddethi = $1 AND iduser = $2
    `;
    const result = await pool.query(query, [iddethi, iduser]);
    return result.rows[0];
  }

  static async findByKetQua(idketqua) {
    const query = `
      SELECT k.*, d.tende, d.tongsocau 
      FROM KIEMTRA k
      JOIN DETHI d ON k.iddethi = d.iddethi
      WHERE k.idketqua = $1
    `;
    const result = await pool.query(query, [idketqua]);
    if (result.rows[0] && result.rows[0].dapanchon) {
      try {
        result.rows[0].dapanchon = JSON.parse(result.rows[0].dapanchon);
      } catch (error) {
        console.error('Error parsing dapanchon:', error);
        result.rows[0].dapanchon = [];
      }
    }
    return result.rows[0];
  }

  static async findUserClass(iduser, iddethi) {
    const query = `
      SELECT h.idlop
      FROM HOATDONG h
      WHERE h.iduser = $1
      ORDER BY h.sbd DESC
      LIMIT 1
    `;

    try {
      console.log('Finding class for user:', { iduser, iddethi });
      const result = await pool.query(query, [iduser]);
      
      if (!result.rows[0]?.idlop) {
        console.log('No class found for user:', iduser);
        const fallbackQuery = `
          SELECT DISTINCT h.idlop
          FROM HOATDONG h
          WHERE h.iduser = $1
          LIMIT 1
        `;
        const fallbackResult = await pool.query(fallbackQuery, [iduser]);
        return fallbackResult.rows[0]?.idlop;
      }

      console.log('Found class:', result.rows[0]);
      return result.rows[0].idlop;
    } catch (error) {
      console.error('Error finding user class:', error);
      throw error;
    }
  }

  static async createExamAttempt(data) {
    try {
      if (!data.iduser) {
        throw new Error('iduser is required for creating exam attempt');
      }

      console.log('Creating exam attempt with data:', data);
      
      if (!data.idlop) {
        data.idlop = await this.findUserClass(data.iduser, data.iddethi);
        
        if (!data.idlop) {
          const LopHoc = require('./LopHoc');
          const newClass = new LopHoc({
            tenlop: `Lớp tạm ${new Date().getFullYear()}`,
            namhoc: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`
          });
          const savedClass = await newClass.save();
          
          await pool.query(
            'INSERT INTO HOATDONG (iduser, idlop, sbd) VALUES ($1, $2, 1)',
            [data.iduser, savedClass.idlop]
          );
          
          data.idlop = savedClass.idlop;
        }
      }

      const query = `
        INSERT INTO KIEMTRA (
          iddethi, idlop, iduser, 
          thoigian, tgbatdau
        )
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        RETURNING *
      `;
      const values = [
        data.iddethi,
        data.idlop,
        data.iduser,
        data.thoigian || 0
      ];

      console.log('Executing query with values:', values);
      const result = await pool.query(query, values);
      console.log('Created exam attempt:', result.rows[0]);
      return result.rows[0];
    } catch (error) {
      console.error('Error in createExamAttempt:', error);
      throw error;
    }
  }
}

module.exports = KiemTra; 