require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../src/models/User');
const Venue = require('../src/models/Venue');
const Booking = require('../src/models/Booking');
const Review = require('../src/models/Review');
const { updateVenueRating } = require('../src/utils/reviewRating');

const SALT_ROUNDS = 12;

const PLACEHOLDER_IMAGES = [
  'https://images.unsplash.com/photo-1519167758481-83f29da8c2f2?w=800',
  'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=800',
  'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=800',
];

const VENUES_DATA = [
  { name: "Sarvar To'yxonasi", region: 'Toshkent', district: 'Yunusobod', price: 8000000, rating: 4.8, ownerIndex: 0 },
  { name: 'Grand Nargiza Palace', region: 'Samarqand', district: 'Markaz', price: 6500000, rating: 4.6, ownerIndex: 1 },
  { name: "Bahrom Wedding Hall", region: "Farg'ona", district: 'Markaz', price: 5000000, rating: 4.5, ownerIndex: 2 },
  { name: 'Dilnoza Garden', region: 'Andijon', district: 'Markaz', price: 4500000, rating: 4.3, ownerIndex: 0 },
  { name: 'Royal Toshkent', region: 'Toshkent', district: 'Chilonzor', price: 12000000, rating: 4.9, ownerIndex: 0 },
  { name: 'Buxoro Guliston', region: 'Buxoro', district: 'Markaz', price: 4000000, rating: 4.2, ownerIndex: 1 },
  { name: 'Namangan Shahzoda', region: 'Namangan', district: 'Markaz', price: 5500000, rating: 4.4, ownerIndex: 2 },
  { name: 'Qashqadaryo Baxt', region: 'Qashqadaryo', district: 'Qarshi', price: 3800000, rating: 4.1, ownerIndex: 0 },
  { name: 'Xorazm Oazis', region: 'Xorazm', district: 'Urganch', price: 4200000, rating: 4.0, ownerIndex: 1 },
  { name: 'Navoiy Zafar Hall', region: 'Navoiy', district: 'Markaz', price: 3500000, rating: 3.9, ownerIndex: 2 },
];

const REVIEW_COMMENTS = [
  "Ajoyib to'yxona, tavsiya qilaman!",
  'Xizmatlari zo\'r, mehmonlar qoniqdi.',
  'Narxi va sifati mos keladi.',
  'Joylashuvi qulay, dekoratsiyasi chiroyli.',
  'Yana bir bor tanlaymiz.',
];

const SESSIONS = ['morning', 'afternoon', 'evening'];

async function seed() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/buron';
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  await Promise.all([
    User.deleteMany({}),
    Venue.deleteMany({}),
    Booking.deleteMany({}),
    Review.deleteMany({}),
  ]);
  console.log('Cleared collections');

  const adminHash = await bcrypt.hash('admin123', SALT_ROUNDS);
  const admin = await User.create({
    role: 'admin',
    firstName: 'Admin',
    lastName: 'Buron',
    phone: '+998901234567',
    passwordHash: adminHash,
    isEnabled: true,
  });

  const ownersData = [
    { firstName: 'Sarvar', lastName: 'Toshmatov', phone: '+998901111111', telegram: '@sarvar_toyxona' },
    { firstName: 'Nargiza', lastName: 'Yusupova', phone: '+998902222222', telegram: '@nargiza_palace' },
    { firstName: 'Bahrom', lastName: 'Karimov', phone: '+998903333333', telegram: '@bahrom_hall' },
  ];
  const ownerHash = await bcrypt.hash('owner123', SALT_ROUNDS);
  const owners = await Promise.all(
    ownersData.map((o) =>
      User.create({ ...o, role: 'owner', passwordHash: ownerHash, isEnabled: true })
    )
  );

  const clientsData = [
    { firstName: 'Jasur', lastName: 'Nazarov', phone: '+998904444444' },
    { firstName: 'Malika', lastName: 'Rahimova', phone: '+998905555555' },
  ];
  const clientHash = await bcrypt.hash('client123', SALT_ROUNDS);
  const clients = await Promise.all(
    clientsData.map((c) =>
      User.create({ ...c, role: 'client', passwordHash: clientHash, isEnabled: true })
    )
  );

  const venues = [];
  for (const v of VENUES_DATA) {
    const owner = owners[v.ownerIndex];
    const venue = await Venue.create({
      owner: owner._id,
      name: v.name,
      description: `${v.name} — O'zbekistondagi eng yaxshi to'yxonalardan biri. Keng zal, professional xizmat.`,
      address: `${v.region} viloyati, ${v.district} tumani`,
      region: v.region,
      district: v.district,
      phone: owner.phone,
      images: PLACEHOLDER_IMAGES,
      pricePerSession: v.price,
      capacity: 200 + Math.floor(Math.random() * 300),
      rating: 0,
      totalBookings: 0,
      status: 'approved',
      isEnabled: true,
    });
    venues.push(venue);
  }

  const now = new Date();
  for (const venue of venues) {
    const bookingCount = 5 + Math.floor(Math.random() * 6);
    for (let i = 0; i < bookingCount; i++) {
      const dayOffset = Math.floor(Math.random() * 60) - 10;
      const date = new Date(now);
      date.setDate(date.getDate() + dayOffset);
      date.setHours(0, 0, 0, 0);
      const numSessions = 1 + Math.floor(Math.random() * 2);
      const shuffled = [...SESSIONS].sort(() => Math.random() - 0.5);
      const sessions = shuffled.slice(0, numSessions);
      const status = Math.random() > 0.3 ? 'confirmed' : 'pending';
      await Booking.create({
        venue: venue._id,
        clientName: `Mijoz ${i + 1}`,
        clientPhone: `+99890${1000000 + Math.floor(Math.random() * 9000000)}`,
        date,
        sessions,
        status,
        isExternalBooking: Math.random() > 0.7,
      });
      if (status === 'confirmed') {
        await Venue.findByIdAndUpdate(venue._id, { $inc: { totalBookings: 1 } });
      }
    }

    const reviewCount = 3 + Math.floor(Math.random() * 3);
    for (let r = 0; r < reviewCount; r++) {
      const client = clients[r % clients.length];
      await Review.create({
        venue: venue._id,
        author: client._id,
        authorName: `${client.firstName} ${client.lastName}`,
        rating: 4 + Math.floor(Math.random() * 2),
        comment: REVIEW_COMMENTS[r % REVIEW_COMMENTS.length],
      });
    }
    await updateVenueRating(venue._id);
  }

  console.log('\nSeed completed!');
  console.log('Admin:', admin.phone, '/ admin123');
  console.log('Owners: +998901111111, +998902222222, +998903333333 / owner123');
  console.log('Clients: +998904444444, +998905555555 / client123');
  console.log(`Venues: ${venues.length}, with bookings and reviews`);

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
