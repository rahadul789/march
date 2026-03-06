const mongoose = require('mongoose');

const orderAssignmentLockSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      unique: true
    },
    lockToken: {
      type: String,
      required: true,
      trim: true,
      maxlength: 64
    },
    lockedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    acquiredAt: {
      type: Date,
      required: true,
      default: Date.now
    },
    expiresAt: {
      type: Date,
      required: true
    },
    lastAttemptAt: {
      type: Date,
      default: Date.now
    },
    attemptCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

orderAssignmentLockSchema.index({ orderId: 1 }, { unique: true, name: 'uniq_assignment_lock_order' });
orderAssignmentLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'ttl_assignment_lock_expires' });
orderAssignmentLockSchema.index({ lockedByUserId: 1, acquiredAt: -1 }, { name: 'idx_assignment_lock_actor_time' });

module.exports = mongoose.model('OrderAssignmentLock', orderAssignmentLockSchema);
