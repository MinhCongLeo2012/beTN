const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const crypto = require('crypto');
const { Pool } = require('pg');
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT
});

const transporter = require('../config/mailer');

class AuthController {
  static async register(req, res) {
    try {
      const { hoten, email, matkhau, vaitro } = req.body;

      // Validate input
      if (!hoten || !email || !matkhau || !vaitro) {
        return res.status(400).json({ message: 'Vui lòng điền đầy đủ thông tin' });
      }

      // Validate vaitro
      const validRoles = ['ADMIN', 'TEACHER', 'STUDENT'];
      if (!validRoles.includes(vaitro.toUpperCase())) {
        return res.status(400).json({ message: 'Vai trò không hợp lệ' });
      }

      // Check email format
      if (!email.endsWith('@gmail.com')) {
        return res.status(400).json({ message: 'Email phải là địa chỉ Gmail' });
      }

      // Check if user exists
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: 'Email đã ược sử dụng' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(matkhau, 10);

      // Create new user with validated data
      const userData = {
        hoten: hoten.trim(),
        email: email.trim().toLowerCase(),
        matkhau: hashedPassword,
        ngaysinh: null,
        gioitinh: null,
        vaitro: vaitro.toUpperCase()
      };

      const newUser = new User(userData);
      const savedUser = await newUser.save();

      res.status(201).json({
        message: 'Đăng ký thành công',
        user: {
          id: savedUser.iduser,
          email: savedUser.email,
          hoten: savedUser.hoten,
          vaitro: savedUser.vaitro
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ 
        message: 'Lỗi server', 
        error: error.message
      });
    }
  }

  static async login(req, res) {
    try {
      const { email, password } = req.body;
      
      const user = await User.findByEmail(email);
      if (!user) {
        return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng' });
      }

      const isValidPassword = await bcrypt.compare(password, user.matkhau);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng' });
      }

      const token = jwt.sign(
        { 
          id: user.iduser,
          email: user.email,
          role: user.vaitro 
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        message: 'Đăng nhập thành công',
        token,
        user: {
          id: user.iduser,
          hoten: user.hoten || '',
          email: user.email,
          ngaysinh: user.ngaysinh || '',
          gioitinh: user.gioitinh || 'male',
          sodienthoai: user.sodienthoai || '',
          vaitro: user.vaitro
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ 
        message: 'Lỗi server', 
        error: error.message 
      });
    }
  }

  static async updateUserProfile(req, res) {
    try {
      const userId = req.params.id;

      // Log toàn bộ request body để xem cấu trúc dữ liệu
      console.log('Request body:', req.body);

      // Lấy thông tin user hiện tại
      const currentUser = await User.findById(userId);
      if (!currentUser) {
        return res.status(404).json({
          message: 'Không tìm thấy người dùng'
        });
      }

      // Lấy dữ liệu trực tiếp từ req.body với đúng tên trường
      const userToUpdate = new User({
        ...currentUser,
        iduser: userId,
        hoten: req.body.hoten,
        ngaysinh: req.body.ngaysinh,
        gioitinh: req.body.gioitinh,
        sodienthoai: req.body.sodienthoai
      });

      // Sử dụng phương thức update() có sẵn
      const updatedUser = await userToUpdate.update();

      res.json({
        message: 'Cập nhật thông tin thành công',
        user: updatedUser
      });

    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        message: 'Lỗi khi cập nhật thông tin',
        error: error.message
      });
    }
  }

  static async googleLogin(req, res) {
    try {
      const { credential } = req.body;
      
      if (!credential) {
        return res.status(400).json({ 
          success: false,
          message: 'Missing credential' 
        });
      }

      // Verify Google token
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID
      });

      const payload = ticket.getPayload();
      const { email, name } = payload;

      // Check for existing user
      let user = await User.findByEmail(email.toLowerCase().trim());
      
      if (!user) {
        // Nếu không tìm thấy user, trả về lỗi yêu cầu đăng ký
        return res.status(404).json({
          success: false,
          message: 'Tài khoản chưa được đăng ký. Vui lòng đăng ký trước.',
          requireRegistration: true
        });
      }

      // Generate JWT token
      const token = jwt.sign(
        { 
          id: user.iduser, 
          email: user.email,
          role: user.vaitro 
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        success: true,
        message: 'Đăng nhập Google thành công',
        token,
        user: {
          id: user.iduser,
          email: user.email,
          hoten: user.hoten || name, // Sử dụng tên từ Google nếu không có trong DB
          vaitro: user.vaitro,
          ngaysinh: user.ngaysinh || '',
          gioitinh: user.gioitinh || 'male',
          sodienthoai: user.sodienthoai || ''
        }
      });
    } catch (error) {
      console.error('Google login error:', error);
      res.status(500).json({ 
        success: false,
        message: 'Lỗi xác thực Google',
        error: error.message 
      });
    }
  }

  static async googleRegister(req, res) {
    try {
      console.log('Starting Google registration process...');
      const { credential, vaitro } = req.body;
      
      if (!credential) {
        return res.status(400).json({ message: 'Missing credential' });
      }

      // Validate vaitro
      const validRoles = ['TEACHER', 'STUDENT'];
      if (!validRoles.includes(vaitro.toUpperCase())) {
        return res.status(400).json({ 
          message: 'Invalid role', 
          receivedRole: vaitro 
        });
      }

      // Verify Google token
      let ticket;
      try {
        ticket = await client.verifyIdToken({
          idToken: credential,
          audience: process.env.GOOGLE_CLIENT_ID
        });
      } catch (verifyError) {
        console.error('Token verification failed:', verifyError);
        return res.status(401).json({ 
          message: 'Token verification failed',
          error: verifyError.message 
        });
      }

      const payload = ticket.getPayload();
      const { email, name } = payload;

      try {
        // Check if user exists
        const existingUser = await User.findByEmail(email);
        if (existingUser) {
          return res.status(400).json({ message: 'Email đã được sử dụng' });
        }

        // Tạo mật khẩu ngẫu nhiên
        const randomPassword = crypto.randomBytes(16).toString('hex');
        const hashedPassword = await bcrypt.hash(randomPassword, 10);

        // Create new user
        const userData = {
          hoten: name,
          email: email.toLowerCase(),
          matkhau: hashedPassword,
          ngaysinh: null,
          gioitinh: null,
          vaitro: vaitro.toUpperCase(),
          sbd: null
        };
        console.log('User data before save:', userData);

        const newUser = new User(userData);
        const user = await newUser.save();

        return res.status(201).json({
          message: 'Đăng ký Google thành công',
          user: {
            id: user.iduser,
            email: user.email,
            hoten: user.hoten,
            vaitro: user.vaitro
          }
        });
      } catch (dbError) {
        console.error('Database operation failed:', dbError);
        return res.status(500).json({
          message: 'Lỗi khi tạo tài khoản',
          error: dbError.message
        });
      }
    } catch (error) {
      console.error('Google register error:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
      return res.status(500).json({ 
        message: 'Lỗi xác thực Google', 
        error: error.message 
      });
    }
  }

  static async refreshToken(req, res) {
    try {
      const oldToken = req.headers.authorization?.split(' ')[1];
      if (!oldToken) {
        return res.status(401).json({ message: 'Token không tồn tại' });
      }

      // Verify token hiện tại
      const decoded = jwt.verify(oldToken, process.env.JWT_SECRET, { ignoreExpiration: true });
      
      // Tạo token mới với thời hạn mới
      const newToken = jwt.sign(
        { 
          id: decoded.id,
          email: decoded.email,
          role: decoded.role 
        },
        process.env.JWT_SECRET,
        { 
          expiresIn: '24h'
        }
      );

      res.json({ token: newToken });
    } catch (error) {
      console.error('Refresh token error:', error);
      res.status(401).json({ message: 'Không thể refresh token' });
    }
  }

  static async forgotPassword(req, res) {
    try {
      const { email, newPassword } = req.body;
      console.log('Processing request for email:', email);

      if (!email || !newPassword) {
        return res.status(400).json({ message: 'Thiếu thông tin email hoặc mật khẩu' });
      }

      // Kiểm tra email tồn tại
      const user = await User.findByEmail(email);
      if (!user) {
        return res.status(404).json({ message: 'Email không tồn tại trong hệ thống' });
      }

      // Hash mật khẩu mới
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      try {
        // URL xác nhận (thay thế bằng URL frontend thực tế của bạn)
        const confirmUrl = `${process.env.FRONTEND_URL}/api/auth/confirm-password?email=${encodeURIComponent(email)}&password=${encodeURIComponent(hashedPassword)}`;

        await transporter.sendMail({
          from: {
            name: 'Hệ thống thi trực tuyến',
            address: process.env.EMAIL_USER || 'minh0363217538@gmail.com'
          },
          to: email,
          subject: 'Xác nhận đổi mật khẩu',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333; text-align: center;">Xác nhận đổi mật khẩu</h2>
              <p>Chi tiết tài khoản:</p>
              <p>- Tên hiển thị: ${user.hoten}</p>
              <p>- Email: ${email}</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${confirmUrl}" 
                   style="background-color: #4A1A13; 
                          color: white; 
                          padding: 12px 24px; 
                          text-decoration: none; 
                          border-radius: 4px;
                          display: inline-block;">
                  Xác nhận đổi mật khẩu
                </a>
              </div>
              <p>Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.</p>
            </div>
          `
        });
        console.log('Email sent successfully');

        res.json({
          message: 'Email xác nhận đã được gửi. Vui lòng kiểm tra hộp thư của bạn.',
          success: true
        });
      } catch (emailError) {
        console.error('Email sending error:', emailError);
        throw emailError;
      }
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({
        message: 'Lỗi server',
        error: error.message
      });
    }
  }

  static async resetPassword(req, res) {
    try {
      const { token, newPassword } = req.body;

      // Tìm user với token hợp lệ và chưa hết hạn
      const user = await User.findByResetToken(token);
      if (!user) {
        return res.status(400).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
      }

      // Hash mật khẩu mới
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Cập nhật mật khẩu và xóa token
      await user.updatePassword(hashedPassword);

      res.json({ message: 'Đặt lại mật khẩu thành công' });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ message: 'Lỗi server' });
    }
  }

  static async confirmResetPassword(req, res) {
    try {
      const { token } = req.body;
      
      // Tìm user với token hợp lệ
      const user = await User.findByConfirmToken(token);
      if (!user) {
        return res.status(400).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
      }

      // Cập nhật mật khẩu mới từ pending_password
      await user.confirmPasswordReset();
      
      res.json({ 
        message: 'Mật khẩu đã được cập nhật thành công',
        success: true 
      });
    } catch (error) {
      console.error('Confirm reset password error:', error);
      res.status(500).json({ message: 'Lỗi server' });
    }
  }

  static async findByConfirmToken(token) {
    const query = `
      SELECT * FROM "USER" 
      WHERE confirm_token = $1 
      AND confirm_token_expiry > NOW()
    `;
    const result = await pool.query(query, [token]);
    return result.rows[0] ? new User(result.rows[0]) : null;
  }

  static async confirmPassword(req, res) {
    try {
      const { email, password } = req.query;
      
      const user = await User.findByEmail(email);
      if (!user) {
        return res.status(404).json({ message: 'Không tìm thấy người dùng' });
      }

      // Cập nhật mật khẩu
      await user.updatePassword(password);

      // Chuyển hướng về trang đăng nhập với thông báo thành công
      res.redirect(`${process.env.FRONTEND_URL}/login?message=Đổi mật khẩu thành công`);
    } catch (error) {
      console.error('Confirm password error:', error);
      res.redirect(`${process.env.FRONTEND_URL}/login?error=Có lỗi xảy ra`);
    }
  }

  static async changePassword(req, res) {
    const client = await pool.connect();
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user.id;

      // Kiểm tra mật khẩu hiện tại
      const user = await client.query(
        'SELECT password FROM "USER" WHERE iduser = $1',
        [userId]
      );

      if (user.rows.length === 0) {
        return res.status(404).json({
          message: 'Không tìm thấy người dùng'
        });
      }

      const isValidPassword = await bcrypt.compare(
        currentPassword,
        user.rows[0].password
      );

      if (!isValidPassword) {
        return res.status(400).json({
          message: 'Mật khẩu hiện tại không đúng'
        });
      }

      // Mã hóa mật khẩu mới
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Cập nhật mật khẩu
      await client.query(
        'UPDATE "USER" SET password = $1 WHERE iduser = $2',
        [hashedPassword, userId]
      );

      res.json({
        message: 'Đổi mật khẩu thành công'
      });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        message: 'Lỗi khi đổi mật khẩu'
      });
    } finally {
      client.release();
    }
  }

  static async updateProfile(req, res) {
    const client = await pool.connect();
    try {
      const { hoten, ngaysinh, gioitinh, sodienthoai } = req.body;
      const userId = req.params.id;

      // Validate phone number if provided
      if (sodienthoai) {
        const phoneRegex = /^[0-9]{10}$/;
        if (!phoneRegex.test(sodienthoai)) {
          return res.status(400).json({
            message: 'Số điện thoại phải có 10 chữ số'
          });
        }
      }

      // Validate gender if provided
      if (gioitinh && !['male', 'female'].includes(gioitinh)) {
        return res.status(400).json({
          message: 'Giới tính không hợp lệ'
        });
      }

      const result = await client.query(
        `UPDATE "USER" 
         SET hoten = COALESCE($1, hoten),
             ngaysinh = COALESCE($2, ngaysinh),
             gioitinh = COALESCE($3, gioitinh),
             sodienthoai = COALESCE($4, sodienthoai)
         WHERE iduser = $5
         RETURNING iduser, hoten, email, ngaysinh, gioitinh, sodienthoai, vaitro`,
        [hoten, ngaysinh, gioitinh, sodienthoai, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          message: 'Không tìm thấy người dùng'
        });
      }

      res.json({
        message: 'Cập nhật thông tin thành công',
        user: result.rows[0]
      });

    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        message: 'Lỗi khi cập nhật thông tin',
        error: error.message
      });
    } finally {
      client.release();
    }
  }

  static async checkAuth(req, res) {
    try {
      res.json({
        isAuthenticated: true,
        role: req.user.role
      });
    } catch (error) {
      console.error('Check auth error:', error);
      res.status(500).json({
        message: 'Lỗi khi kiểm tra xác thực'
      });
    }
  }

  static async getProfile(req, res) {
    try {
      res.json({
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        role: req.user.role
      });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        message: 'Lỗi khi lấy thông tin người dùng'
      });
    }
  }

  static async logout(req, res) {
    try {
      // Xóa token khỏi client
      res.clearCookie('token');
      
      res.json({
        success: true,
        message: 'Đăng xuất thành công'
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi đăng xuất'
      });
    }
  }
}

module.exports = AuthController; 