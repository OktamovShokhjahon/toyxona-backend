const express = require('express');
const { body } = require('express-validator');
const {
  listVenues,
  getVenue,
  createVenue,
  updateVenue,
  deleteVenue,
  myVenues,
} = require('../controllers/venueController');
const { verifyToken, optionalAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleGuard');
const upload = require('../middleware/upload');

const router = express.Router();

router.get('/owner/my', verifyToken, requireRole('owner', 'admin'), myVenues);

router.get('/', optionalAuth, listVenues);

router.get('/:id', optionalAuth, getVenue);

router.post(
  '/',
  verifyToken,
  requireRole('owner'),
  upload.array('images', 10),
  [
    body('name').trim().notEmpty(),
    body('description').trim().notEmpty(),
    body('address').trim().notEmpty(),
    body('mapLink').optional({ values: 'falsy' }).trim().isURL({ require_protocol: true, protocols: ['http', 'https'] }),
    body('region').trim().notEmpty(),
    body('district').trim().notEmpty(),
    body('phone').trim().notEmpty(),
    body('pricePerSession').isNumeric(),
    body('capacity').isInt({ min: 1 }),
  ],
  createVenue
);

router.put(
  '/:id',
  verifyToken,
  requireRole('owner', 'admin'),
  upload.array('images', 10),
  updateVenue
);

router.delete(
  '/:id',
  verifyToken,
  requireRole('owner', 'admin'),
  deleteVenue
);

module.exports = router;
