const pushTokenService = require("../services/push-token.service");
const { successResponse } = require("../utils/helpers");

async function registerToken(req, res, next) {
  try {
    const { fcmToken, devicePlatform } = req.body;
    const data = await pushTokenService.registerToken(req.userId, {
      fcmToken,
      devicePlatform,
    });
    return successResponse(res, data, "Push token saved");
  } catch (err) {
    next(err);
  }
}

async function unregisterToken(req, res, next) {
  try {
    const { fcmToken } = req.body;
    const data = await pushTokenService.unregisterToken(req.userId, { fcmToken });
    return successResponse(res, data, "Push token removed");
  } catch (err) {
    next(err);
  }
}

module.exports = {
  registerToken,
  unregisterToken,
};
