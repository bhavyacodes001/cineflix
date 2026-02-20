import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import './styles/animations.css';

// Components
import Navbar from './components/Layout/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Movies from './pages/Movies';
import MovieDetails from './pages/MovieDetails';
import Showtimes from './pages/Showtimes';
import SeatSelection from './pages/SeatSelection';
import Payment from './pages/Payment';
import BookingSuccess from './pages/BookingSuccess';
import MyBookings from './pages/MyBookings';
import Profile from './pages/Profile';
import AdminDashboard from './pages/AdminDashboard';

function App() {
  return (
    <Router>
      <div className="App">
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/movies" element={<Movies />} />
          <Route path="/movies/:id" element={<MovieDetails />} />
          <Route path="/movies/tmdb/:id" element={<MovieDetails />} />
          <Route path="/showtimes" element={<Showtimes />} />
          <Route path="/showtimes/:id" element={<SeatSelection />} />
          <Route path="/payment" element={<Payment />} />
          <Route path="/booking-success" element={<BookingSuccess />} />
          <Route path="/bookings" element={<MyBookings />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
