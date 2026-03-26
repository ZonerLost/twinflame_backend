const express = require("express");
const Joi = require("joi");
const { authenticate } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const pushTokenController = require("../controllers/push-token.controller");

const router = express.Router();

const registerPushTokenSchema = Joi.object({
  fcmToken: Joi.string().trim().required(),
  devicePlatform: Joi.string()
    .valid("android", "ios", "macos", "windows", "linux", "fuchsia")
    .required(),
});

const deletePushTokenSchema = Joi.object({
  fcmToken: Joi.string().trim().required(),
});

router.use(authenticate);

router.post("/", validate(registerPushTokenSchema), pushTokenController.registerToken);
router.delete("/", validate(deletePushTokenSchema), pushTokenController.unregisterToken);

module.exports = router;
