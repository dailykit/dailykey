const mongoose = require("mongoose");

const CardSchema = new mongoose.Schema(
  {
    is_default: {
      type: Boolean,
      default: false
    },
    pm_id: {
      type: String,
      required: ["Stripe payment method ID is required"]
    },
    stripe_id: {
      type: String
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    brand: {
      type: String
    },
    country: {
      type: String
    },
    exp_month: {
      type: Number
    },
    exp_year: {
      type: Number
    },
    funding: {
      type: String
    },
    last4: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Card", CardSchema);
