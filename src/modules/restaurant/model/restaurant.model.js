const mongoose = require('mongoose');
const { RESTAURANT_APPROVAL_STATUSES } = require('../types');

const addressSchema = new mongoose.Schema(
  {
    fullAddress: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500
    },
    city: {
      type: String,
      default: null,
      trim: true,
      maxlength: 120
    },
    state: {
      type: String,
      default: null,
      trim: true,
      maxlength: 120
    },
    country: {
      type: String,
      default: null,
      trim: true,
      maxlength: 120
    },
    postalCode: {
      type: String,
      default: null,
      trim: true,
      maxlength: 20
    }
  },
  { _id: false }
);

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

const restaurantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 160
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 3000
    },
    address: {
      type: addressSchema,
      required: true
    },
    geoLocation: {
      type: geoPointSchema,
      required: true
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    approvalStatus: {
      type: String,
      enum: Object.values(RESTAURANT_APPROVAL_STATUSES),
      default: RESTAURANT_APPROVAL_STATUSES.PENDING,
      index: true
    },
    commissionRate: {
      type: Number,
      required: true,
      default: 15,
      min: 0,
      max: 100
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true
    },
    deletedAt: {
      type: Date,
      default: null
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

restaurantSchema.index({ geoLocation: '2dsphere' }, { name: 'idx_restaurant_geo_2dsphere' });
restaurantSchema.index({ ownerId: 1 }, { name: 'idx_restaurant_owner_id' });
restaurantSchema.index({ approvalStatus: 1, isActive: 1, isDeleted: 1 }, { name: 'idx_restaurant_visibility' });
restaurantSchema.index({ name: 'text', description: 'text', 'address.fullAddress': 'text' }, { name: 'idx_restaurant_text_search' });

module.exports = mongoose.model('Restaurant', restaurantSchema);
