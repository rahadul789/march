const mongoose = require('mongoose');
const { SESSION_STATUSES } = require('../types');

const refreshSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    tokenIdHash: {
      type: String,
      required: true
    },
    tokenVersion: {
      type: Number,
      default: 1,
      min: 1
    },
    status: {
      type: String,
      enum: Object.values(SESSION_STATUSES),
      default: SESSION_STATUSES.ACTIVE,
      index: true
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true
    },
    lastUsedAt: {
      type: Date,
      default: null
    },
    rotatedAt: {
      type: Date,
      default: null
    },
    revokedAt: {
      type: Date,
      default: null
    },
    revokeReason: {
      type: String,
      default: null
    },
    device: {
      deviceId: {
        type: String,
        default: null,
        maxlength: 200
      },
      platform: {
        type: String,
        default: null,
        maxlength: 40
      },
      userAgent: {
        type: String,
        default: null,
        maxlength: 500
      },
      ipAddress: {
        type: String,
        default: null,
        maxlength: 120
      },
      pushToken: {
        type: String,
        default: null,
        maxlength: 500
      }
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

refreshSessionSchema.index(
  { userId: 1, status: 1 },
  { name: 'idx_refresh_session_user_status' }
);

refreshSessionSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, name: 'ttl_refresh_session_expiry' }
);

refreshSessionSchema.index(
  { userId: 1, tokenIdHash: 1 },
  { name: 'idx_refresh_session_user_token_hash' }
);

module.exports = mongoose.model('RefreshSession', refreshSessionSchema);
