const moderationService = require("../services/moderation.service");
const { successResponse } = require("../utils/helpers");

async function checkText(req, res, next) { try { const data = await moderationService.checkTextContent(req.body.text); return successResponse(res, data, data.isClean ? "Content is clean" : "Inappropriate content detected"); } catch (err) { next(err); } }
async function reportUser(req, res, next) { try { const { reportedUserId, reason, description } = req.body; return successResponse(res, await moderationService.reportUser(req.userId, { reportedUserId, reason, description }), "Report submitted", 201); } catch (err) { next(err); } }
async function getReports(req, res, next) { try { const { status, limit, offset } = req.query; return successResponse(res, await moderationService.getReports({ status, limit: parseInt(limit) || 20, offset: parseInt(offset) || 0 }), "Reports retrieved"); } catch (err) { next(err); } }
async function resolveReport(req, res, next) { try { return successResponse(res, await moderationService.resolveReport(req.userId, req.body), "Report resolved"); } catch (err) { next(err); } }
async function approveContent(req, res, next) { try { return successResponse(res, await moderationService.approveContent(req.userId, req.body), "Content approved"); } catch (err) { next(err); } }
async function rejectContent(req, res, next) { try { return successResponse(res, await moderationService.rejectContent(req.userId, req.body), "Content rejected"); } catch (err) { next(err); } }
async function suspendAccount(req, res, next) { try { return successResponse(res, await moderationService.suspendAccount(req.userId, req.body.userId, req.body.reason), "Account suspended"); } catch (err) { next(err); } }
async function banAccount(req, res, next) { try { return successResponse(res, await moderationService.banAccount(req.userId, req.body.userId, req.body.reason), "Account banned"); } catch (err) { next(err); } }
async function reactivateAccount(req, res, next) { try { return successResponse(res, await moderationService.reactivateAccount(req.userId, req.body.userId, req.body.reason), "Account reactivated"); } catch (err) { next(err); } }
async function getModerationLogs(req, res, next) { try { const { userId, limit, offset } = req.query; return successResponse(res, await moderationService.getModerationLogs({ userId, limit: parseInt(limit) || 50, offset: parseInt(offset) || 0 }), "Logs retrieved"); } catch (err) { next(err); } }
async function getPendingContent(req, res, next) { try { return successResponse(res, await moderationService.getPendingContent({ limit: parseInt(req.query.limit) || 20, offset: parseInt(req.query.offset) || 0 }), "Pending content retrieved"); } catch (err) { next(err); } }
async function getAccountStatus(req, res, next) { try { return successResponse(res, await moderationService.getAccountStatus(req.userId), "Account status retrieved"); } catch (err) { next(err); } }

module.exports = { checkText, reportUser, getReports, resolveReport, approveContent, rejectContent, suspendAccount, banAccount, reactivateAccount, getModerationLogs, getPendingContent, getAccountStatus };
