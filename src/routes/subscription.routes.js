const express = require("express");
const router = express.Router();
const Joi = require("joi");
const subscriptionController = require("../controllers/subscription.controller");
const { authenticate } = require("../middleware/auth");
const { validate } = require("../middleware/validate");

const subscribeSchema = Joi.object({
  planId: Joi.string().uuid().required(),
});

const confirmSchema = Joi.object({
  paymentIntentId: Joi.string().required(),
  planId: Joi.string().uuid().required(),
});

router.use(authenticate);

router.get("/plans", subscriptionController.getPlans);
router.get("/status", subscriptionController.getCurrentSubscription);
router.post("/subscribe", validate(subscribeSchema), subscriptionController.subscribe);
router.post("/confirm", validate(confirmSchema), subscriptionController.confirmSubscription);
router.post("/cancel", subscriptionController.cancelSubscription);

module.exports = router;
