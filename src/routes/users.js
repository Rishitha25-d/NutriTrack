const router = require('express').Router();
const { protect, adminOnly } = require('../middleware/auth');
const usersController = require('../controllers/usersController');

router.use(protect);

router.get('/profile',       usersController.getProfile);
router.put('/profile',       usersController.updateProfile);
router.put('/password',      usersController.changePassword);
router.delete('/account',    usersController.deleteAccount);
router.get('/bmi',           usersController.getBMI);
router.get('/tdee',          usersController.getTDEE);
router.put('/targets',       usersController.updateDailyTargets);
router.put('/notifications', usersController.updateNotifications);

// Admin
router.get('/',       adminOnly, usersController.getAllUsers);
router.get('/:id',    adminOnly, usersController.getUserById);
router.put('/:id',    adminOnly, usersController.adminUpdateUser);
router.delete('/:id', adminOnly, usersController.adminDeleteUser);

module.exports = router;
