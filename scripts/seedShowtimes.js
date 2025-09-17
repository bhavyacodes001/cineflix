/* eslint-disable no-console */
require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');

const Movie = require(path.join(__dirname, '..', 'models', 'Movie'));
const Theater = require(path.join(__dirname, '..', 'models', 'Theater'));
const Showtime = require(path.join(__dirname, '..', 'models', 'Showtime'));

async function connect() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/movie-ticket-booking';
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000
  });
  console.log('✅ Connected to MongoDB');
}

function makeSimpleHallLayout(rows = 5, seatsPerRow = 10) {
  const layoutRows = [];
  const rowNames = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').slice(0, rows);
  for (const name of rowNames) {
    const seats = [];
    for (let n = 1; n <= seatsPerRow; n++) {
      let type = 'regular';
      if (n > seatsPerRow - 4) type = 'premium';
      if (n > seatsPerRow - 2) type = 'vip';
      seats.push({ row: name, number: n, type, price: type === 'vip' ? 600 : type === 'premium' ? 450 : 300 });
    }
    layoutRows.push({ name, seats });
  }
  return { rows: layoutRows };
}

async function ensureTheaters() {
  const existing = await Theater.find({ isActive: true });
  if (existing.length >= 5) return existing;

  const fakeOwnerId = new mongoose.Types.ObjectId();
  const templates = [
    {
      name: 'CinePlex Downtown',
      city: 'Mumbai', state: 'MH', lat: 19.076, lon: 72.8777,
      halls: [{ name: 'Hall 1', rows: 6, cols: 12 }]
    },
    {
      name: 'StarMax Cinema',
      city: 'Delhi', state: 'DL', lat: 28.6139, lon: 77.2090,
      halls: [{ name: 'Hall A', rows: 5, cols: 10 }, { name: 'Hall B', rows: 4, cols: 8 }]
    },
    {
      name: 'Galaxy Cinemas',
      city: 'Bengaluru', state: 'KA', lat: 12.9716, lon: 77.5946,
      halls: [{ name: 'Screen 1', rows: 7, cols: 12 }]
    },
    {
      name: 'Regal Multiplex',
      city: 'Hyderabad', state: 'TS', lat: 17.3850, lon: 78.4867,
      halls: [{ name: 'Prime', rows: 6, cols: 10 }]
    },
    {
      name: 'CityScreen',
      city: 'Sonipat', state: 'HR', lat: 28.9931, lon: 77.0151,
      halls: [{ name: 'Classic', rows: 5, cols: 10 }]
    }
  ];

  const created = [];
  for (const t of templates) {
    let theater = await Theater.findOne({ 'address.city': t.city, name: t.name });
    if (!theater) {
      theater = new Theater({
        name: t.name,
        address: { street: 'Main Road', city: t.city, state: t.state, zipCode: '000000', country: 'India' },
        contact: { phone: '+91-99999-99999', email: `${t.name.replace(/\s+/g,'').toLowerCase()}@cineplex.test` },
        location: { latitude: t.lat, longitude: t.lon },
        halls: t.halls.map(h => ({ name: h.name, capacity: h.rows * h.cols, layout: makeSimpleHallLayout(h.rows, h.cols), amenities: ['Reclining Seats'] })),
        amenities: ['Parking', 'Concessions', 'Wheelchair Accessible'],
        operatingHours: {
          monday: { open: '09:00', close: '23:00' },
          tuesday: { open: '09:00', close: '23:00' },
          wednesday: { open: '09:00', close: '23:00' },
          thursday: { open: '09:00', close: '23:00' },
          friday: { open: '09:00', close: '23:59' },
          saturday: { open: '09:00', close: '23:59' },
          sunday: { open: '09:00', close: '23:00' }
        },
        owner: fakeOwnerId,
        isActive: true
      });
      await theater.save();
      console.log('✅ Created sample theater:', theater.name, '-', t.city);
    }
    created.push(theater);
  }

  return created;
}

function toEndTime(startTime, durationMins = 120) {
  const [hh, mm] = startTime.split(':').map((n) => parseInt(n, 10));
  const start = new Date(0, 0, 0, hh, mm, 0, 0);
  const end = new Date(start.getTime() + durationMins * 60000);
  const eh = String(end.getHours()).padStart(2, '0');
  const em = String(end.getMinutes()).padStart(2, '0');
  return `${eh}:${em}`;
}

async function createShowtimeIfMissing({ movie, theater, hallName, date, time, basePrice }) {
  const exists = await Showtime.findOne({
    movie: movie._id,
    theater: theater._id,
    'hall.name': hallName,
    date: new Date(date),
    time
  });
  if (exists) return null;

  const hallDoc = theater.halls.find((h) => h.name === hallName) || theater.halls[0];
  const availableSeats = {
    regular: hallDoc.layout.rows.reduce((t, r) => t + r.seats.filter((s) => s.type === 'regular').length, 0),
    premium: hallDoc.layout.rows.reduce((t, r) => t + r.seats.filter((s) => s.type === 'premium').length, 0),
    vip: hallDoc.layout.rows.reduce((t, r) => t + r.seats.filter((s) => s.type === 'vip').length, 0),
    wheelchair: hallDoc.layout.rows.reduce((t, r) => t + r.seats.filter((s) => s.type === 'wheelchair').length, 0)
  };

  const duration = movie.duration || 120;
  const showtime = new Showtime({
    movie: movie._id,
    theater: theater._id,
    hall: { name: hallDoc.name, hallId: hallDoc._id },
    date: new Date(date),
    time,
    endTime: toEndTime(time, duration),
    price: {
      regular: basePrice,
      premium: Math.round(basePrice * 1.4),
      vip: Math.round(basePrice * 1.8)
    },
    availableSeats
  });

  await showtime.save();
  return showtime;
}

async function run() {
  try {
    await connect();

    const theaters = await ensureTheaters();
    const movies = await Movie.find({ isActive: true }).sort({ releaseDate: -1 }).limit(6);
    if (movies.length === 0) {
      console.log('No active movies found. Seed movies first.');
      return;
    }

    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    const dayAfter = new Date();
    dayAfter.setDate(today.getDate() + 2);
    const dateStrs = [today.toISOString().slice(0, 10), tomorrow.toISOString().slice(0, 10), dayAfter.toISOString().slice(0, 10)];
    // Different time patterns per theater for variety
    const timePatterns = [
      ['10:00', '13:30', '17:00', '20:30'],
      ['09:45', '12:15', '15:00', '18:30', '21:45'],
      ['11:15', '14:00', '16:45', '19:30'],
      ['12:00', '15:30', '19:00', '22:15'],
      ['08:30', '12:00', '16:00', '20:00']
    ];

    let created = 0;
    let theaterIndex = 0;
    for (const theater of theaters) {
      const times = timePatterns[theaterIndex % timePatterns.length];
      theaterIndex++;
      for (const movie of movies) {
        for (const d of dateStrs) {
          for (const t of times) {
            const st = await createShowtimeIfMissing({
              movie,
              theater,
              hallName: theater.halls[0]?.name || 'Hall 1',
              date: d,
              time: t,
              basePrice: movie.basePrice || 300 // Use reasonable default price
            });
            if (st) created += 1;
          }
        }
      }
    }

    console.log(`✅ Showtimes seeding completed. New showtimes created: ${created}`);
  } catch (err) {
    console.error('❌ Seeding showtimes failed:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  run();
}

module.exports = { run };


