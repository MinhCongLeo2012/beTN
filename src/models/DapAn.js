const pool = require('../config/database');

class DapAn {
  constructor({ dapandung }) {
    this.dapandung = dapandung;
  }

  async save() {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'INSERT INTO DAPAN (dapandung) VALUES ($1) RETURNING iddapan',
        [this.dapandung]
      );
      return { iddapan: result.rows[0].iddapan };
    } finally {
      client.release();
    }
  }
}

module.exports = DapAn;