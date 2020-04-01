const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    firstname: {
      type: String,
      required: ["Firstname is required"]
    },
    lastname: {
      type: String
    },
    phone: {
      type: String,
      required: ["Phone number is required"]
    },
    email: {
      type: String,
      required: ["Email is required"]
    },
    password: {
      type: String,
      required: ["Password is required"]
    },
    keycloak_id: {
      type: String,
      required: ["Keycloak ID is required"]
    },
    stripe_id: {
      type: String
    },
    cards: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Card"
      }
    ],
    addresses: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Address"
      }
    ]
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("User", UserSchema);
