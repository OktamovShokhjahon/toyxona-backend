const { validationResult } = require('express-validator');
const Venue = require('../models/Venue');
const User = require('../models/User');
const Booking = require('../models/Booking');

function buildImageUrls(req, files) {
  const base = `${req.protocol}://${req.get('host')}`;
  if (files && files.length > 0) {
    return files.map((f) => `${base}/uploads/${f.filename}`);
  }
  return [];
}

async function listVenues(req, res, next) {
  try {
    const {
      q,
      region,
      minPrice,
      maxPrice,
      minCapacity,
      minRating,
      sort = 'rating',
      order = 'desc',
      page = 1,
      limit = 12,
      ownerOnly,
    } = req.query;

    const filter = {};

    if (req.user?.role === 'admin' && ownerOnly !== 'true') {
      /* admin all-venues uses admin route */
    } else if (req.user?.role === 'owner' && req.path.includes('/owner/my')) {
      filter.owner = req.user.userId;
    } else {
      filter.status = 'approved';
      filter.isEnabled = true;
    }

    if (region) filter.region = region;
    if (minPrice) filter.pricePerSession = { ...filter.pricePerSession, $gte: Number(minPrice) };
    if (maxPrice) {
      filter.pricePerSession = { ...filter.pricePerSession, $lte: Number(maxPrice) };
    }
    if (minCapacity) filter.capacity = { $gte: Number(minCapacity) };
    if (minRating) filter.rating = { $gte: Number(minRating) };

    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { address: { $regex: q, $options: 'i' } },
      ];
    }

    const sortMap = {
      rating: 'rating',
      price: 'pricePerSession',
      name: 'name',
      bookings: 'totalBookings',
    };
    const sortField = sortMap[sort] || 'rating';
    const sortOrder = order === 'asc' ? 1 : -1;

    const skip = (Number(page) - 1) * Number(limit);
    const [venues, total] = await Promise.all([
      Venue.find(filter)
        .populate('owner', 'firstName lastName phone telegram')
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(Number(limit)),
      Venue.countDocuments(filter),
    ]);

    res.json({
      venues,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getVenue(req, res, next) {
  try {
    const venue = await Venue.findById(req.params.id).populate(
      'owner',
      'firstName lastName phone telegram'
    );
    if (!venue) {
      return res.status(404).json({ message: 'Venue not found' });
    }
    if (
      venue.status !== 'approved' &&
      req.user?.role !== 'admin' &&
      venue.owner._id.toString() !== req.user?.userId
    ) {
      return res.status(404).json({ message: 'Venue not found' });
    }
    res.json(venue);
  } catch (err) {
    next(err);
  }
}

async function createVenue(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
    }
    const imageUrls = buildImageUrls(req, req.files);
    const bodyImages = req.body.images
      ? typeof req.body.images === 'string'
        ? JSON.parse(req.body.images)
        : req.body.images
      : [];
    const images = [...imageUrls, ...(Array.isArray(bodyImages) ? bodyImages : [])];
    if (images.length < 3) {
      return res.status(400).json({ message: 'At least 3 images are required' });
    }
    const mapLink = typeof req.body.mapLink === 'string' ? req.body.mapLink.trim() : '';
    const venue = await Venue.create({
      owner: req.user.userId,
      name: req.body.name,
      description: req.body.description,
      address: req.body.address,
      mapLink: mapLink || undefined,
      region: req.body.region,
      district: req.body.district,
      phone: req.body.phone,
      pricePerSession: Number(req.body.pricePerSession),
      capacity: Number(req.body.capacity),
      images,
      status: 'pending',
    });
    const populated = await Venue.findById(venue._id).populate('owner', 'firstName lastName');
    res.status(201).json(populated);
  } catch (err) {
    next(err);
  }
}

async function updateVenue(req, res, next) {
  try {
    const venue = await Venue.findById(req.params.id);
    if (!venue) {
      return res.status(404).json({ message: 'Venue not found' });
    }
    if (
      req.user.role !== 'admin' &&
      venue.owner.toString() !== req.user.userId
    ) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    const imageUrls = buildImageUrls(req, req.files);
    const updates = { ...req.body };
    if (updates.pricePerSession) updates.pricePerSession = Number(updates.pricePerSession);
    if (updates.capacity) updates.capacity = Number(updates.capacity);
    if (updates.mapLink !== undefined) {
      updates.mapLink = typeof updates.mapLink === 'string' ? updates.mapLink.trim() : '';
      if (!updates.mapLink) updates.mapLink = undefined;
    }
    if (imageUrls.length > 0) {
      updates.images = [...(venue.images || []), ...imageUrls];
    }
    if (updates.images && typeof updates.images === 'string') {
      updates.images = JSON.parse(updates.images);
    }
    if (req.user.role !== 'admin' && venue.status === 'approved') {
      updates.status = 'pending';
    }
    Object.assign(venue, updates);
    if (venue.images && venue.images.length < 3) {
      return res.status(400).json({ message: 'At least 3 images are required' });
    }
    await venue.save();
    const populated = await Venue.findById(venue._id).populate('owner', 'firstName lastName');
    res.json(populated);
  } catch (err) {
    next(err);
  }
}

async function deleteVenue(req, res, next) {
  try {
    const venue = await Venue.findById(req.params.id);
    if (!venue) {
      return res.status(404).json({ message: 'Venue not found' });
    }
    if (
      req.user.role !== 'admin' &&
      venue.owner.toString() !== req.user.userId
    ) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    await Booking.deleteMany({ venue: venue._id });
    await venue.deleteOne();
    res.json({ message: 'Venue deleted' });
  } catch (err) {
    next(err);
  }
}

async function myVenues(req, res, next) {
  try {
    const venues = await Venue.find({ owner: req.user.userId })
      .populate('owner', 'firstName lastName')
      .sort({ createdAt: -1 });
    res.json(venues);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listVenues,
  getVenue,
  createVenue,
  updateVenue,
  deleteVenue,
  myVenues,
};
