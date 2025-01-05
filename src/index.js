const app = require('./app');
const port = process.env.PORT || 5000;

app.listen(port, () => {
  console.log(`Server đang chạy tại http://localhost:${port}`);
});
