const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const schema = `
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE CAUHOI (
   IDCAUHOI UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
   IDDETHI UUID NOT NULL,
   NOIDUNG VARCHAR(500) NULL,
   DAP_AN_A VARCHAR(255) NULL,
   DAP_AN_B VARCHAR(255) NULL,
   DAP_AN_C VARCHAR(255) NULL,
   DAP_AN_D VARCHAR(255) NULL,
   DIEM FLOAT8 NULL
);

CREATE TABLE CH_DA_MD (
   IDMUCDO VARCHAR(20) NOT NULL,
   IDDAPAN UUID NOT NULL,
   IDCAUHOI UUID NOT NULL
);

CREATE TABLE DAPAN (
   IDDAPAN UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
   DAPANDUNG VARCHAR(1) NOT NULL
);

CREATE TABLE DETHI (
   IDDETHI UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
   IDUSER UUID NOT NULL,
   TENDE VARCHAR(255) NULL,
   TONGSOCAU INT4 NULL,
   GHICHU VARCHAR(255) NULL,
   NGAYTAO DATE NULL,
   IDMONHOC VARCHAR(20) NULL,
   IDMUCDICH VARCHAR(20) NULL,
   IDKHOI VARCHAR(20) NULL
);

CREATE TABLE HOATDONG (
   IDUSER UUID NOT NULL,
   IDLOP UUID NOT NULL,
   SBD INT4 NULL
);

CREATE TABLE KETQUA (
   IDKETQUA UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
   TRANGTHAI VARCHAR(50) NULL,
   TGLAMBAI INT4 NULL,
   SOCAUDUNG INT4 NULL,
   SOCAUSAI INT4 NULL,
   TONGDIEM FLOAT8 NULL
);

CREATE TABLE KHOI (
   IDKHOI VARCHAR(20) PRIMARY KEY,
   TENKHOI VARCHAR(10) NULL
);

CREATE TABLE KIEMTRA (
   IDDETHI UUID NOT NULL,
   IDKETQUA UUID NULL,
   IDLOP UUID NOT NULL,
   IDUSER UUID NOT NULL,
   THOIGIAN INT4 NULL CHECK (THOIGIAN >= 0),
   TGBATDAU TIMESTAMP NULL,
   TGKETTHUC TIMESTAMP NULL,
   DAPANCHON TEXT NULL
);

CREATE TABLE LOPHOC (
   IDLOP UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
   TENLOP VARCHAR(255) NULL,
   SISO INT4 NULL,
   NAMHOC VARCHAR(10) NULL
);

CREATE TABLE MONHOC (
   IDMONHOC VARCHAR(20) PRIMARY KEY,
   TENMONHOC VARCHAR(255) NULL
);

CREATE TABLE MUCDICH (
   IDMUCDICH VARCHAR(20) PRIMARY KEY,
   TENMUCDICH VARCHAR(50) NULL
);

CREATE TABLE MUCDO (
   IDMUCDO VARCHAR(20) PRIMARY KEY,
   TENMUCDO VARCHAR(50) NULL
);

CREATE TABLE "USER" (
   IDUSER UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
   HOTEN VARCHAR(255) NOT NULL,
   EMAIL VARCHAR(255) NULL,
   MATKHAU VARCHAR(255) NULL,
   SODIENTHOAI VARCHAR(15) NULL CHECK (SODIENTHOAI ~ '^[0-9]{10}$'),
   NGAYSINH DATE NULL,
   GIOITINH VARCHAR(10) NULL,
   VAITRO VARCHAR(20) NULL
);

ALTER TABLE CAUHOI
   ADD CONSTRAINT FK_CAUHOI_FK_DETHI__DETHI FOREIGN KEY (IDDETHI)
      REFERENCES DETHI (IDDETHI);

ALTER TABLE CH_DA_MD
   ADD CONSTRAINT FK_CH_DA_MD_FK_CAUHOI_CAUHOI FOREIGN KEY (IDCAUHOI)
      REFERENCES CAUHOI (IDCAUHOI);

ALTER TABLE CH_DA_MD
   ADD CONSTRAINT FK_CH_DA_MD_FK_DAPAN__DAPAN FOREIGN KEY (IDDAPAN)
      REFERENCES DAPAN (IDDAPAN);

ALTER TABLE CH_DA_MD
   ADD CONSTRAINT FK_CH_DA_MD_FK_MUCDO__MUCDO FOREIGN KEY (IDMUCDO)
      REFERENCES MUCDO (IDMUCDO);

ALTER TABLE DETHI
   ADD CONSTRAINT FK_DETHI_FK_DETHI__KHOI FOREIGN KEY (IDKHOI)
      REFERENCES KHOI (IDKHOI);

ALTER TABLE DETHI
   ADD CONSTRAINT FK_DETHI_FK_DETHI__MONHOC FOREIGN KEY (IDMONHOC)
      REFERENCES MONHOC (IDMONHOC);

ALTER TABLE DETHI
   ADD CONSTRAINT FK_DETHI_FK_DETHI__MUCDICH FOREIGN KEY (IDMUCDICH)
      REFERENCES MUCDICH (IDMUCDICH);

ALTER TABLE DETHI
   ADD CONSTRAINT FK_DETHI_FK_USER_D_USER FOREIGN KEY (IDUSER)
      REFERENCES "USER" (IDUSER);

ALTER TABLE HOATDONG
   ADD CONSTRAINT FK_HOATDONG_FK_LOPHOC_LOPHOC FOREIGN KEY (IDLOP)
      REFERENCES LOPHOC (IDLOP);

ALTER TABLE HOATDONG
   ADD CONSTRAINT FK_HOATDONG_FK_USER_H_USER FOREIGN KEY (IDUSER)
      REFERENCES "USER" (IDUSER);

ALTER TABLE KIEMTRA
   ADD CONSTRAINT FK_KIEMTRA_FK_DETHI__DETHI FOREIGN KEY (IDDETHI)
      REFERENCES DETHI (IDDETHI);

ALTER TABLE KIEMTRA
   ADD CONSTRAINT FK_KIEMTRA_FK_LOPHOC_LOPHOC FOREIGN KEY (IDLOP)
      REFERENCES LOPHOC (IDLOP);

ALTER TABLE KIEMTRA
   ADD CONSTRAINT FK_KIEMTRA_FK_USER_K_USER FOREIGN KEY (IDUSER)
      REFERENCES "USER" (IDUSER);

ALTER TABLE KIEMTRA
   ADD CONSTRAINT FK_KIEMTRA_KETQUA_KI_KETQUA FOREIGN KEY (IDKETQUA)
      REFERENCES KETQUA (IDKETQUA);
`;

