const express = require('express');
const { body } = require('express-validator');
const {
  createBooking,
  getVenueBookings,
  getCalendar,
  ownerDashboard,
  ownerDashboardExport,
  getMyBookings,
  updateBookingStatus,
  getAllBookings,
} = require('../controllers/bookingController');
const { verifyToken, optionalAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleGuard');

const router = express.Router();

router.get('/venue/:venueId/calendar', getCalendar);

router.post(
  '/',
  optionalAuth,
  [
    body('venueId').notEmpty(),
    body('clientName').optional().trim(),
    body('clientPhone').optional().trim(),
    body('date').notEmpty(),
    body('sessions').isArray({ min: 1 }),
  ],
  createBooking
);

router.get('/my', verifyToken, getMyBookings);

router.get('/venue/:venueId', verifyToken, requireRole('owner', 'admin'), getVenueBookings);

router.get('/owner/dashboard', verifyToken, requireRole('owner'), ownerDashboard);

router.get('/owner/dashboard/export', verifyToken, requireRole('owner'), ownerDashboardExport);

router.put('/:id/status', verifyToken, requireRole('owner', 'admin'), [body('status').isIn(['confirmed', 'cancelled'])], updateBookingStatus);

router.get('/admin/all', verifyToken, requireRole('admin'), getAllBookings);

module.exports = router;
