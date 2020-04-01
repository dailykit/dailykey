const router = require("express").Router();
const controller = require("../controllers/card.controller");

router.route("/").post(controller.save);
router.route("/default/:id").patch(controller._default);
router.route("/:id").delete(controller.remove);

module.exports = router;
