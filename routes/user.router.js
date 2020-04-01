const router = require("express").Router();
const controller = require("../controllers/user.controller");

router.route("/:id").get(controller.fetch);
router.route("/signup").post(controller.signup);
// router.route("/login").post(controller.login);
router.route("/refresh-token").post(controller.refreshToken);
router.route("/payment-intent").post(controller.paymentIntent);

module.exports = router;
