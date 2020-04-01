const mongoose = require("mongoose");

const AddressSchema = new mongoose.Schema(
  {
    is_default: {
      type: Boolean,
      default: false
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    line1: {
      type: String,
      required: ["Line 1 is required"]
    },
    line2: {
      type: String
    },
    zip: {
      type: String,
      required: ["ZIP is required"]
    },
    city: {
      type: String,
      required: ["City is required"]
    },
    state: {
      type: String,
      required: ["State is required"]
    },
    instructions: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Address", AddressSchema);
