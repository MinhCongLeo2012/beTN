const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const verifyToken = async (req, res, next) => {
  try {
    // Lấy token từ header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        message: 'Không tìm thấy token xác thực'
      });
    }

    const token = authHeader.split(' ')[1];
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Kiểm tra user trong database
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT iduser, email, vaitro, hoten FROM "USER" WHERE iduser = $1',
        [decoded.id]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({
          message: 'Token không hợp lệ'
        });
      }

      // Thêm thông tin user vào request
      req.user = {
        id: result.rows[0].iduser,
        email: result.rows[0].email,
        role: result.rows[0].vaitro,
        name: result.rows[0].hoten
      };

      next();
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(401).json({
      message: 'Token không hợp lệ hoặc đã hết hạn'
    });
  }
};

const checkAdminRole = async (req, res, next) => {
  try {
    // Kiểm tra xem user đã được xác thực chưa
    if (!req.user) {
      return res.status(401).json({
        message: 'Chưa xác thực người dùng'
      });
    }

    // Kiểm tra role
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({
        message: 'Không có quyền truy cập'
      });
    }

    next();
  } catch (error) {
    console.error('Role check error:', error);
    return res.status(500).json({
      message: 'Lỗi khi kiểm tra quyền truy cập'
    });
  }
};

module.exports = {
  verifyToken,
  checkAdminRole
}; 