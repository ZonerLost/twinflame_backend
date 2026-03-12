const profileService = require("../services/profile.service");
const { successResponse } = require("../utils/helpers");

async function updatePersonalInfo(req, res, next) {
  try {
    const data = await profileService.updatePersonalInfo(req.userId, req.body);
    return successResponse(res, data, "Personal info updated");
  } catch (err) { next(err); }
}

async function updateGender(req, res, next) {
  try {
    const data = await profileService.updateGender(req.userId, req.body);
    return successResponse(res, data, "Gender updated");
  } catch (err) { next(err); }
}

async function updateMaritalStatus(req, res, next) {
  try {
    const data = await profileService.updateMaritalStatus(req.userId, req.body);
    return successResponse(res, data, "Marital status updated");
  } catch (err) { next(err); }
}

async function addPhoto(req, res, next) {
  try {
    let photoUrl = req.body.photoUrl;

    // If file uploaded via multer, upload to Supabase storage
    if (req.file) {
      photoUrl = await profileService.uploadPhotoToStorage(req.userId, req.file);
    }

    const data = await profileService.addPhoto(req.userId, {
      photoUrl,
      photoOrder: req.body.photoOrder || 0,
      isPrimary: req.body.isPrimary === "true" || req.body.isPrimary === true,
    });
    return successResponse(res, data, "Photo added", 201);
  } catch (err) { next(err); }
}

async function deletePhoto(req, res, next) {
  try {
    const data = await profileService.deletePhoto(req.userId, req.params.photoId);
    return successResponse(res, data, "Photo deleted");
  } catch (err) { next(err); }
}

async function getPhotos(req, res, next) {
  try {
    const data = await profileService.getPhotos(req.userId);
    return successResponse(res, data, "Photos retrieved");
  } catch (err) { next(err); }
}

async function updateLifestyle(req, res, next) {
  try {
    const data = await profileService.updateLifestyle(req.userId, req.body);
    return successResponse(res, data, "Lifestyle updated");
  } catch (err) { next(err); }
}

async function updateLookingFor(req, res, next) {
  try {
    const data = await profileService.updateLookingFor(req.userId, req.body);
    return successResponse(res, data, "Looking for updated");
  } catch (err) { next(err); }
}

async function updateLocation(req, res, next) {
  try {
    const data = await profileService.updateLocation(req.userId, req.body);
    return successResponse(res, data, "Location updated");
  } catch (err) { next(err); }
}

async function updateBeliefs(req, res, next) {
  try {
    const data = await profileService.updateBeliefs(req.userId, req.body);
    return successResponse(res, data, "Beliefs updated");
  } catch (err) { next(err); }
}

async function updateDateOfBirth(req, res, next) {
  try {
    const data = await profileService.updateDateOfBirth(req.userId, req.body);
    return successResponse(res, data, "Date of birth updated");
  } catch (err) { next(err); }
}

async function completeProfile(req, res, next) {
  try {
    const data = await profileService.completeProfile(req.userId);
    return successResponse(res, data, "Profile completed");
  } catch (err) { next(err); }
}

async function updateProfileStep(req, res, next) {
  try {
    const data = await profileService.updateProfileStep(req.userId, req.body);
    return successResponse(res, data, "Profile step updated");
  } catch (err) { next(err); }
}

async function getMyProfile(req, res, next) {
  try {
    const data = await profileService.getProfile(req.userId);
    return successResponse(res, data, "Profile retrieved");
  } catch (err) { next(err); }
}

async function getPublicProfile(req, res, next) {
  try {
    const data = await profileService.getPublicProfile(req.params.userId);
    return successResponse(res, data, "Profile retrieved");
  } catch (err) { next(err); }
}

async function editProfile(req, res, next) {
  try {
    const data = await profileService.editProfile(req.userId, req.body);
    return successResponse(res, data, "Profile updated");
  } catch (err) { next(err); }
}

async function updateSettings(req, res, next) {
  try {
    const data = await profileService.updateSettings(req.userId, req.body);
    return successResponse(res, data, "Settings updated");
  } catch (err) { next(err); }
}

module.exports = {
  updatePersonalInfo,
  updateGender,
  updateMaritalStatus,
  addPhoto,
  deletePhoto,
  getPhotos,
  updateLifestyle,
  updateLookingFor,
  updateLocation,
  updateBeliefs,
  updateDateOfBirth,
  completeProfile,
  updateProfileStep,
  getMyProfile,
  getPublicProfile,
  editProfile,
  updateSettings,
};
