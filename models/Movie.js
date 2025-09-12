const mongoose = require('mongoose');

const movieSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Movie title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Movie description is required'],
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  genre: [{
    type: String,
    required: true,
    enum: [
      'Action', 'Adventure', 'Animation', 'Biography', 'Comedy', 'Crime', 
      'Documentary', 'Drama', 'Family', 'Fantasy', 'Film-Noir', 'History', 
      'Horror', 'Music', 'Musical', 'Mystery', 'Romance', 'Sci-Fi', 
      'Sport', 'Thriller', 'War', 'Western'
    ]
  }],
  director: {
    type: String,
    required: [true, 'Director name is required'],
    trim: true
  },
  cast: [{
    name: { type: String, required: true },
    role: String,
    image: String
  }],
  releaseDate: {
    type: Date,
    required: [true, 'Release date is required']
  },
  duration: {
    type: Number, // in minutes
    required: [true, 'Movie duration is required'],
    min: [1, 'Duration must be at least 1 minute']
  },
  rating: {
    type: String,
    required: [true, 'Movie rating is required'],
    enum: ['G', 'PG', 'PG-13', 'R', 'NC-17', 'NR']
  },
  imdbRating: {
    type: Number,
    min: 0,
    max: 10
  },
  poster: {
    type: String,
    required: [true, 'Movie poster is required']
  },
  trailer: {
    type: String,
    validate: {
      validator: function(v) {
        return !v || /^https?:\/\/.+/.test(v);
      },
      message: 'Trailer must be a valid URL'
    }
  },
  images: [String],
  status: {
    type: String,
    enum: ['upcoming', 'now_showing', 'ended'],
    default: 'upcoming'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  basePrice: {
    type: Number,
    required: [true, 'Base price is required'],
    min: [0, 'Price cannot be negative']
  },
  language: {
    type: String,
    required: [true, 'Language is required'],
    default: 'English'
  },
  subtitles: [String],
  cinemaApiId: {
    type: String,
    unique: true,
    sparse: true // allows multiple null values
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for search functionality
movieSchema.index({ title: 'text', description: 'text', genre: 'text' });
movieSchema.index({ releaseDate: 1 });
movieSchema.index({ status: 1, isActive: 1 });

// Virtual for formatted duration
movieSchema.virtual('formattedDuration').get(function() {
  const hours = Math.floor(this.duration / 60);
  const minutes = this.duration % 60;
  return `${hours}h ${minutes}m`;
});

// Method to check if movie is currently showing
movieSchema.methods.isCurrentlyShowing = function() {
  const now = new Date();
  return this.status === 'now_showing' && this.isActive;
};

module.exports = mongoose.model('Movie', movieSchema);
