const mongoose = require('mongoose');

const orderSequenceSchema = new mongoose.Schema(
  {
    dateKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 8
    },
    sequence: {
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

orderSequenceSchema.index({ dateKey: 1 }, { unique: true, name: 'uniq_order_sequence_date_key' });

module.exports = mongoose.model('OrderSequence', orderSequenceSchema);
