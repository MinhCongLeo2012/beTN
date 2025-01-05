const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class CauHoi {
  constructor(data) {
    this.idcauhoi = data.idcauhoi || uuidv4();
    this.iddethi = data.iddethi;
    this.noidung = data.noidung;
    this.dap_an_a = data.dap_an_a;
    this.dap_an_b = data.dap_an_b;
    this.dap_an_c = data.dap_an_c;
    this.dap_an_d = data.dap_an_d;
    this.diem = data.diem;
  }

  async save() {
    const query = `
      INSERT INTO CAUHOI (idcauhoi, iddethi, noidung, dap_an_a, dap_an_b, dap_an_c, dap_an_d, diem)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const values = [
      this.idcauhoi,
      this.iddethi,
      this.noidung,
      this.dap_an_a,
      this.dap_an_b,
      this.dap_an_c,
      this.dap_an_d,
      this.diem
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
  }
}

module.exports = CauHoi;