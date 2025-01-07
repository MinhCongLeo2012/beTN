const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');

dotenv.config();

async function createDefaultAdmin() {
    const pool = new Pool({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME
    });

    try {
        // Kiểm tra xem admin đã tồn tại chưa
        const checkAdmin = await pool.query(
            "SELECT 1 FROM \"USER\" WHERE EMAIL = 'admin@gmail.com'"
        );

        if (checkAdmin.rows.length === 0) {
            // Mã hóa mật khẩu
            const hashedPassword = await bcrypt.hash('admin123', 10);

            // Tạo admin mặc định
            await pool.query(
                'INSERT INTO "USER" (HOTEN, EMAIL, MATKHAU, SODIENTHOAI, VAITRO) VALUES ($1, $2, $3, $4, $5)',
                ['Administrator', 'admin@gmail.com', hashedPassword, '0123456789', 'ADMIN']
            );
            console.log('Default admin created successfully');
        } else {
            console.log('Admin already exists');
        }
        await pool.end();
    } catch (error) {
        console.error('Error creating admin:', error);
        await pool.end();
        throw error;
    }
}

module.exports = createDefaultAdmin; 