const initialData = `
INSERT INTO MONHOC (idmonhoc, tenmonhoc) VALUES
('AN', 'Âm nhạc'),
('CN', 'Công nghệ'),
('DIA', 'Địa lý'),
('MT', 'Mĩ thuật'),
('GDKTPL', 'Giáo dục kinh tế và pháp luật'),
('GDQPAN', 'Giáo dục quốc phòng và an ninh'),
('GDTC', 'Giáo dục thể chất'),
('HOA', 'Hóa học'),
('NN1', 'Ngoại ngữ 1'),
('NN2', 'Ngoại ngữ 2'),
('SINH', 'Sinh học'),
('SU', 'Lịch sử'),
('TDTTS', 'Tiếng dân tộc thiểu số'),
('TIN', 'Tin học'),
('TOAN', 'Toán'),
('VAN', 'Ngữ văn'),
('VLY', 'Vật lý');

INSERT INTO MUCDICH (idmucdich, tenmucdich) VALUES
('DINH_KY', 'Đánh giá định kì'),
('ON_TAP', 'Ôn tập'),
('THUONG_XUYEN', 'Đánh giá thường xuyên');

INSERT INTO KHOI (idkhoi, tenkhoi) VALUES
('L10', 'Lớp 10'),
('L11', 'Lớp 11'),
('L12', 'Lớp 12');

INSERT INTO MUCDO (IDMUCDO, TENMUCDO) VALUES
('NHAN_BIET', 'Nhận biết'),
('THONG_HIEU', 'Thông hiểu'),
('VAN_DUNG', 'Vận dụng'),
('VAN_DUNG_CAO', 'Vận dụng cao');
`;

async function createDatabase() {
    // Kết nối tới postgres mặc định để tạo database mới
    const pool = new Pool({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT,
        database: 'postgres'
    });

    try {
        // Kiểm tra xem database đã tồn tại chưa
        const checkDb = await pool.query(
            `SELECT 1 FROM pg_database WHERE datname = '${process.env.DB_NAME}'`
        );

        if (checkDb.rows.length === 0) {
            // Nếu chưa tồn tại thì tạo mới
            await pool.query(`CREATE DATABASE ${process.env.DB_NAME}`);
            console.log('Database created successfully');

            // Đóng kết nối với postgres mặc định
            await pool.end();

            // Kết nối tới database mới tạo
            const newPool = new Pool({
                user: process.env.DB_USER,
                host: process.env.DB_HOST,
                password: process.env.DB_PASSWORD,
                port: process.env.DB_PORT,
                database: process.env.DB_NAME
            });

            // Thực thi schema
            await newPool.query(schema);
            console.log('Database schema created successfully');

            // Thêm dữ liệu ban đầu
            await newPool.query(initialData);
            console.log('Initial data inserted successfully');

            await newPool.end();
        } else {
            console.log('Database already exists');
            await pool.end();
        }
    } catch (error) {
        console.error('Error creating database:', error);
        await pool.end();
        throw error;
    }
}

module.exports = createDatabase; 