const mongoose = require('mongoose');
const {
  NOTIFICATION_TYPES,
  NOTIFICATION_CHANNEL_STATUSES
} = require('../types');

const notificationChannelSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: Object.values(NOTIFICATION_CHANNEL_STATUSES),
      required: true,
      default: NOTIFICATION_CHANNEL_STATUSES.PENDING
    },
    attemptedAt: {
      type: Date,
      default: null
    },
    deliveredAt: {
      type: Date,
      default: null
    },
    errorMessage: {
      type: String,
      default: null,
      trim: true,
      maxlength: 500
    }
  },
  { _id: false }
);

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    type: {
      type: String,
      enum: Object.values(NOTIFICATION_TYPES),
      required: true
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    isUnread: {
      type: Boolean,
      required: true,
      default: true
    },
    readAt: {
      type: Date,
      default: null
    },
    sourceEvent: {
      name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
      },
      requestId: {
        type: String,
        default: null,
        trim: true,
        maxlength: 64
      },
      emittedAt: {
        type: Date,
        default: Date.now
      }
    },
    delivery: {
      socket: {
        type: notificationChannelSchema,
        default: () => ({})
      },
      push: {
        type: notificationChannelSchema,
        default: () => ({})
      }
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

notificationSchema.index({ userId: 1 }, { name: 'idx_notification_user' });
notificationSchema.index({ userId: 1, isUnread: 1, createdAt: -1 }, { name: 'idx_notification_user_unread_created' });
notificationSchema.index({ type: 1, createdAt: -1 }, { name: 'idx_notification_type_created' });

module.exports = mongoose.model('Notification', notificationSchema);
