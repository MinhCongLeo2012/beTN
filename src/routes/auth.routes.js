const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/auth.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

// Auth routes
router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.post('/google-login', AuthController.googleLogin);
router.post('/google-register', AuthController.googleRegister);
router.post('/forgot-password', AuthController.forgotPassword);
router.post('/reset-password', AuthController.resetPassword);

// Route cập nhật thông tin - thêm fallback function
router.put('/profile/:id', verifyToken, AuthController.updateUserProfile);

router.get('/confirm-password', AuthController.confirmPassword);

router.get('/check', verifyToken, (req, res) => {
  res.json({
    isAuthenticated: true,
    user: req.user
  });
});

router.get('/permissions', verifyToken, (req, res) => {
  res.json({
    permissions: req.user.role
  });
});

router.get('/me', verifyToken, (req, res) => {
  res.json(req.user);
});

module.exports = router; 