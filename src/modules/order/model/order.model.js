const mongoose = require('mongoose');
const {
  ORDER_STATUSES,
  COMMISSION_SETTLEMENT_STATUSES,
  ORDER_DEFAULTS
} = require('../types');

const orderItemSnapshotSchema = new mongoose.Schema(
  {
    menuId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Menu',
      required: true
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 3000
    },
    image: {
      type: String,
      default: null,
      trim: true,
      maxlength: 1200
    },
    preparationTime: {
      type: Number,
      required: true,
      min: 1,
      max: 240
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
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
  { _id: false }
);

const statusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      required: true,
      enum: Object.values(ORDER_STATUSES)
    },
    note: {
      type: String,
      default: null,
      trim: true,
      maxlength: 500
    },
    changedAt: {
      type: Date,
      required: true,
      default: Date.now
    }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 32
    },
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
    status: {
      type: String,
      required: true,
      enum: Object.values(ORDER_STATUSES),
      default: ORDER_STATUSES.PLACED
    },
    items: {
      type: [orderItemSnapshotSchema],
      required: true,
      default: []
    },
    pricing: {
      currency: {
        type: String,
        required: true,
        default: ORDER_DEFAULTS.CURRENCY,
        trim: true,
        maxlength: 8
      },
      subtotal: {
        type: Number,
        required: true,
        min: 0
      },
      discountTotal: {
        type: Number,
        required: true,
        min: 0
      },
      deliveryFee: {
        type: Number,
        required: true,
        min: 0,
        default: 0
      },
      vat: {
        type: Number,
        required: true,
        min: 0,
        default: 0
      },
      payableTotal: {
        type: Number,
        required: true,
        min: 0
      },
      grandTotal: {
        type: Number,
        required: true,
        min: 0
      },
      totalItems: {
        type: Number,
        required: true,
        min: 0
      }
    },
    commission: {
      ratePercent: {
        type: Number,
        required: true,
        min: 0,
        max: 100
      },
      amount: {
        type: Number,
        required: true,
        min: 0
      },
      settlementStatus: {
        type: String,
        required: true,
        enum: Object.values(COMMISSION_SETTLEMENT_STATUSES),
        default: COMMISSION_SETTLEMENT_STATUSES.PENDING
      },
      placeholder: {
        type: Boolean,
        required: true,
        default: true
      }
    },
    cartSnapshotMeta: {
      cartId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Cart',
        required: true
      },
      lockedAt: {
        type: Date,
        default: null
      },
      lockExpiresAt: {
        type: Date,
        default: null
      },
      recalculatedAt: {
        type: Date,
        default: null
      }
    },
    statusHistory: {
      type: [statusHistorySchema],
      default: []
    },
    notes: {
      type: String,
      default: null,
      trim: true,
      maxlength: 500
    },
    placedAt: {
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

orderSchema.index({ restaurantId: 1, status: 1 }, { name: 'idx_order_restaurant_status' });
orderSchema.index({ userId: 1 }, { name: 'idx_order_user_id' });
orderSchema.index({ placedAt: -1 }, { name: 'idx_order_placed_at' });
orderSchema.index({ createdAt: -1 }, { name: 'idx_order_created_at' });

module.exports = mongoose.model('Order', orderSchema);
