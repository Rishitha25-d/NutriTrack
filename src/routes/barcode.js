const router = require('express').Router();
const { protect } = require('../middleware/auth');
const c = require('../controllers/barcodeController');

router.use(protect);
router.get('/:barcode', c.lookupBarcode);

module.exports = router;
