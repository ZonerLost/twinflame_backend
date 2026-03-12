const friendService = require("../services/friend.service");
const { successResponse } = require("../utils/helpers");

async function getFriends(req, res, next) {
  try {
    const data = await friendService.getFriends(req.userId);
    return successResponse(res, data, "Friends retrieved");
  } catch (err) { next(err); }
}

async function getFriendCount(req, res, next) {
  try {
    const data = await friendService.getFriendCount(req.userId);
    return successResponse(res, data, "Friend count retrieved");
  } catch (err) { next(err); }
}

async function removeFriend(req, res, next) {
  try {
    const data = await friendService.removeFriend(req.userId, req.params.friendId);
    return successResponse(res, data, "Friend removed");
  } catch (err) { next(err); }
}

module.exports = { getFriends, getFriendCount, removeFriend };
