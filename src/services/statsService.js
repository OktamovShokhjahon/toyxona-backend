const User = require('../models/User');
const Venue = require('../models/Venue');
const Booking = require('../models/Booking');

function calcRevenue(bookings, venueMap) {
  return bookings.reduce((sum, b) => {
    if (b.status !== 'confirmed') return sum;
    const vid = b.venue?._id?.toString() || b.venue?.toString();
    const venue = venueMap.get(vid);
    return sum + (venue?.pricePerSession || b.venue?.pricePerSession || 0) * (b.sessions?.length || 0);
  }, 0);
}

function bookingsByMonth(bookings, months = 6) {
  const result = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
    const count = bookings.filter((b) => {
      const bd = new Date(b.createdAt || b.date);
      return bd >= monthStart && bd <= monthEnd;
    }).length;
    const label = d.toLocaleDateString('uz-UZ', { month: 'short', year: '2-digit' });
    result.push({ month: key, label, count });
  }
  return result;
}

function revenueByMonth(bookings, venueMap, months = 6) {
  const result = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
    const monthBookings = bookings.filter((b) => {
      const bd = new Date(b.date);
      return b.status === 'confirmed' && bd >= monthStart && bd <= monthEnd;
    });
    const label = d.toLocaleDateString('uz-UZ', { month: 'short', year: '2-digit' });
    result.push({ month: key, label, revenue: calcRevenue(monthBookings, venueMap) });
  }
  return result;
}

function statusBreakdown(bookings) {
  const counts = { pending: 0, confirmed: 0, cancelled: 0 };
  bookings.forEach((b) => {
    if (counts[b.status] !== undefined) counts[b.status]++;
  });
  return [
    { name: 'Kutilmoqda', value: counts.pending, status: 'pending' },
    { name: 'Tasdiqlangan', value: counts.confirmed, status: 'confirmed' },
    { name: 'Bekor', value: counts.cancelled, status: 'cancelled' },
  ];
}

async function getOwnerStats(ownerId, { month, venueId } = {}) {
  const venueFilter = { owner: ownerId };
  const venues = await Venue.find(venueFilter);
  let venueIds = venues.map((v) => v._id);
  if (venueId) venueIds = venueIds.filter((id) => id.toString() === venueId);

  const venueMap = new Map(venues.map((v) => [v._id.toString(), v]));
  const bookings = await Booking.find({ venue: { $in: venueIds } }).populate('venue', 'name pricePerSession');

  const now = new Date();
  let monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  let monthEnd = now;
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split('-').map(Number);
    monthStart = new Date(y, m - 1, 1);
    monthEnd = new Date(y, m, 0, 23, 59, 59);
  }

  const confirmedThisMonth = bookings.filter(
    (b) => b.status === 'confirmed' && new Date(b.date) >= monthStart && new Date(b.date) <= monthEnd
  );

  const perVenue = venues.map((v) => {
    const vb = bookings.filter((b) => (b.venue._id || b.venue).toString() === v._id.toString());
    return {
      venueId: v._id,
      name: v.name,
      status: v.status,
      bookings: vb.length,
      confirmed: vb.filter((b) => b.status === 'confirmed').length,
      revenue: calcRevenue(vb, venueMap),
    };
  });

  return {
    totalBookingsThisMonth: confirmedThisMonth.length,
    revenueEstimate: calcRevenue(confirmedThisMonth, venueMap),
    activeVenues: venues.filter((v) => v.status === 'approved' && v.isEnabled).length,
    pendingBookings: bookings.filter((b) => b.status === 'pending').length,
    totalVenues: venues.length,
    recentBookings: bookings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 10),
    bookingsByMonth: bookingsByMonth(bookings),
    revenueByMonth: revenueByMonth(bookings, venueMap),
    statusBreakdown: statusBreakdown(bookings),
    perVenue,
  };
}

