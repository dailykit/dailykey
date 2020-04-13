const router = require("express").Router();
const controller = require("../controllers/address.controller");

router.route("/").get(controller.fetch);
router.route("/").post(controller.save);
router.route("/update").post(controller.update);
router.route("/default").post(controller._default);
router.route("/remove").post(controller.remove);

module.exports = router;
