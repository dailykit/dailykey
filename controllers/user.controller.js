const User = require("../models/user.model");
const Address = require("../models/address.model");
const axios = require("axios");
const stripe = require("stripe")(process.env.STRIPE_SECRET);
const { charge } = require("../utils");

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    let url = `http://${process.env.KEYCLOAK_IP}/auth/realms/consumers/protocol/openid-connect/token`;
    const response = await axios({
      url,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      data: `grant_type=password&client_id=restaurantmealkit&username=${email}&password=${password}&scope=openid`
    });
    const data = response.data;
    const user = await User.findOne({ email });
    data.id = user._id;
    data.name = user.firstname + " " + user.lastname;
    if (!user.addresses.length) data.redirect = true;
    return res.json({
      success: true,
      message: "Logged in",
      data
    });
  } catch (err) {
    return res.json({
      success: false,
      message: err.message,
      data: null
    });
  }
};

const refreshToken = async (req, res) => {
  try {
    const { token } = req.body;
    let url = `http://${process.env.KEYCLOAK_IP}/auth/realms/consumers/protocol/openid-connect/token`;
    const response = await axios({
      url,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      data: `grant_type=refresh_token&client_id=restaurantmealkit&refresh_token=${token}`
    });
    return res.json({
      success: true,
      message: "Token refreshed",
      data: response.data
    });
  } catch (err) {
    return res.json({
      success: false,
      message: err.message,
      data: null
    });
  }
};

const signup = async (req, res) => {
  try {
    const { email, keycloak_id, firstname, lastname } = req.body;
    const doc = await User.findOne({ email });
    if (doc) {
      throw Error("That email is already in use!");
    }
    const user = new User({
      email,
      firstname,
      lastname,
      keycloak_id
    });
    const customer = await stripe.customers.create({ email });
    user.stripe_id = customer.id;
    await user.save();
    return res.json({
      success: true,
      message: "Account created",
      data: {
        user
      }
    });
  } catch (err) {
    return res.json({
      success: false,
      message: err.message,
      data: null
    });
  }
};

const fetch = async (req, res) => {
  try {
    const user = await User.findOne({ keycloak_id: req.params.id })
      .populate("addresses")
      .populate("cards");
    if (!user) {
      throw Error("No such user exists!");
    }
    return res.json({
      success: true,
      message: "User found!",
      data: {
        user
      }
    });
  } catch (err) {
    return res.json({
      success: false,
      message: err.message,
      data: null
    });
  }
};

const paymentIntent = async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.body.id });
    const intent = await stripe.setupIntents.create({
      customer: user.stripe_id
    });
    return res.json({
      success: true,
      message: "Intent created",
      data: {
        secret: intent.client_secret
      }
    });
  } catch (err) {
    return res.json({
      success: false,
      message: err.message,
      data: null
    });
  }
};

const chargeUser = async (req, res) => {
  try {
    const user = await User.findOne({ _id: "5e80b0af1972a41cacd4b762" });
    const result = await charge(user.stripe_id, user.cards[0], 1, "ORDER_ID");
    console.log(result);
    return res.json({
      success: true,
      message: "User charged",
      data: null
    });
  } catch (err) {
    return res.json({
      success: false,
      message: err.message,
      data: null
    });
  }
};

module.exports = {
  login,
  fetch,
  signup,
  paymentIntent,
  refreshToken,
  chargeUser
};