async function getPlatformStats() {
  const [clients, owners, venues, bookings, pendingVenues] = await Promise.all([
    User.countDocuments({ role: 'client' }),
    User.countDocuments({ role: 'owner' }),
    Venue.find(),
    Booking.find().populate('venue', 'name pricePerSession region'),
    Venue.countDocuments({ status: 'pending' }),
  ]);

  const venueMap = new Map(venues.map((v) => [v._id.toString(), v]));

  const topVenues = venues
    .map((v) => ({
      venueId: v._id,
      name: v.name,
      region: v.region,
      bookings: v.totalBookings,
      rating: v.rating,
      revenue: calcRevenue(
        bookings.filter((b) => (b.venue?._id || b.venue)?.toString() === v._id.toString()),
        venueMap
      ),
    }))
    .sort((a, b) => b.bookings - a.bookings)
    .slice(0, 5);

  const ownerUsers = await User.find({ role: 'owner' });
  const topOwners = await Promise.all(
    ownerUsers.map(async (o) => {
      const ovs = venues.filter((v) => v.owner.toString() === o._id.toString());
      const oids = ovs.map((v) => v._id);
      const ob = bookings.filter((b) => oids.some((id) => id.toString() === (b.venue?._id || b.venue)?.toString()));
      return {
        ownerId: o._id,
        name: `${o.firstName} ${o.lastName}`,
        phone: o.phone,
        venues: ovs.length,
        bookings: ob.length,
        revenue: calcRevenue(ob, venueMap),
      };
    })
  );
  topOwners.sort((a, b) => b.revenue - a.revenue);

  const venueStatusBreakdown = [
    { name: 'Tasdiqlangan', value: venues.filter((v) => v.status === 'approved').length },
    { name: 'Kutilmoqda', value: venues.filter((v) => v.status === 'pending').length },
    { name: 'Rad etilgan', value: venues.filter((v) => v.status === 'rejected').length },
  ];

  return {
    totalClients: clients,
    totalOwners: owners,
    totalUsers: clients + owners + (await User.countDocuments({ role: 'admin' })),
    totalVenues: venues.length,
    totalBookings: bookings.length,
    pendingApprovals: pendingVenues,
    bookingsByMonth: bookingsByMonth(bookings),
    revenueByMonth: revenueByMonth(bookings, venueMap),
    statusBreakdown: statusBreakdown(bookings),
    venueStatusBreakdown,
    topVenues,
    topOwners: topOwners.slice(0, 10),
  };
}

async function getAllOwnersStats() {
  const owners = await User.find({ role: 'owner' }).select('-passwordHash');
  const results = [];
  for (const o of owners) {
    const stats = await getOwnerStats(o._id.toString());
    results.push({
      ownerId: o._id,
      firstName: o.firstName,
      lastName: o.lastName,
      phone: o.phone,
      isEnabled: o.isEnabled,
      ...stats,
    });
  }
  return results;
}

async function getOwnerDetailStats(ownerId) {
  const owner = await User.findById(ownerId).select('-passwordHash');
  if (!owner || owner.role !== 'owner') return null;
  const stats = await getOwnerStats(ownerId);
  return { owner, ...stats };
}

async function getVenueDetailStats(venueId) {
  const venue = await Venue.findById(venueId).populate('owner', 'firstName lastName phone');
  if (!venue) return null;
  const bookings = await Booking.find({ venue: venueId });
  const venueMap = new Map([[venue._id.toString(), venue]]);

  const sessionOccupancy = { morning: 0, afternoon: 0, evening: 0 };
  bookings.filter((b) => b.status === 'confirmed').forEach((b) => {
    b.sessions.forEach((s) => {
      if (sessionOccupancy[s] !== undefined) sessionOccupancy[s]++;
    });
  });

  return {
    venue,
    totalBookings: bookings.length,
    confirmed: bookings.filter((b) => b.status === 'confirmed').length,
    pending: bookings.filter((b) => b.status === 'pending').length,
    revenue: calcRevenue(bookings, venueMap),
    bookingsByMonth: bookingsByMonth(bookings),
    revenueByMonth: revenueByMonth(bookings, venueMap),
    statusBreakdown: statusBreakdown(bookings),
    sessionOccupancy,
    recentBookings: bookings.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 15),
  };
}

async function getClientBookings(phone) {
  return Booking.find({ clientPhone: phone })
    .populate('venue', 'name region images address')
    .sort({ date: -1 })
    .limit(50);
}

module.exports = {
  getOwnerStats,
  getPlatformStats,
  getAllOwnersStats,
  getOwnerDetailStats,
  getVenueDetailStats,
  getClientBookings,
  calcRevenue,
};
