const matchService = require("../services/match.service");
const { successResponse } = require("../utils/helpers");

async function discover(req, res, next) {
  try {
    const { limit, offset, maxDistance, gender } = req.query;
    const data = await matchService.discover(req.userId, {
      limit: parseInt(limit) || 10,
      offset: parseInt(offset) || 0,
      maxDistance: maxDistance ? parseFloat(maxDistance) : undefined,
      gender,
    });
    return successResponse(res, data, "Profiles retrieved");
  } catch (err) { next(err); }
}

async function swipe(req, res, next) {
  try {
    const { swipedId, action } = req.body;
    const data = await matchService.swipe(req.userId, { swipedId, action });
    return successResponse(res, data, data.isMatch ? "It's a match!" : "Swipe recorded");
  } catch (err) { next(err); }
}

async function getMatches(req, res, next) {
  try {
    const data = await matchService.getMatches(req.userId);
    return successResponse(res, data, "Matches retrieved");
  } catch (err) { next(err); }
}

async function unmatch(req, res, next) {
  try {
    const data = await matchService.unmatch(req.userId, req.params.matchId);
    return successResponse(res, data, "Unmatched");
  } catch (err) { next(err); }
}

module.exports = { discover, swipe, getMatches, unmatch };
