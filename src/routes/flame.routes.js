const express = require("express");
const router = express.Router();
const Joi = require("joi");
const flameController = require("../controllers/flame.controller");
const { authenticate } = require("../middleware/auth");
const { validate } = require("../middleware/validate");

const purchaseSchema = Joi.object({ packageName: Joi.string().valid("3_flames", "10_flames", "25_flames").required() });
const confirmSchema = Joi.object({ paymentIntentId: Joi.string().required(), packageName: Joi.string().valid("3_flames", "10_flames", "25_flames").required() });

router.use(authenticate);
router.get("/", flameController.getFlames);
router.post("/grant-daily", flameController.grantDaily);
router.post("/use", flameController.useFlame);
router.post("/purchase", validate(purchaseSchema), flameController.purchaseFlames);
router.post("/confirm-purchase", validate(confirmSchema), flameController.confirmPurchase);
router.get("/packages", flameController.getPackages);
module.exports = router;
