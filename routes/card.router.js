const router = require("express").Router();
const controller = require("../controllers/card.controller");

router.route("/:id").get(controller.fetch);
router.route("/").post(controller.save);
router.route("/default").patch(controller._default);
router.route("/:id").delete(controller.remove);

module.exports = router;
