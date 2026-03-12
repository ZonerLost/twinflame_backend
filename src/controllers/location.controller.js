const locationService = require("../services/location.service");
const { successResponse } = require("../utils/helpers");

async function getNearbyProfiles(req, res, next) { try { const { latitude, longitude, radius, limit, offset } = req.query; return successResponse(res, await locationService.getNearbyProfiles(req.userId, { latitude: parseFloat(latitude), longitude: parseFloat(longitude), radiusMiles: parseFloat(radius) || 1, limit: parseInt(limit) || 20, offset: parseInt(offset) || 0 }), "Nearby profiles retrieved"); } catch (err) { next(err); } }
async function setTravelLocation(req, res, next) { try { return successResponse(res, await locationService.setTravelLocation(req.userId, req.body), "Travel location set"); } catch (err) { next(err); } }
async function getAddresses(req, res, next) { try { return successResponse(res, await locationService.getAddresses(req.userId), "Addresses retrieved"); } catch (err) { next(err); } }
async function addAddress(req, res, next) { try { return successResponse(res, await locationService.addAddress(req.userId, req.body), "Address added", 201); } catch (err) { next(err); } }
async function updateAddress(req, res, next) { try { return successResponse(res, await locationService.updateAddress(req.userId, req.params.addressId, req.body), "Address updated"); } catch (err) { next(err); } }
async function deleteAddress(req, res, next) { try { return successResponse(res, await locationService.deleteAddress(req.userId, req.params.addressId), "Address deleted"); } catch (err) { next(err); } }
async function setActiveAddress(req, res, next) { try { return successResponse(res, await locationService.setActiveAddress(req.userId, req.params.addressId), "Active address set"); } catch (err) { next(err); } }
module.exports = { getNearbyProfiles, setTravelLocation, getAddresses, addAddress, updateAddress, deleteAddress, setActiveAddress };
