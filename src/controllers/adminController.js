const User = require('../models/User');
const Venue = require('../models/Venue');
const Booking = require('../models/Booking');
const { buildExcel, buildPdf } = require('../services/exportService');
const {
  getPlatformStats,
  getAllOwnersStats,
  getOwnerDetailStats,
  getVenueDetailStats,
} = require('../services/statsService');

async function getStats(req, res, next) {
  try {
    const stats = await getPlatformStats();
    res.json(stats);
  } catch (err) {
    next(err);
  }
}

async function getOwnersStats(req, res, next) {
  try {
    const owners = await getAllOwnersStats();
    res.json(owners);
  } catch (err) {
    next(err);
  }
}

async function getOwnerStats(req, res, next) {
  try {
    const data = await getOwnerDetailStats(req.params.ownerId);
    if (!data) return res.status(404).json({ message: 'Owner not found' });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

async function getVenueStats(req, res, next) {
  try {
    const data = await getVenueDetailStats(req.params.venueId);
    if (!data) return res.status(404).json({ message: 'Venue not found' });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

async function exportStats(req, res, next) {
  try {
    const { format = 'xlsx', type = 'platform', id } = req.query;
    let data = { title: 'Platforma statistikasi' };

    if (type === 'owner' && id) {
      const ownerData = await getOwnerDetailStats(id);
      if (!ownerData) return res.status(404).json({ message: 'Owner not found' });
      data = {
        title: `${ownerData.owner.firstName} ${ownerData.owner.lastName}`,
        summaryRows: [
          ['To\'yxonalar', ownerData.totalVenues],
          ['Bu oy bronlar', ownerData.totalBookingsThisMonth],
          ['Daromad', ownerData.revenueEstimate],
        ],
        bookings: ownerData.recentBookings,
        venues: ownerData.perVenue,
      };
    } else if (type === 'venue' && id) {
      const venueData = await getVenueDetailStats(id);
      if (!venueData) return res.status(404).json({ message: 'Venue not found' });
      data = {
        title: venueData.venue.name,
        summaryRows: [
          ['Jami bronlar', venueData.totalBookings],
          ['Tasdiqlangan', venueData.confirmed],
          ['Daromad', venueData.revenue],
        ],
        bookings: venueData.recentBookings,
      };
    } else {
      const stats = await getPlatformStats();
      data = {
        title: 'Platforma statistikasi',
        summaryRows: [
          ['Mijozlar', stats.totalClients],
          ['Egalari', stats.totalOwners],
          ['To\'yxonalar', stats.totalVenues],
          ['Bronlar', stats.totalBookings],
        ],
        venues: stats.topVenues,
      };
    }

    if (format === 'pdf') {
      const buf = await buildPdf(data);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=buron-${type}-stats.pdf`);
      return res.send(buf);
    }
    const buf = await buildExcel(data);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=buron-${type}-stats.xlsx`);
    res.send(buf);
  } catch (err) {
    next(err);
  }
}

async function getAllVenues(req, res, next) {
  try {
    const venues = await Venue.find()
      .populate('owner', 'firstName lastName phone')
      .sort({ createdAt: -1 });
    res.json(venues);
  } catch (err) {
    next(err);
  }
}

async function moderateVenue(req, res, next) {
  try {
    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Status must be approved or rejected' });
    }
    const venue = await Venue.findByIdAndUpdate(req.params.id, { status }, { new: true })
      .populate('owner', 'firstName lastName');
    if (!venue) return res.status(404).json({ message: 'Venue not found' });
    res.json(venue);
  } catch (err) {
    next(err);
  }
}

async function toggleVenue(req, res, next) {
  try {
    const venue = await Venue.findById(req.params.id);
    if (!venue) return res.status(404).json({ message: 'Venue not found' });
    venue.isEnabled = !venue.isEnabled;
    await venue.save();
    res.json(venue);
  } catch (err) {
    next(err);
  }
}

async function getAllUsers(req, res, next) {
  try {
    const users = await User.find().select('-passwordHash').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    next(err);
  }
}

async function toggleUser(req, res, next) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role === 'admin') return res.status(400).json({ message: 'Cannot disable admin' });
    user.isEnabled = !user.isEnabled;
    await user.save();
    const { passwordHash, ...safe } = user.toObject();
    res.json(safe);
  } catch (err) {
    next(err);
  }
}

async function deleteUser(req, res, next) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role === 'admin') return res.status(400).json({ message: 'Cannot delete admin' });
    await Venue.deleteMany({ owner: user._id });
    await user.deleteOne();
    res.json({ message: 'User deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
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
};
