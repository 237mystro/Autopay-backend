const mongoose = require('mongoose');

const LocationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a location name'],
    unique: true,
    trim: true,
    maxlength: [100, 'Location name cannot be more than 100 characters']
  },
  address: {
    type: String,
    required: [true, 'Please add an address']
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: true
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      index: '2dsphere',
      required: true
    }
  },
  radius: {
    type: Number, // in meters
    default: 100,
    min: 10,
    max: 1000
  },
  qrCode: {
    type: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Create geospatial index
LocationSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Location', LocationSchema);