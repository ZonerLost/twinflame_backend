const express = require("express");
const router = express.Router();
const Joi = require("joi");
const matchController = require("../controllers/match.controller");
const { authenticate, requireActiveAccount } = require("../middleware/auth");
const { validate } = require("../middleware/validate");

const swipeSchema = Joi.object({
  swipedId: Joi.string().uuid().required(),
  action: Joi.string().valid("like", "nope", "superlike").required(),
});

router.use(authenticate);

router.get("/discover", requireActiveAccount, matchController.discover);
router.post("/swipe", requireActiveAccount, validate(swipeSchema), matchController.swipe);
router.get("/matches", matchController.getMatches);
router.delete("/:matchId", matchController.unmatch);

module.exports = router;
