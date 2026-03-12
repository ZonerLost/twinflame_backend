const subscriptionService = require("../services/subscription.service");
const { successResponse } = require("../utils/helpers");

async function getPlans(req, res, next) {
  try {
    const data = await subscriptionService.getPlans();
    return successResponse(res, data, "Plans retrieved");
  } catch (err) { next(err); }
}

async function getCurrentSubscription(req, res, next) {
  try {
    const data = await subscriptionService.getCurrentSubscription(req.userId);
    return successResponse(res, data, "Subscription retrieved");
  } catch (err) { next(err); }
}

async function subscribe(req, res, next) {
  try {
    const { planId } = req.body;
    const data = await subscriptionService.subscribe(req.userId, { planId });
    return successResponse(res, data, "Subscription initiated");
  } catch (err) { next(err); }
}

async function confirmSubscription(req, res, next) {
  try {
    const { paymentIntentId, planId } = req.body;
    const data = await subscriptionService.confirmSubscription(req.userId, { paymentIntentId, planId });
    return successResponse(res, data, "Subscription confirmed");
  } catch (err) { next(err); }
}

async function cancelSubscription(req, res, next) {
  try {
    const data = await subscriptionService.cancelSubscription(req.userId);
    return successResponse(res, data, "Subscription cancelled");
  } catch (err) { next(err); }
}

module.exports = { getPlans, getCurrentSubscription, subscribe, confirmSubscription, cancelSubscription };
