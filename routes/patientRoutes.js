const router = require('express').Router();
const { authenticate } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const c = require('../controllers/tokenController');

router.use(authenticate, requireRole('patient'));

router.get('/doctors',                    c.getDoctors);
router.get('/booked-slots',               c.getBookedSlots);
router.post('/book-token',                c.bookNewToken);
router.get('/my-tokens',                  c.getMyTokens);
router.get('/my-token-status/:id',        c.getTokenStatus);
router.patch('/tokens/:id/cancel',        c.cancelMyToken);
router.get('/recall-info/:id',            c.getRecallInfo);

module.exports = router;
