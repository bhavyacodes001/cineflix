# CineFlix — Movie Ticket Booking System

A full-stack movie ticket booking system built with the MERN stack (MongoDB, Express.js, React, Node.js).

## Features

- **Movie Browsing** — Browse popular, now playing, and upcoming movies via TMDB integration
- **User Authentication** — Secure JWT-based registration, login, and profile management
- **Interactive Seat Selection** — Real-time seat map with VIP, Premium, and Regular tiers
- **Showtime Management** — View showtimes by date, city, and time slot with calendar view
- **Payment Processing** — Stripe integration for secure card payments
- **Booking Management** — View, filter, and cancel bookings with automatic refund calculation
- **Admin Dashboard** — Revenue analytics, user management, and booking reports
- **Multi-Role Support** — User, Admin, and Theater Owner roles with granular permissions

## Tech Stack

### Backend
- **Node.js** + **Express.js** — REST API
- **MongoDB** + **Mongoose** — Database & ODM
- **JWT** + **bcrypt** — Authentication & password hashing
- **Stripe** — Payment gateway
- **Helmet** + **express-rate-limit** — Security
- **express-validator** — Input validation
- **Nodemailer** — Email notifications

### Frontend
- **React 19** + **TypeScript** — UI
- **React Router v7** — Client-side routing
- **Axios** — HTTP client
- **Stripe Elements** — Payment UI

## Project Structure

```
├── client/                  # React frontend
│   ├── src/
│   │   ├── components/      # Navbar, LoadingSpinner, AnimationWrapper
│   │   ├── pages/           # Home, Movies, MovieDetails, Showtimes,
│   │   │                    # SeatSelection, Payment, BookingSuccess,
│   │   │                    # MyBookings, Profile, Login, Register
│   │   ├── styles/          # CSS files
│   │   ├── utils/           # Axios API client
│   │   └── App.tsx          # Routes
│   └── package.json
├── models/                  # Mongoose schemas
│   ├── User.js              # Auth, roles, preferences
│   ├── Movie.js             # Movie data + TMDB integration
│   ├── Theater.js           # Theaters, halls, seat layouts
│   ├── Showtime.js          # Schedules, pricing, atomic seat booking
│   └── Booking.js           # Tickets, payments, cancellations
├── routes/                  # Express API routes
│   ├── auth.js              # Register, login, profile, password reset
│   ├── movies.js            # CRUD + TMDB proxy endpoints
│   ├── theaters.js          # Theater management
│   ├── showtimes.js         # Showtime CRUD + seat maps
│   ├── bookings.js          # Booking lifecycle
│   ├── payments.js          # Stripe payments, refunds, webhooks
│   └── admin.js             # Dashboard, analytics, user management
├── middleware/
│   └── auth.js              # JWT verification + role authorization
├── scripts/
│   ├── seedMovies.js        # Seed movies from TMDB
│   └── seedShowtimes.js     # Seed theaters & showtimes
├── server.js                # Express app entry point
└── package.json
```

## Getting Started

### Prerequisites

- Node.js v16+
- MongoDB (local or [MongoDB Atlas](https://www.mongodb.com/atlas) free tier)
- Stripe account (for payments, optional for dev)
- TMDB API key (free at [themoviedb.org](https://www.themoviedb.org/settings/api))

### 1. Clone & Install

```bash
git clone https://github.com/bhavyacodes001/cineflix.git
cd cineflix

# Install backend dependencies
npm install

# Install frontend dependencies
cd client && npm install && cd ..
```

### 2. Configure Environment

Create a `.env` file in the root directory:

```env
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/movie-ticket-booking
JWT_SECRET=your_jwt_secret_key
TMDB_API_KEY=your_tmdb_api_key
STRIPE_SECRET_KEY=sk_test_your_stripe_key        # optional
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret   # optional
PORT=5001
CLIENT_URL=http://localhost:3000
```

### 3. Run

```bash
# Start backend (port 5001)
npm start

# In a separate terminal — start frontend (port 3000)
cd client && npm start
```

Open http://localhost:3000 in your browser.

### 4. Seed Data (Optional)

```bash
# Seed movies from TMDB
node scripts/seedMovies.js

# Seed theaters & showtimes
node scripts/seedShowtimes.js
```

## API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/register` | Register user | Public |
| POST | `/api/auth/login` | Login | Public |
| GET | `/api/auth/me` | Current user | Token |
| PUT | `/api/auth/profile` | Update profile | Token |
| GET | `/api/movies` | List movies | Public |
| GET | `/api/movies/:id` | Movie details | Public |
| GET | `/api/movies/tmdb/popular` | TMDB popular movies | Public |
| GET | `/api/movies/tmdb/search` | Search TMDB | Public |
| GET | `/api/theaters` | List theaters | Public |
| GET | `/api/showtimes/movie/:id` | Showtimes for movie | Public |
| POST | `/api/bookings` | Create booking | Token |
| GET | `/api/bookings` | User bookings | Token |
| PUT | `/api/bookings/:id/cancel` | Cancel booking | Token |
| POST | `/api/payments/create-payment-intent` | Stripe payment | Token |
| POST | `/api/payments/confirm-payment` | Confirm payment | Token |
| GET | `/api/admin/dashboard` | Admin stats | Admin |

## Security

- Atomic seat booking with MongoDB `findOneAndUpdate` to prevent double-booking
- Cryptographic booking number generation (no collisions)
- Password hashing with bcrypt (12 salt rounds)
- JWT token authentication with 7-day expiry
- Rate limiting (1000 req / 15 min)
- Helmet security headers
- Input validation on all endpoints
- Stripe webhook signature verification

## License

MIT
