const { Router } = require('express');
const { authenticateUser, checkPermission } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/upload');
const { createCause, getAllCauses, getCause, updateCause, addImagesToCause, deleteCause } = require('../controllers/causeController');

const causeRoutes = Router();

causeRoutes.post('/', authenticateUser, checkPermission('manage_causes'), upload.array('images', 10), createCause); // Added upload middleware
causeRoutes.get('/', getAllCauses);
causeRoutes.get('/:id', getCause);
causeRoutes.put('/:id', authenticateUser, checkPermission('manage_causes'), updateCause);
causeRoutes.post('/:id/images', authenticateUser, checkPermission('manage_causes'), upload.array('images', 10), addImagesToCause);
causeRoutes.delete('/', authenticateUser, checkPermission('manage_causes'), deleteCause);

module.exports = causeRoutes;