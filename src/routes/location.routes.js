const express = require("express");
const router = express.Router();
const Joi = require("joi");
const lc = require("../controllers/location.controller");
const { authenticate } = require("../middleware/auth");
const { validate } = require("../middleware/validate");

const travelSchema = Joi.object({ latitude: Joi.number().min(-90).max(90).required(), longitude: Joi.number().min(-180).max(180).required(), cityName: Joi.string().max(255).required() });
const addressSchema = Joi.object({ label: Joi.string().max(50).required(), addressText: Joi.string().max(255).required(), latitude: Joi.number().min(-90).max(90).required(), longitude: Joi.number().min(-180).max(180).required() });

router.use(authenticate);
router.get("/nearby", lc.getNearbyProfiles);
router.post("/travel", validate(travelSchema), lc.setTravelLocation);
router.get("/addresses", lc.getAddresses);
router.post("/addresses", validate(addressSchema), lc.addAddress);
router.put("/addresses/:addressId", lc.updateAddress);
router.delete("/addresses/:addressId", lc.deleteAddress);
router.post("/addresses/:addressId/activate", lc.setActiveAddress);
module.exports = router;
