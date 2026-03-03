const mongoose = require('mongoose');
const { CATEGORY_DEFAULTS } = require('../types');

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 120
    },
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true
    },
    sortOrder: {
      type: Number,
      required: true,
      default: CATEGORY_DEFAULTS.SORT_ORDER,
      min: 0
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

categorySchema.index({ restaurantId: 1, sortOrder: 1 }, { name: 'idx_category_restaurant_sort' });
categorySchema.index({ restaurantId: 1, isActive: 1, sortOrder: 1 }, { name: 'idx_category_restaurant_active_sort' });

module.exports = mongoose.model('Category', categorySchema);
