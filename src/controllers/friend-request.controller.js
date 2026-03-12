const friendRequestService = require("../services/friend-request.service");
const { successResponse } = require("../utils/helpers");

async function sendRequest(req, res, next) { try { return successResponse(res, await friendRequestService.sendRequest(req.userId, req.body), "Friend request sent", 201); } catch (err) { next(err); } }
async function getReceivedRequests(req, res, next) { try { return successResponse(res, await friendRequestService.getReceivedRequests(req.userId, { status: req.query.status || "pending", limit: parseInt(req.query.limit) || 20, offset: parseInt(req.query.offset) || 0 }), "Requests retrieved"); } catch (err) { next(err); } }
async function getSentRequests(req, res, next) { try { return successResponse(res, await friendRequestService.getSentRequests(req.userId, { limit: parseInt(req.query.limit) || 20, offset: parseInt(req.query.offset) || 0 }), "Sent requests retrieved"); } catch (err) { next(err); } }
async function acceptRequest(req, res, next) { try { return successResponse(res, await friendRequestService.acceptRequest(req.userId, req.params.requestId), "Request accepted"); } catch (err) { next(err); } }
async function rejectRequest(req, res, next) { try { return successResponse(res, await friendRequestService.rejectRequest(req.userId, req.params.requestId), "Request rejected"); } catch (err) { next(err); } }
async function cancelRequest(req, res, next) { try { return successResponse(res, await friendRequestService.cancelRequest(req.userId, req.params.requestId), "Request cancelled"); } catch (err) { next(err); } }
async function getPendingCount(req, res, next) { try { return successResponse(res, await friendRequestService.getPendingCount(req.userId), "Pending count retrieved"); } catch (err) { next(err); } }
module.exports = { sendRequest, getReceivedRequests, getSentRequests, acceptRequest, rejectRequest, cancelRequest, getPendingCount };
