# Movie Ticket Booking System

A comprehensive movie ticket booking system built with the MERN stack (MongoDB, Express.js, React, Node.js) and TailwindCSS.

## Features

### Core Features
- **User Authentication**: Secure registration and login with JWT tokens
- **Movie Management**: Browse movies, view details, and search functionality
- **Theater Management**: Find theaters, view locations, and amenities
- **Showtime Selection**: View available showtimes for movies
- **Seat Selection**: Interactive seat selection with real-time availability
- **Payment Processing**: Secure payment integration with Stripe
- **Booking Management**: View, manage, and cancel bookings
- **Admin Panel**: Comprehensive admin dashboard for system management

### Advanced Features
- **Real-time Seat Availability**: Live updates of seat availability
- **Email Notifications**: Booking confirmations and updates
- **Responsive Design**: Mobile-first design with TailwindCSS
- **Search & Filtering**: Advanced search and filtering options
- **Analytics Dashboard**: Revenue and booking analytics
- **Multi-role Support**: User, Admin, and Theater Owner roles

## Tech Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM for MongoDB
- **JWT** - Authentication
- **Stripe** - Payment processing
- **Nodemailer** - Email notifications
- **Express Validator** - Input validation
- **Helmet** - Security middleware
- **CORS** - Cross-origin resource sharing

### Frontend
- **React 18** - UI library
- **TypeScript** - Type safety
- **React Router** - Client-side routing
- **React Query** - Data fetching and caching
- **React Hook Form** - Form management
- **Yup** - Schema validation
- **TailwindCSS** - Styling
- **Headless UI** - Accessible UI components
- **Heroicons** - Icon library
- **Stripe Elements** - Payment UI

## Project Structure

```
movie-ticket-booking-system/
├── client/                 # React frontend
│   ├── public/
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── contexts/       # React contexts
│   │   ├── pages/          # Page components
│   │   ├── utils/          # Utility functions
│   │   └── App.tsx
│   └── package.json
├── models/                 # MongoDB models
├── routes/                 # API routes
├── middleware/             # Custom middleware
├── server.js              # Main server file
├── package.json
└── README.md
```

## Installation & Setup

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (local or cloud)
- Stripe account (for payments)

### Backend Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd movie-ticket-booking-system
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   ```bash
   cp env.example .env
   ```
   
   Update the `.env` file with your configuration:
   ```env
   MONGODB_URI=mongodb://localhost:27017/movie-ticket-booking
   JWT_SECRET=your_jwt_secret_key_here
   PORT=5000
   STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
   STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_app_password
   CLIENT_URL=http://localhost:3000
   ```

4. **Start the server**
   ```bash
   npm run dev
   ```

### Frontend Setup

1. **Navigate to client directory**
   ```bash
   cd client
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   Create `.env` file in the client directory:
   ```env
   REACT_APP_API_URL=http://localhost:5000/api
   REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
   ```

4. **Start the development server**
   ```bash
   npm start
   ```

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update user profile

### Movies
- `GET /api/movies` - Get all movies
- `GET /api/movies/:id` - Get movie by ID
- `GET /api/movies/featured` - Get featured movies
- `POST /api/movies` - Create movie (Admin)

### Theaters
- `GET /api/theaters` - Get all theaters
- `GET /api/theaters/:id` - Get theater by ID
- `GET /api/theaters/nearby` - Get nearby theaters
- `POST /api/theaters` - Create theater

### Showtimes
- `GET /api/showtimes` - Get showtimes
- `GET /api/showtimes/:id` - Get showtime by ID
- `POST /api/showtimes` - Create showtime

### Bookings
- `POST /api/bookings` - Create booking
- `GET /api/bookings` - Get user bookings
- `GET /api/bookings/:id` - Get booking by ID
- `PUT /api/bookings/:id/cancel` - Cancel booking

### Payments
- `POST /api/payments/create-payment-intent` - Create payment intent
- `POST /api/payments/confirm-payment` - Confirm payment
- `POST /api/payments/refund` - Process refund

## Database Schema

### User Model
- Personal information (name, email, phone, date of birth)
- Authentication data (password, JWT tokens)
- Preferences and booking history
- Role-based access control

### Movie Model
- Basic information (title, description, genre, director)
- Media (poster, trailer, images)
- Metadata (duration, rating, release date)
- Pricing and status

### Theater Model
- Location and contact information
- Hall configurations and seat layouts
- Amenities and operating hours
- Owner information

### Showtime Model
- Movie and theater references
- Date, time, and duration
- Seat availability and pricing
- Booking status

### Booking Model
- User and showtime references
- Seat selections and pricing
- Payment information
- Status and cancellation data

## Security Features

- **JWT Authentication** - Secure token-based authentication
- **Password Hashing** - Bcrypt for password security
- **Input Validation** - Comprehensive input validation
- **Rate Limiting** - API rate limiting
- **CORS Protection** - Cross-origin request protection
- **Helmet Security** - Security headers
- **Stripe Integration** - Secure payment processing

## Development

### Running in Development Mode
```bash
# Backend
npm run dev

# Frontend (in separate terminal)
cd client
npm start
```

### Building for Production
```bash
# Backend
npm start

# Frontend
cd client
npm run build
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions, please contact the development team or create an issue in the repository.

## Roadmap

- [ ] Mobile app development
- [ ] Advanced analytics
- [ ] Social features
- [ ] Loyalty program
- [ ] Multi-language support
- [ ] Advanced seat selection
- [ ] Group bookings
- [ ] Subscription plans
