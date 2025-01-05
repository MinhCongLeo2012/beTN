const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class DeThi {
  constructor(data) {
    this.iddethi = data.iddethi || uuidv4();
    this.iduser = data.iduser;
    this.tende = data.tende;
    this.tongsocau = data.tongsocau;
    this.ghichu = data.ghichu;
    this.thoigian = data.thoigian;
    this.tgbatdau = data.tgbatdau;
    this.tgketthuc = data.tgketthuc;
    this.idkhoi = data.khoi;
    this.idmonhoc = data.monhoc;
    this.idmucdich = data.mucdich;
  }

  async save() {
    const query = `
      INSERT INTO DETHI (
        iddethi, iduser, tende, tongsocau, ghichu, 
        thoigian, tgbatdau, tgketthuc, idkhoi, idmonhoc, idmucdich,
        ngaytao
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
      RETURNING *
    `;
    const values = [
      this.iddethi,
      this.iduser,
      this.tende,
      this.tongsocau,
      this.ghichu,
      this.thoigian,
      this.tgbatdau,
      this.tgketthuc,
      this.idkhoi,
      this.idmonhoc,
      this.idmucdich
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
  }
}

module.exports = DeThi;