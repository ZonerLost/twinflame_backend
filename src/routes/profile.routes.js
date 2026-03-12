const express = require("express");
const router = express.Router();
const multer = require("multer");
const Joi = require("joi");
const profileController = require("../controllers/profile.controller");
const { authenticate } = require("../middleware/auth");
const { validate } = require("../middleware/validate");

// Multer config for photo uploads (memory storage for Supabase upload)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
});

// Validation schemas
const personalInfoSchema = Joi.object({
  fullName: Joi.string().max(100).required(),
  biography: Joi.string().max(500).allow("", null),
});

const genderSchema = Joi.object({
  gender: Joi.string().valid("male", "female").required(),
});

const maritalSchema = Joi.object({
  maritalStatus: Joi.string().valid("single", "married", "separated", "not_disclosed").required(),
});

const lifestyleSchema = Joi.object({
  choices: Joi.array().items(Joi.string()).required(),
});

const lookingForSchema = Joi.object({
  lookingFor: Joi.string().valid("males_for_males", "males_for_females", "females_for_females", "females_for_males", "group_socials").required(),
});

const locationSchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  locationText: Joi.string().allow("", null),
});

const beliefsSchema = Joi.object({
  earth_controlled: Joi.string().valid("yes", "no", "not_sure"),
  earth_controlled_tag: Joi.string().max(100).allow("", null),
  religious: Joi.string().valid("yes", "no", "not_sure"),
  religious_tag: Joi.string().max(100).allow("", null),
  pro_government: Joi.string().valid("yes", "no", "not_sure"),
  pro_government_tag: Joi.string().max(100).allow("", null),
  aliens: Joi.string().valid("yes", "no", "not_sure"),
  aliens_tag: Joi.string().max(100).allow("", null),
  reincarnation: Joi.string().valid("yes", "no", "not_sure"),
  reincarnation_tag: Joi.string().max(100).allow("", null),
  moon_landing: Joi.string().valid("yes", "no", "not_sure"),
  moon_landing_tag: Joi.string().max(100).allow("", null),
  matrix: Joi.string().valid("yes", "no", "not_sure"),
  matrix_tag: Joi.string().max(100).allow("", null),
  vaccines: Joi.string().valid("yes", "no", "not_sure"),
  vaccines_tag: Joi.string().max(100).allow("", null),
  flat_earth: Joi.string().valid("yes", "no", "not_sure"),
  flat_earth_tag: Joi.string().max(100).allow("", null),
}).min(1);

const dobSchema = Joi.object({
  dateOfBirth: Joi.date().iso().required(),
});

const editProfileSchema = Joi.object({
  fullName: Joi.string().max(100),
  email: Joi.string().email(),
  phone: Joi.string().min(10).max(20),
  biography: Joi.string().max(500).allow("", null),
}).min(1);

const settingsSchema = Joi.object({
  notificationsEnabled: Joi.boolean(),
  faceRecognitionEnabled: Joi.boolean(),
}).min(1);

const stepSchema = Joi.object({
  step: Joi.number().integer().min(0).max(17).required(),
});

// All routes require authentication
router.use(authenticate);

// Get profile
router.get("/me", profileController.getMyProfile);
router.get("/:userId", profileController.getPublicProfile);

// Profile creation steps
router.put("/personal-info", validate(personalInfoSchema), profileController.updatePersonalInfo);
router.put("/gender", validate(genderSchema), profileController.updateGender);
router.put("/marital-status", validate(maritalSchema), profileController.updateMaritalStatus);
router.put("/lifestyle", validate(lifestyleSchema), profileController.updateLifestyle);
router.put("/looking-for", validate(lookingForSchema), profileController.updateLookingFor);
router.put("/location", validate(locationSchema), profileController.updateLocation);
router.put("/beliefs", validate(beliefsSchema), profileController.updateBeliefs);
router.put("/date-of-birth", validate(dobSchema), profileController.updateDateOfBirth);
router.put("/step", validate(stepSchema), profileController.updateProfileStep);
router.post("/complete", profileController.completeProfile);

// Photos
router.get("/photos/all", profileController.getPhotos);
router.post("/photos", upload.single("photo"), profileController.addPhoto);
router.delete("/photos/:photoId", profileController.deletePhoto);

// Edit profile (from settings)
router.put("/edit", validate(editProfileSchema), profileController.editProfile);

// User settings
router.put("/settings", validate(settingsSchema), profileController.updateSettings);

module.exports = router;
