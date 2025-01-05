const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'project',
  password: '123456',
  port: 5432,
});

const createAdmin = async () => {
  const client = await pool.connect();
  
  try {
    // Kiểm tra xem email đã tồn tại chưa
    const email = 'admin@gmail.com';
    const checkQuery = 'SELECT * FROM "USER" WHERE email = $1';
    const checkResult = await client.query(checkQuery, [email]);

    if (checkResult.rows.length > 0) {
      console.log('Admin account already exists!');
      return;
    }

    // Tạo mật khẩu mặc định và hash
    const password = 'admin123';
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Thêm tài khoản admin vào database
    const insertQuery = `
      INSERT INTO "USER" (
        iduser,
        hoten,
        email,
        matkhau,
        vaitro
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING iduser, email, vaitro
    `;

    const values = [
      uuidv4(),
      'Administrator',
      email,
      hashedPassword,
      'ADMIN'
    ];

    const result = await client.query(insertQuery, values);

    console.log('Admin account created successfully!');
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('Please change the password after first login.');

  } catch (error) {
    console.error('Error creating admin account:', error);
    console.error('Error details:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
};

createAdmin(); 