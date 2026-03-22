const router = require('express').Router();
const { register, login, logout, me, sendOtp, verifyOtp } = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');

router.post('/register',   register);
router.post('/send-otp',   sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/login',      login);
router.post('/logout',     authenticate, logout);
router.get('/me',          authenticate, me);

module.exports = router;
