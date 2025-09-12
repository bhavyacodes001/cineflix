const mongoose = require('mongoose');

const seatSchema = new mongoose.Schema({
  row: {
    type: String,
    required: true
  },
  number: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    enum: ['regular', 'premium', 'vip', 'wheelchair'],
    default: 'regular'
  },
  price: {
    type: Number,
    required: true,
    min: 0
  }
});

const hallSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Hall name is required']
  },
  capacity: {
    type: Number,
    required: [true, 'Hall capacity is required'],
    min: [1, 'Capacity must be at least 1']
  },
  layout: {
    rows: [{
      name: String,
      seats: [seatSchema]
    }]
  },
  amenities: [{
    type: String,
    enum: ['3D', 'IMAX', 'Dolby Atmos', 'Reclining Seats', 'Premium Sound']
  }]
});

const theaterSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Theater name is required'],
    trim: true,
    maxlength: [100, 'Theater name cannot exceed 100 characters']
  },
  address: {
    street: {
      type: String,
      required: [true, 'Street address is required']
    },
    city: {
      type: String,
      required: [true, 'City is required']
    },
    state: {
      type: String,
      required: [true, 'State is required']
    },
    zipCode: {
      type: String,
      required: [true, 'ZIP code is required']
    },
    country: {
      type: String,
      required: [true, 'Country is required'],
      default: 'USA'
    }
  },
  contact: {
    phone: {
      type: String,
      required: [true, 'Phone number is required']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true
    },
    website: String
  },
  location: {
    latitude: {
      type: Number,
      min: -90,
      max: 90
    },
    longitude: {
      type: Number,
      min: -180,
      max: 180
    }
  },
  halls: [hallSchema],
  amenities: [{
    type: String,
    enum: [
      'Parking', 'Food Court', 'Concessions', 'Arcade', 'Gift Shop',
      'Wheelchair Accessible', 'Hearing Impaired', 'Senior Discounts'
    ]
  }],
  operatingHours: {
    monday: { open: String, close: String },
    tuesday: { open: String, close: String },
    wednesday: { open: String, close: String },
    thursday: { open: String, close: String },
    friday: { open: String, close: String },
    saturday: { open: String, close: String },
    sunday: { open: String, close: String }
  },
  images: [String],
  isActive: {
    type: Boolean,
    default: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  cinemaApiId: {
    type: String,
    unique: true,
    sparse: true
  }
}, {
  timestamps: true
});

// Index for location-based searches
theaterSchema.index({ 'location.latitude': 1, 'location.longitude': 1 });
theaterSchema.index({ 'address.city': 1, 'address.state': 1 });
theaterSchema.index({ isActive: 1 });

// Virtual for full address
theaterSchema.virtual('fullAddress').get(function() {
  return `${this.address.street}, ${this.address.city}, ${this.address.state} ${this.address.zipCode}`;
});

// Method to get total capacity
theaterSchema.methods.getTotalCapacity = function() {
  return this.halls.reduce((total, hall) => total + hall.capacity, 0);
};

// Method to check if theater is open at given time
theaterSchema.methods.isOpenAt = function(date) {
  const day = date.toLocaleLowerCase().slice(0, 3) + 'day';
  const dayKey = day === 'monday' ? 'monday' :
                 day === 'tuesday' ? 'tuesday' :
                 day === 'wednesday' ? 'wednesday' :
                 day === 'thursday' ? 'thursday' :
                 day === 'friday' ? 'friday' :
                 day === 'saturday' ? 'saturday' : 'sunday';
  
  const hours = this.operatingHours[dayKey];
  if (!hours || !hours.open || !hours.close) return false;
  
  const currentTime = date.toTimeString().slice(0, 5);
  return currentTime >= hours.open && currentTime <= hours.close;
};

module.exports = mongoose.model('Theater', theaterSchema);
