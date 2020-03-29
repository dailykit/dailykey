const stripe = require("stripe")(process.env.STRIPE_SECRET);

const charge = async (stripe_id, method, amount, order_id) => {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100,
      currency: "usd",
      customer: stripe_id,
      payment_method: method,
      off_session: true,
      confirm: true,
      description: "Your order at RMK",
      metadata: {
        order_id: order_id
      },
      transfer_group: order_id
    });
    return {
      data: paymentIntent,
      error: null
    };
  } catch (err) {
    return {
      data: null,
      error: err
    };
  }
};

module.exports = {
  charge
};
