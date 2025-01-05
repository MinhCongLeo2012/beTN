const pool = require('../config/database');
const bcrypt = require('bcrypt');

const AdminController = {
  // User CRUD operations
  getUsers: async (req, res) => {
    const client = await pool.connect();
    try {
      const query = `
        SELECT 
          iduser as id,
          email,
          hoten as name,
          vaitro as role,
          ngaysinh,
          gioitinh,
          sodienthoai
        FROM "USER"
        ORDER BY hoten ASC
      `;
      
      const result = await pool.query(query);
      
      res.json({
        data: result.rows,
        total: result.rows.length
      });
    } catch (error) {
      console.error('Error in getUsers:', error);
      res.status(500).json({
        message: 'Lỗi khi lấy danh sách người dùng',
        error: error.message
      });
    } finally {
      client.release();
    }
  },

  createUser: async (req, res) => {
    const client = await pool.connect();
    try {
      const { email, password, name, role } = req.body;

      // Validate input
      if (!email || !password || !name || !role) {
        return res.status(400).json({
          message: 'Vui lòng điền đầy đủ thông tin'
        });
      }

      // Validate role
      const validRoles = ['ADMIN', 'TEACHER', 'STUDENT'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({
          message: 'Vai trò không hợp lệ'
        });
      }

      // Kiểm tra email đã tồn tại
      const checkEmail = await client.query(
        'SELECT email FROM "USER" WHERE email = $1',
        [email]
      );

      if (checkEmail.rows.length > 0) {
        return res.status(400).json({
          message: 'Email đã tồn tại'
        });
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Insert new user
      const result = await client.query(
        `INSERT INTO "USER" (
          hoten,
          email,
          matkhau,
          vaitro
        ) VALUES ($1, $2, $3, $4)
        RETURNING iduser, hoten, email, vaitro`,
        [name, email, hashedPassword, role]
      );

      res.status(201).json({
        data: {
          id: result.rows[0].iduser,
          name: result.rows[0].hoten,
          email: result.rows[0].email,
          role: result.rows[0].vaitro
        }
      });

    } catch (error) {
      console.error('Create user error:', error);
      res.status(500).json({
        message: 'Lỗi khi tạo người dùng',
        error: error.message
      });
    } finally {
      client.release();
    }
  },

  updateUser: async (req, res) => {
    const client = await pool.connect();
    try {
      const { id } = req.params;
      const { email, name, role, password } = req.body;

      console.log('Update user request:', { id, email, name, role, password });

      // Kiểm tra user tồn tại
      const userExists = await client.query(
        'SELECT * FROM "USER" WHERE iduser = $1',
        [id]
      );

      if (userExists.rows.length === 0) {
        return res.status(404).json({
          message: 'Không tìm thấy người dùng'
        });
      }

      // Kiểm tra email đã tồn tại (nếu email thay đổi)
      if (email && email !== userExists.rows[0].email) {
        const checkEmail = await client.query(
          'SELECT email FROM "USER" WHERE email = $1 AND iduser != $2',
          [email, id]
        );

        if (checkEmail.rows.length > 0) {
          return res.status(400).json({
            message: 'Email đã tồn tại'
          });
        }
      }

      // Tạo câu query động dựa trên các trường được cập nhật
      let updateFields = [];
      let values = [];
      let paramCount = 1;

      if (email) {
        updateFields.push(`email = $${paramCount}`);
        values.push(email);
        paramCount++;
      }

      if (name) {
        updateFields.push(`hoten = $${paramCount}`);
        values.push(name);
        paramCount++;
      }

      if (role) {
        // Kiểm tra nếu đây là admin cuối cùng
        if (userExists.rows[0].vaitro === 'ADMIN' && role !== 'ADMIN') {
          const adminCount = await client.query(
            'SELECT COUNT(*) as count FROM "USER" WHERE vaitro = \'ADMIN\''
          );
          if (adminCount.rows[0].count <= 1) {
            return res.status(400).json({
              message: 'Không thể thay đổi vai trò của admin cuối cùng'
            });
          }
        }
        updateFields.push(`vaitro = $${paramCount}`);
        values.push(role);
        paramCount++;
      }

      if (password) {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        updateFields.push(`matkhau = $${paramCount}`);
        values.push(hashedPassword);
        paramCount++;
      }

      // Nếu không có trường nào được cập nhật
      if (updateFields.length === 0) {
        return res.status(400).json({
          message: 'Không có thông tin nào được cập nhật'
        });
      }

      // Thêm ID vào cuối mảng values
      values.push(id);

      const query = `
        UPDATE "USER" 
        SET ${updateFields.join(', ')}
        WHERE iduser = $${paramCount}
        RETURNING iduser as id, email, hoten as name, vaitro as role
      `;

      console.log('Update query:', query);
      console.log('Update values:', values);

      const result = await client.query(query, values);

      if (result.rows.length === 0) {
        return res.status(404).json({
          message: 'Không tìm thấy người dùng'
        });
      }

      res.json({
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Error in updateUser:', error);
      res.status(500).json({
        message: 'Lỗi khi cập nhật người dùng',
        error: error.message
      });
    } finally {
      client.release();
    }
  },

  deleteUser: async (req, res) => {
    const client = await pool.connect();
    try {
      const { id } = req.params;

      // Kiểm tra xem có phải admin cuối cùng không
      const adminCheck = await client.query(
        'SELECT COUNT(*) as count FROM "USER" WHERE vaitro = \'ADMIN\''
      );
      
      const userCheck = await client.query(
        'SELECT vaitro FROM "USER" WHERE iduser = $1',
        [id]
      );

      if (userCheck.rows[0]?.vaitro === 'ADMIN' && adminCheck.rows[0].count <= 1) {
        return res.status(400).json({
          message: 'Không thể xóa admin cuối cùng của hệ thống'
        });
      }

      await client.query('BEGIN');

      // 1. Xóa các bản ghi trong KIEMTRA và các bảng liên quan
      // Lấy danh sách IDKETQUA từ KIEMTRA
      const ketquaIds = await client.query(
        'SELECT DISTINCT idketqua FROM KIEMTRA WHERE iduser = $1 AND idketqua IS NOT NULL',
        [id]
      );

      // Xóa các bản ghi trong KIEMTRA
      await client.query('DELETE FROM KIEMTRA WHERE iduser = $1', [id]);

      // Xóa các bản ghi trong KETQUA
      if (ketquaIds.rows.length > 0) {
        const ketquaIdList = ketquaIds.rows.map(row => row.idketqua);
        await client.query('DELETE FROM KETQUA WHERE idketqua = ANY($1)', [ketquaIdList]);
      }

      // 2. Xóa các bản ghi trong DETHI và các bảng liên quan
      // Lấy danh sách IDDETHI
      const dethiIds = await client.query(
        'SELECT iddethi FROM DETHI WHERE iduser = $1',
        [id]
      );

      if (dethiIds.rows.length > 0) {
        const dethiIdList = dethiIds.rows.map(row => row.iddethi);

        // Lấy danh sách IDCAUHOI từ các đề thi
        const cauhoiIds = await client.query(
          'SELECT idcauhoi FROM CAUHOI WHERE iddethi = ANY($1)',
          [dethiIdList]
        );

        if (cauhoiIds.rows.length > 0) {
          const cauhoiIdList = cauhoiIds.rows.map(row => row.idcauhoi);

          // Xóa các bản ghi trong CH_DA_MD và DAPAN
          await client.query('DELETE FROM CH_DA_MD WHERE idcauhoi = ANY($1)', [cauhoiIdList]);
          
          // Lấy và xóa các DAPAN không còn được sử dụng
          const dapanIds = await client.query(
            'SELECT DISTINCT iddapan FROM CH_DA_MD WHERE idcauhoi = ANY($1)',
            [cauhoiIdList]
          );
          
          if (dapanIds.rows.length > 0) {
            const dapanIdList = dapanIds.rows.map(row => row.iddapan);
            await client.query('DELETE FROM DAPAN WHERE iddapan = ANY($1)', [dapanIdList]);
          }

          // Xóa các câu hỏi
          await client.query('DELETE FROM CAUHOI WHERE idcauhoi = ANY($1)', [cauhoiIdList]);
        }

        // Xóa các đề thi
        await client.query('DELETE FROM DETHI WHERE iddethi = ANY($1)', [dethiIdList]);
      }

      // 3. Xóa các bản ghi trong HOATDONG
      await client.query('DELETE FROM HOATDONG WHERE iduser = $1', [id]);

      // 4. Cuối cùng xóa user
      const result = await client.query(
        'DELETE FROM "USER" WHERE iduser = $1 RETURNING iduser',
        [id]
      );

      await client.query('COMMIT');

      if (result.rows.length === 0) {
        return res.status(404).json({
          message: 'Không tìm thấy người dùng'
        });
      }

      res.json({
        message: 'Xóa người dùng thành công'
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error in deleteUser:', error);
      res.status(500).json({
        message: 'Lỗi khi xóa người dùng',
        error: error.message
      });
    } finally {
      client.release();
    }
  },

  // Exam CRUD operations
  getExams: async (req, res) => {
    const client = await pool.connect();
    try {
      const query = `
        SELECT 
          d.iddethi,
          d.tende,
          d.idmonhoc,
          d.idkhoi,
          d.idmucdich,
          m.tenmonhoc,
          k.tenkhoi,
          md.tenmucdich,
          TO_CHAR(d.ngaytao, 'MM/DD/YYYY') as ngaytao
        FROM DETHI d
        LEFT JOIN MONHOC m ON d.idmonhoc = m.idmonhoc
        LEFT JOIN KHOI k ON d.idkhoi = k.idkhoi
        LEFT JOIN MUCDICH md ON d.idmucdich = md.idmucdich
        ORDER BY d.ngaytao DESC
      `;

      const result = await client.query(query);
      
      console.log('Raw database result:', result.rows);

      const transformedData = result.rows.map(row => {
        const transformed = {
          id: row.iddethi,
          tende: row.tende,
          tenmonhoc: row.tenmonhoc,
          tenkhoi: row.tenkhoi,
          tenmucdich: row.tenmucdich,
          ngaytao: row.ngaytao
        };
        console.log('Transformed row:', transformed);
        return transformed;
      });

      console.log('Final data being sent:', { data: transformedData });

      res.json({
        data: transformedData
      });
    } catch (error) {
      console.error('Error in getExams:', error);
      res.status(500).json({
        message: 'Lỗi khi lấy danh sách đề thi',
        error: error.message
      });
    } finally {
      client.release();
    }
  },

  getExam: async (req, res) => {
    const client = await pool.connect();
    try {
      const { id } = req.params;
      const query = `
        SELECT 
          d.iddethi,
          d.tende,
          d.tongsocau,
          d.ghichu,
          d.idmonhoc,
          d.idkhoi,
          d.idmucdich,
          m.tenmonhoc,
          k.tenkhoi,
          md.tenmucdich,
          u.hoten as nguoitao
        FROM DETHI d
        LEFT JOIN MONHOC m ON d.idmonhoc = m.idmonhoc
        LEFT JOIN KHOI k ON d.idkhoi = k.idkhoi
        LEFT JOIN MUCDICH md ON d.idmucdich = md.idmucdich
        LEFT JOIN "USER" u ON d.iduser = u.iduser
        WHERE d.iddethi = $1
      `;
      
      const result = await client.query(query, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          message: 'Không tìm thấy đề thi'
        });
      }

      res.json({
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Error in getExam:', error);
      res.status(500).json({
        message: 'Lỗi khi lấy thông tin đề thi',
        error: error.message
      });
    } finally {
      client.release();
    }
  },

  createExam: async (req, res) => {
    const client = await pool.connect();
    try {
      const { tende, tongsocau, ghichu, idmonhoc, idmucdich, idkhoi } = req.body;
      const iduser = req.user.id;

      const result = await client.query(
        `INSERT INTO DETHI (
          tende, tongsocau, ghichu, idmonhoc, idmucdich, idkhoi, iduser, ngaytao
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
        RETURNING *`,
        [tende, tongsocau, ghichu, idmonhoc, idmucdich, idkhoi, iduser]
      );

      res.status(201).json({
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Error in createExam:', error);
      res.status(500).json({
        message: 'Lỗi khi tạo đề thi',
        error: error.message
      });
    } finally {
      client.release();
    }
  },

  updateExam: async (req, res) => {
    const client = await pool.connect();
    try {
      const { id } = req.params;
      const { tende, idmucdich } = req.body;

      // Kiểm tra đề thi tồn tại
      const examExists = await client.query(
        'SELECT * FROM DETHI WHERE iddethi = $1',
        [id]
      );

      if (examExists.rows.length === 0) {
        return res.status(404).json({
          message: 'Không tìm thấy đề thi'
        });
      }

      // Kiểm tra mục đích tồn tại
      if (idmucdich) {
        const mucdichExists = await client.query(
          'SELECT * FROM MUCDICH WHERE idmucdich = $1',
          [idmucdich]
        );
        if (mucdichExists.rows.length === 0) {
          return res.status(400).json({
            message: 'Mục đích không tồn tại'
          });
        }
      }

      // Cập nhật đề thi
      const updateQuery = `
        UPDATE DETHI 
        SET 
          tende = COALESCE($1, tende),
          idmucdich = COALESCE($2, idmucdich)
        WHERE iddethi = $3
        RETURNING 
          iddethi,
          tende,
          idmucdich
      `;

      const result = await client.query(updateQuery, [
        tende,
        idmucdich,
        id
      ]);

      // Lấy thông tin chi tiết sau khi cập nhật
      const detailQuery = `
        SELECT 
          d.iddethi,
          d.tende,
          d.idmonhoc,
          d.idkhoi,
          d.idmucdich,
          m.tenmonhoc,
          k.tenkhoi,
          md.tenmucdich
        FROM DETHI d
        LEFT JOIN MONHOC m ON d.idmonhoc = m.idmonhoc
        LEFT JOIN KHOI k ON d.idkhoi = k.idkhoi
        LEFT JOIN MUCDICH md ON d.idmucdich = md.idmucdich
        WHERE d.iddethi = $1
      `;

      const detailResult = await client.query(detailQuery, [id]);

      res.json({
        data: detailResult.rows[0]
      });

    } catch (error) {
      console.error('Error in updateExam:', error);
      res.status(500).json({
        message: 'Lỗi khi cập nhật đề thi',
        error: error.message
      });
    } finally {
      client.release();
    }
  },

  deleteExam: async (req, res) => {
    const client = await pool.connect();
    try {
      const { id } = req.params;

      await client.query('BEGIN');

      // 1. Kiểm tra đề thi có đang được sử dụng trong KIEMTRA không
      const kiemtraCheck = await client.query(
        'SELECT COUNT(*) FROM KIEMTRA WHERE iddethi = $1',
        [id]
      );

      if (kiemtraCheck.rows[0].count > 0) {
        return res.status(400).json({
          message: 'Không thể xóa đề thi đã được sử dụng trong bài kiểm tra'
        });
      }

      // 2. Xóa các câu hỏi và đáp án liên quan
      // Lấy danh sách câu hỏi
      const questions = await client.query(
        'SELECT idcauhoi FROM CAUHOI WHERE iddethi = $1',
        [id]
      );

      const questionIds = questions.rows.map(q => q.idcauhoi);

      if (questionIds.length > 0) {
        // Xóa các liên kết câu hỏi - đáp án - mức độ
        await client.query(
          'DELETE FROM CH_DA_MD WHERE idcauhoi = ANY($1)',
          [questionIds]
        );

        // Xóa các câu hỏi
        await client.query(
          'DELETE FROM CAUHOI WHERE iddethi = $1',
          [id]
        );
      }

      // 3. Xóa đề thi
      const result = await client.query(
        'DELETE FROM DETHI WHERE iddethi = $1 RETURNING iddethi',
        [id]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          message: 'Không tìm thấy đề thi'
        });
      }

      await client.query('COMMIT');

      res.json({
        message: 'Xóa đề thi thành công'
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error in deleteExam:', error);
      res.status(500).json({
        message: 'Lỗi khi xóa đề thi',
        error: error.message
      });
    } finally {
      client.release();
    }
  },

  getUser: async (req, res) => {
    const client = await pool.connect();
    try {
      const { id } = req.params;
      
      const query = `
        SELECT 
          iduser as id,
          email,
          hoten as name,
          vaitro as role,
          ngaysinh,
          gioitinh,
          sodienthoai
        FROM "USER"
        WHERE iduser = $1
      `;
      
      const result = await client.query(query, [id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          message: 'Không tìm thấy người dùng'
        });
      }

      res.json({
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Error in getUser:', error);
      res.status(500).json({
        message: 'Lỗi khi lấy thông tin người dùng',
        error: error.message
      });
    } finally {
      client.release();
    }
  }
};

module.exports = AdminController;