const mongoose = require('mongoose');
const { MENU_DEFAULTS } = require('../types');

const menuSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 160
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 3000
    },
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    discount: {
      type: Number,
      required: true,
      default: MENU_DEFAULTS.DISCOUNT_PERCENT,
      min: 0,
      max: 100
    },
    isAvailable: {
      type: Boolean,
      required: true,
      default: true
    },
    preparationTime: {
      type: Number,
      required: true,
      default: MENU_DEFAULTS.PREPARATION_TIME_MINUTES,
      min: 1,
      max: 240
    },
    image: {
      type: String,
      default: null,
      trim: true,
      maxlength: 1200
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

menuSchema.index({ restaurantId: 1, categoryId: 1 }, { name: 'idx_menu_restaurant_category' });
menuSchema.index({ restaurantId: 1, isAvailable: 1, categoryId: 1 }, { name: 'idx_menu_read_path' });
menuSchema.index({ restaurantId: 1, isAvailable: 1, createdAt: -1 }, { name: 'idx_menu_restaurant_available_created' });
menuSchema.index({ name: 'text', description: 'text' }, { name: 'idx_menu_text_search' });

module.exports = mongoose.model('Menu', menuSchema);
