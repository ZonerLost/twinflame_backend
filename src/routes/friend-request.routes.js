const express = require("express");
const router = express.Router();
const Joi = require("joi");
const c = require("../controllers/friend-request.controller");
const { authenticate } = require("../middleware/auth");
const { validate } = require("../middleware/validate");

const sendRequestSchema = Joi.object({ receiverId: Joi.string().uuid().required(), requestType: Joi.string().valid("like", "superlike", "message").optional(), message: Joi.string().max(500).optional() });

router.use(authenticate);
router.post("/", validate(sendRequestSchema), c.sendRequest);
router.get("/received", c.getReceivedRequests);
router.get("/sent", c.getSentRequests);
router.get("/pending-count", c.getPendingCount);
router.post("/:requestId/accept", c.acceptRequest);
router.post("/:requestId/reject", c.rejectRequest);
router.delete("/:requestId", c.cancelRequest);
module.exports = router;
