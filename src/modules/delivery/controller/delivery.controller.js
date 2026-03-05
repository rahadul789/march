const deliveryService = require('../service/delivery.service');
const deliveryValidation = require('../validation/delivery.validation');

async function getMyProfile(req, res) {
  const profile = await deliveryService.getOwnProfile(req.auth);

  return res.success({
    message: 'Deliveryman profile fetched successfully',
    data: { profile }
  });
}

async function updateMyProfile(req, res) {
  const payload = deliveryValidation.validateUpdateProfilePayload(req.body);
  const profile = await deliveryService.updateOwnProfile(req.auth, payload);

  return res.success({
    message: 'Deliveryman profile updated successfully',
    data: { profile }
  });
}

async function setOnlineStatus(req, res) {
  const payload = deliveryValidation.validateOnlineTogglePayload(req.body);
  const profile = await deliveryService.setOnlineStatus(req.auth, payload.isOnline);

  return res.success({
    message: 'Deliveryman online status updated successfully',
    data: { profile }
  });
}

async function setAvailability(req, res) {
  const payload = deliveryValidation.validateAvailabilityPayload(req.body);
  const profile = await deliveryService.setAvailabilityStatus(req.auth, payload.isAvailable);

  return res.success({
    message: 'Deliveryman availability updated successfully',
    data: { profile }
  });
}

async function updateLocation(req, res) {
  const payload = deliveryValidation.validateLocationPayload(req.body);
  const profile = await deliveryService.updateCurrentLocation(req.auth, payload);

  return res.success({
    message: 'Deliveryman location updated successfully',
    data: { profile }
  });
}

async function heartbeat(req, res) {
  const payload = deliveryValidation.validateHeartbeatPayload(req.body);
  const profile = await deliveryService.heartbeat(req.auth, payload);

  return res.success({
    message: 'Deliveryman heartbeat updated successfully',
    data: { profile }
  });
}

async function findNearbyAvailable(req, res) {
  const filters = deliveryValidation.validateNearbyQuery(req.query);
  const result = await deliveryService.findAvailableDeliverymenNearby(filters);

  return res.success({
    message: 'Nearby available deliverymen fetched successfully',
    data: result.items,
    meta: result.meta
  });
}

module.exports = {
  getMyProfile,
  updateMyProfile,
  setOnlineStatus,
  setAvailability,
  updateLocation,
  heartbeat,
  findNearbyAvailable
};
