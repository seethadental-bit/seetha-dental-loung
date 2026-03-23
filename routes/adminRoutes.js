const router = require('express').Router();
const { authenticate } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const c = require('../controllers/adminController');

router.use(authenticate, requireRole('admin'));

router.get('/dashboard',                    c.getDashboard);
router.get('/users',                        c.getUsers);
router.post('/users',                       c.createUserByAdmin);
router.put('/users/:id',                    c.updateUser);
router.delete('/users/:id',                 c.deleteUser);
router.patch('/users/:id/status',           c.updateUserStatus);
router.get('/users/:id/tokens',             c.getUserTokens);
router.get('/doctors',                      c.getDoctors);
router.post('/doctors',                     c.createDoctor);
router.put('/doctors/:id',                  c.updateDoctor);
router.delete('/doctors/:id',               c.deleteDoctor);
router.patch('/doctors/:id/availability',   c.setDoctorAvailability);
router.get('/tokens',                       c.getAllTokens);
router.patch('/tokens/:id/cancel',          c.adminCancelToken);
router.get('/recalls',                      c.getRecalls);
router.post('/recalls/trigger',             c.triggerRecalls);

module.exports = router;
