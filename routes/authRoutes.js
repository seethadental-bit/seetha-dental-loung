const router = require('express').Router();
const { register, login, logout, me, sendOtp, verifyOtp, forgotPassword, verifyResetOtp, resetPassword } = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');

router.post('/register',           register);
router.post('/send-otp',           sendOtp);
router.post('/verify-otp',         verifyOtp);
router.post('/login',              login);
router.post('/forgot-password',    forgotPassword);
router.post('/verify-reset-otp',   verifyResetOtp);
router.post('/reset-password',     resetPassword);
router.post('/logout',             authenticate, logout);
router.get('/me',                  authenticate, me);

module.exports = router;
