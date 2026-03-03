const restaurantService = require("../service/restaurant.service");
const restaurantValidation = require("../validation/restaurant.validation");

async function createRestaurant(req, res) {
  const payload = restaurantValidation.validateCreatePayload(req.body);
  const restaurant = await restaurantService.createRestaurant(
    payload,
    req.auth,
  );

  return res.success({
    statusCode: 201,
    message: "Restaurant created successfully",
    data: { restaurant },
  });
}

async function listRestaurants(req, res) {
  const filters = restaurantValidation.validateListQuery(req.query);
  const result = await restaurantService.listRestaurants(
    filters,
    req.auth || null,
  );

  return res.success({
    message: "Restaurants fetched successfully",
    data: result.items,
    meta: result.pagination,
  });
}

async function listMyRestaurants(req, res) {
  const filters = restaurantValidation.validateListQuery(req.query);
  const result = await restaurantService.listRestaurantsForOwner(
    req.auth.userId,
    filters,
    req.auth,
  );

  return res.success({
    message: "Owner restaurants fetched successfully",
    data: result.items,
    meta: result.pagination,
  });
}

async function getRestaurantById(req, res) {
  const restaurantId = restaurantValidation.validateRestaurantIdParam(
    req.params,
  );
  const restaurant = await restaurantService.getRestaurantById(
    restaurantId,
    req.auth || null,
  );

  return res.success({
    message: "Restaurant fetched successfully",
    data: { restaurant },
  });
}

async function updateApprovalStatus(req, res) {
  const restaurantId = restaurantValidation.validateRestaurantIdParam(
    req.params,
  );
  const payload = restaurantValidation.validateApprovalUpdatePayload(req.body);

  const restaurant = await restaurantService.updateApprovalStatus(
    restaurantId,
    payload,
    req.auth,
  );

  return res.success({
    message: "Restaurant approval status updated",
    data: { restaurant },
  });
}

async function updateActiveFlag(req, res) {
  const restaurantId = restaurantValidation.validateRestaurantIdParam(
    req.params,
  );
  const payload = restaurantValidation.validateActiveUpdatePayload(req.body);

  const restaurant = await restaurantService.updateActiveFlag(
    restaurantId,
    payload,
    req.auth,
  );

  return res.success({
    message: "Restaurant active flag updated",
    data: { restaurant },
  });
}

async function softDeleteRestaurant(req, res) {
  const restaurantId = restaurantValidation.validateRestaurantIdParam(
    req.params,
  );
  const result = await restaurantService.softDeleteRestaurant(
    restaurantId,
    req.auth,
  );

  return res.success({
    message: "Restaurant deleted successfully",
    data: result,
  });
}

module.exports = {
  createRestaurant,
  listRestaurants,
  listMyRestaurants,
  getRestaurantById,
  updateApprovalStatus,
  updateActiveFlag,
  softDeleteRestaurant,
};
