const flameService = require("../services/flame.service");
const { successResponse } = require("../utils/helpers");

async function getFlames(req, res, next) {
  try { return successResponse(res, await flameService.getFlames(req.userId), "Flames retrieved"); } catch (err) { next(err); }
}
async function grantDaily(req, res, next) {
  try { const data = await flameService.grantDailyFlames(req.userId); return successResponse(res, data, data.granted ? "Daily flames granted" : data.message); } catch (err) { next(err); }
}
async function useFlame(req, res, next) {
  try { return successResponse(res, await flameService.useFlame(req.userId), "Flame used"); } catch (err) { next(err); }
}
async function purchaseFlames(req, res, next) {
  try { return successResponse(res, await flameService.purchaseFlames(req.userId, { packageName: req.body.packageName }), "Payment intent created"); } catch (err) { next(err); }
}
async function confirmPurchase(req, res, next) {
  try { const { paymentIntentId, packageName } = req.body; return successResponse(res, await flameService.confirmPurchase(req.userId, { paymentIntentId, packageName }), "Flames purchased successfully"); } catch (err) { next(err); }
}
async function getPackages(req, res, next) {
  try { return successResponse(res, await flameService.getPackages(), "Packages retrieved"); } catch (err) { next(err); }
}
module.exports = { getFlames, grantDaily, useFlame, purchaseFlames, confirmPurchase, getPackages };
