const mongoose = require('mongoose');
const { DELIVERY_VEHICLE_TYPES } = require('../types');

const geoPointSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator(value) {
          if (!Array.isArray(value) || value.length !== 2) {
            return false;
          }

          const [lng, lat] = value;
          return lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
        },
        message: 'Geo coordinates must be [longitude, latitude] within valid ranges'
      }
    }
  },
  { _id: false }
);

const deliverymanProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    profile: {
      fullName: {
        type: String,
        required: true,
        trim: true,
        maxlength: 120
      },
      phone: {
        type: String,
        required: true,
        trim: true,
        maxlength: 30
      },
      avatarUrl: {
        type: String,
        default: null,
        trim: true,
        maxlength: 1200
      },
      vehicleType: {
        type: String,
        enum: Object.values(DELIVERY_VEHICLE_TYPES),
        default: DELIVERY_VEHICLE_TYPES.BIKE,
        required: true
      },
      vehicleNumber: {
        type: String,
        default: null,
        trim: true,
        maxlength: 50
      }
    },
    isOnline: {
      type: Boolean,
      required: true,
      default: false
    },
    isAvailable: {
      type: Boolean,
      required: true,
      default: false
    },
    currentLocation: {
      type: geoPointSchema,
      required: true,
      default: {
        type: 'Point',
        coordinates: [0, 0]
      }
    },
    currentLocationAccuracyMeters: {
      type: Number,
      default: null,
      min: 0
    },
    lastSeenAt: {
      type: Date,
      required: true,
      default: Date.now
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

deliverymanProfileSchema.index({ currentLocation: '2dsphere' }, { name: 'idx_deliveryman_geo_2dsphere' });
deliverymanProfileSchema.index({ isAvailable: 1 }, { name: 'idx_deliveryman_is_available' });
deliverymanProfileSchema.index({ isOnline: 1, isAvailable: 1, lastSeenAt: -1 }, { name: 'idx_deliveryman_online_available_seen' });
deliverymanProfileSchema.index({ userId: 1 }, { unique: true, name: 'uniq_deliveryman_user_id' });

module.exports = mongoose.model('DeliverymanProfile', deliverymanProfileSchema);
