const express = require("express");
const router = express.Router();
const friendController = require("../controllers/friend.controller");
const { authenticate } = require("../middleware/auth");

router.use(authenticate);

router.get("/", friendController.getFriends);
router.get("/count", friendController.getFriendCount);
router.delete("/:friendId", friendController.removeFriend);

module.exports = router;
