const createDatabase = require('./commands/createDatabase');
const createDefaultAdmin = require('./commands/createAdmin');
const app = require('./app');

async function startServer() {
    try {
        // Tạo database và schema
        await createDatabase();
        
        // Tạo admin mặc định
        await createDefaultAdmin();

        // Khởi động server
        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();
