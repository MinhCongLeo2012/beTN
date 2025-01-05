const { Pool } = require('pg');
const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class User {
  constructor(data) {
    this.iduser = data.iduser;
    this.hoten = data.hoten;
    this.email = data.email;
    this.matkhau = data.matkhau;
    this.ngaysinh = data.ngaysinh;
    this.gioitinh = data.gioitinh;
    this.vaitro = data.vaitro;
    this.sodienthoai = data.sodienthoai;
  }

  static async findById(id) {
    const query = `
      SELECT iduser, hoten, email, matkhau, ngaysinh, 
             gioitinh, vaitro, sodienthoai 
      FROM "USER"
      WHERE iduser = $1
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0] ? new User(result.rows[0]) : null;
  }

  static async findByEmail(email) {
    const query = `
      SELECT iduser, hoten, email, matkhau, ngaysinh, 
             gioitinh, vaitro, sodienthoai
      FROM "USER"
      WHERE email = $1
    `;
    const result = await pool.query(query, [email]);
    return result.rows[0] ? new User(result.rows[0]) : null;
  }

  async save() {
    try {
      const query = `
        INSERT INTO "USER" (
          iduser, hoten, email, matkhau, 
          ngaysinh, gioitinh, vaitro
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;
      const values = [
        uuidv4(),
        this.hoten,
        this.email,
        this.matkhau,
        this.ngaysinh,
        this.gioitinh,
        this.vaitro
      ];

      const result = await pool.query(query, values);
      return new User(result.rows[0]);
    } catch (error) {
      console.error('Database error:', error);
      throw new Error(`Lỗi khi lưu user: ${error.message}`);
    }
  }

  async update() {
    try {
      const query = `
        UPDATE "USER"
        SET hoten = $1, ngaysinh = $2, gioitinh = $3, sodienthoai = $4
        WHERE iduser = $5
        RETURNING *
      `;
      
      const values = [
        this.hoten,
        this.ngaysinh,
        this.gioitinh,
        this.sodienthoai,
        this.iduser
      ];

      const result = await pool.query(query, values);
      return result.rows[0] ? new User(result.rows[0]) : null;
    } catch (error) {
      console.error('Database error:', error);
      throw new Error(`Lỗi khi cập nhật user: ${error.message}`);
    }
  }

  async saveResetToken(token, expiry) {
    const query = `
      UPDATE "USER"
      SET reset_token = $1, reset_token_expiry = $2
      WHERE iduser = $3
    `;
    await pool.query(query, [token, expiry, this.iduser]);
  }

  static async findByResetToken(token) {
    console.log('Looking for user with reset token:', token);
    try {
      const query = `
        SELECT *
        FROM "USER"
        WHERE confirm_token = $1
        AND confirm_token_expiry > $2
      `;
      const result = await pool.query(query, [token, Date.now()]);
      console.log('User found:', result.rows[0] ? 'Yes' : 'No');
      return result.rows[0] ? new User(result.rows[0]) : null;
    } catch (error) {
      console.error('Error finding user by reset token:', error);
      throw error;
    }
  }

  async updatePassword(newPassword) {
    console.log('Updating password for user:', this.iduser);
    try {
      const query = `
        UPDATE "USER"
        SET matkhau = $1
        WHERE iduser = $2
        RETURNING *
      `;
      const result = await pool.query(query, [newPassword, this.iduser]);
      if (!result.rows[0]) {
        throw new Error('Không tìm thấy user để cập nhật mật khẩu');
      }
      console.log('Password updated successfully');
      return result.rows[0];
    } catch (error) {
      console.error('Error updating password:', error);
      throw error;
    }
  }

  async saveConfirmationData(token, hashedPassword, expiry) {
    console.log('Saving confirmation data for user:', this.iduser);
    try {
      const query = `
        UPDATE "USER"
        SET confirm_token = $1, 
            pending_password = $2,
            confirm_token_expiry = $3
        WHERE iduser = $4
        RETURNING *
      `;
      const result = await pool.query(query, [token, hashedPassword, expiry, this.iduser]);
      console.log('Confirmation data saved successfully');
      return result.rows[0];
    } catch (error) {
      console.error('Error saving confirmation data:', error);
      throw error;
    }
  }

  static async confirmPasswordChange(token) {
    const query = `
      UPDATE "USER"
      SET matkhau = pending_password,
          confirm_token = NULL,
          pending_password = NULL,
          confirm_token_expiry = NULL
      WHERE confirm_token = $1
      AND confirm_token_expiry > $2
      RETURNING *
    `;
    const result = await pool.query(query, [token, Date.now()]);
    return result.rows[0] ? new User(result.rows[0]) : null;
  }
}

module.exports = User;
