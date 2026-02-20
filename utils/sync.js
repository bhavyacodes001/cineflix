const cron = require('node-cron');
const axios = require('axios');
const Movie = require('../models/Movie');
const Booking = require('../models/Booking');
const { sendBookingReminder } = require('./email');

const TMDB_BASE = 'https://api.themoviedb.org/3';

async function syncTMDBMovies() {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    console.log('[Sync] TMDB_API_KEY not set, skipping movie sync');
    return;
  }

  console.log('[Sync] Starting TMDB movie sync...');
  let synced = 0;

  try {
    const endpoints = [
      '/movie/now_playing',
      '/movie/popular',
      '/movie/upcoming'
    ];

    for (const endpoint of endpoints) {
      const { data } = await axios.get(`${TMDB_BASE}${endpoint}`, {
        params: { api_key: apiKey, language: 'en-US', page: 1 }
      });

      for (const tmdbMovie of (data.results || []).slice(0, 10)) {
        const existing = await Movie.findOne({ cinemaApiId: `tmdb_${tmdbMovie.id}` });

        const movieData = {
          title: tmdbMovie.title,
          description: tmdbMovie.overview,
          poster: tmdbMovie.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbMovie.poster_path}` : null,
          releaseDate: tmdbMovie.release_date ? new Date(tmdbMovie.release_date) : new Date(),
          rating: tmdbMovie.vote_average ? `${tmdbMovie.vote_average}/10` : 'NR',
          genre: (tmdbMovie.genre_ids || []).map(mapGenreId).filter(Boolean),
          language: tmdbMovie.original_language || 'en',
          cinemaApiId: `tmdb_${tmdbMovie.id}`,
          lastUpdated: new Date(),
          isActive: true
        };

        if (existing) {
          await Movie.findByIdAndUpdate(existing._id, { $set: movieData });
        } else {
          movieData.status = 'now_showing';
          movieData.duration = 120;
          movieData.basePrice = 200;
          await Movie.create(movieData);
          synced++;
        }
      }
    }

    console.log(`[Sync] TMDB sync complete. ${synced} new movies added.`);
  } catch (err) {
    console.error('[Sync] TMDB sync failed:', err.message);
  }
}

async function sendUpcomingReminders() {
  console.log('[Reminders] Checking for upcoming show reminders...');

  try {
    const now = new Date();
    const threeHoursLater = new Date(now.getTime() + 3 * 60 * 60 * 1000);

    const bookings = await Booking.find({
      status: 'confirmed',
      showDate: { $gte: now, $lte: threeHoursLater },
      'notifications.reminder.sent': { $ne: true }
    })
      .populate('movie', 'title')
      .populate('theater', 'name')
      .populate('user', 'firstName lastName email');

    let sent = 0;
    for (const booking of bookings) {
      try {
        await sendBookingReminder(booking);
        booking.notifications.reminder = { sent: true, sentAt: new Date() };
        await booking.save();
        sent++;
      } catch (err) {
        console.error(`[Reminders] Failed for booking ${booking.bookingNumber}:`, err.message);
      }
    }

    console.log(`[Reminders] Sent ${sent} reminders.`);
  } catch (err) {
    console.error('[Reminders] Reminder check failed:', err.message);
  }
}

async function expireStaleBookings() {
  console.log('[Cleanup] Expiring stale pending bookings...');

  try {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);

    const result = await Booking.updateMany(
      { status: 'pending', bookingDate: { $lt: thirtyMinAgo } },
      { $set: { status: 'expired' } }
    );

    if (result.modifiedCount > 0) {
      console.log(`[Cleanup] Expired ${result.modifiedCount} stale bookings.`);
    }
  } catch (err) {
    console.error('[Cleanup] Expiry check failed:', err.message);
  }
}

function startScheduledJobs() {
  // Sync TMDB movies every 6 hours
  cron.schedule('0 */6 * * *', syncTMDBMovies);

  // Send reminders every 30 minutes
  cron.schedule('*/30 * * * *', sendUpcomingReminders);

  // Expire stale pending bookings every 10 minutes
  cron.schedule('*/10 * * * *', expireStaleBookings);

  console.log('[Scheduler] Cron jobs started: TMDB sync (6h), reminders (30m), booking expiry (10m)');
}

function mapGenreId(id) {
  const genres = {
    28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy',
    80: 'Crime', 99: 'Documentary', 18: 'Drama', 10751: 'Family',
    14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music',
    9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi', 53: 'Thriller',
    10752: 'War', 37: 'Western'
  };
  return genres[id] || null;
}

module.exports = { startScheduledJobs, syncTMDBMovies, sendUpcomingReminders, expireStaleBookings };
