const express = require("express");
const router = express.Router();
const Joi = require("joi");
const mc = require("../controllers/moderation.controller");
const { authenticate } = require("../middleware/auth");
const { validate } = require("../middleware/validate");

const reportSchema = Joi.object({ reportedUserId: Joi.string().uuid().required(), reason: Joi.string().valid("harassment", "spam", "fake_profile", "inappropriate_content", "other").required(), description: Joi.string().max(500).optional() });
const checkTextSchema = Joi.object({ text: Joi.string().required() });
const resolveReportSchema = Joi.object({ reportId: Joi.string().uuid().required(), status: Joi.string().valid("reviewed", "resolved", "dismissed").required(), action: Joi.string().valid("suspend", "ban", "none").optional() });
const contentActionSchema = Joi.object({ contentType: Joi.string().valid("photo", "bio").required(), contentId: Joi.string().uuid().required(), reason: Joi.string().max(500).optional() });
const accountActionSchema = Joi.object({ userId: Joi.string().uuid().required(), reason: Joi.string().max(500).optional() });

router.use(authenticate);
router.post("/check-text", validate(checkTextSchema), mc.checkText);
router.post("/report", validate(reportSchema), mc.reportUser);
router.get("/account-status", mc.getAccountStatus);
router.get("/reports", mc.getReports);
router.post("/reports/resolve", validate(resolveReportSchema), mc.resolveReport);
router.post("/content/approve", validate(contentActionSchema), mc.approveContent);
router.post("/content/reject", validate(contentActionSchema), mc.rejectContent);
router.post("/account/suspend", validate(accountActionSchema), mc.suspendAccount);
router.post("/account/ban", validate(accountActionSchema), mc.banAccount);
router.post("/account/reactivate", validate(accountActionSchema), mc.reactivateAccount);
router.get("/logs", mc.getModerationLogs);
router.get("/pending-content", mc.getPendingContent);
module.exports = router;
