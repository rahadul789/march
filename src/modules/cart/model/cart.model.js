const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema(
  {
    menuId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Menu',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    nameSnapshot: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160
    },
    imageSnapshot: {
      type: String,
      default: null,
      trim: true,
      maxlength: 1200
    },
    preparationTimeSnapshot: {
      type: Number,
      required: true,
      min: 1,
      max: 240
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0
    },
    unitDiscount: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    lineSubtotal: {
      type: Number,
      required: true,
      min: 0
    },
    lineDiscount: {
      type: Number,
      required: true,
      min: 0
    },
    lineTotal: {
      type: Number,
      required: true,
      min: 0
    }
  },
  {
    _id: false
  }
);

const cartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true
    },
    active: {
      type: Boolean,
      required: true,
      default: true
    },
    items: {
      type: [cartItemSchema],
      default: []
    },
    totals: {
      subtotal: {
        type: Number,
        required: true,
        default: 0
      },
      discountTotal: {
        type: Number,
        required: true,
        default: 0
      },
      payableTotal: {
        type: Number,
        required: true,
        default: 0
      },
      totalItems: {
        type: Number,
        required: true,
        default: 0
      }
    },
    isLocked: {
      type: Boolean,
      required: true,
      default: false
    },
    lockedAt: {
      type: Date,
      default: null
    },
    lockExpiresAt: {
      type: Date,
      default: null
    },
    lastRecalculatedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

cartSchema.index(
  { userId: 1, restaurantId: 1, active: 1 },
  {
    unique: true,
    partialFilterExpression: { active: true },
    name: 'uniq_cart_user_restaurant_active'
  }
);
cartSchema.index({ userId: 1, active: 1, updatedAt: -1 }, { name: 'idx_cart_user_active_updated' });
cartSchema.index({ restaurantId: 1, active: 1 }, { name: 'idx_cart_restaurant_active' });

module.exports = mongoose.model('Cart', cartSchema);
