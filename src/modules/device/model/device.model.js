const mongoose = require('mongoose');
const { DEVICE_TYPES } = require('../types');

const deviceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RefreshSession',
      required: true,
      unique: true,
      index: true
    },
    deviceId: {
      type: String,
      default: null,
      trim: true,
      maxlength: 200
    },
    pushToken: {
      type: String,
      default: null,
      trim: true,
      maxlength: 500
    },
    deviceType: {
      type: String,
      enum: Object.values(DEVICE_TYPES),
      required: true,
      default: DEVICE_TYPES.UNKNOWN,
      index: true
    },
    lastActive: {
      type: Date,
      required: true,
      default: Date.now,
      index: true
    },
    userAgent: {
      type: String,
      default: null,
      trim: true,
      maxlength: 500
    },
    ipAddress: {
      type: String,
      default: null,
      trim: true,
      maxlength: 120
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

deviceSchema.index({ userId: 1 }, { name: 'idx_device_user_id' });
deviceSchema.index({ userId: 1, lastActive: -1 }, { name: 'idx_device_user_last_active' });
deviceSchema.index({ pushToken: 1 }, { name: 'idx_device_push_token', sparse: true });
deviceSchema.index({ userId: 1, deviceId: 1 }, { name: 'idx_device_user_device_id' });

module.exports = mongoose.model('Device', deviceSchema);
