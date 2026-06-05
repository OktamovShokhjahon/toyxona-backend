const express = require('express');
const {
  getStats,
  getOwnersStats,
  getOwnerStats,
  getVenueStats,
  exportStats,
  getAllVenues,
  moderateVenue,
  toggleVenue,
  getAllUsers,
  toggleUser,
  deleteUser,
} = require('../controllers/adminController');
const { getAllBookings } = require('../controllers/bookingController');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleGuard');

const router = express.Router();

router.use(verifyToken, requireRole('admin'));

router.get('/stats', getStats);
router.get('/stats/owners', getOwnersStats);
router.get('/stats/owners/:ownerId', getOwnerStats);
router.get('/stats/venues/:venueId', getVenueStats);
router.get('/stats/export', exportStats);
router.get('/venues', getAllVenues);
router.put('/venues/:id/moderate', moderateVenue);
router.put('/venues/:id/toggle', toggleVenue);
router.get('/users', getAllUsers);
router.put('/users/:id/toggle', toggleUser);
router.delete('/users/:id', deleteUser);
router.get('/bookings', getAllBookings);

module.exports = router;
