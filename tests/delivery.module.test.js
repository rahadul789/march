const test = require("node:test");
const assert = require("node:assert/strict");

process.env.NODE_ENV = "test";
process.env.MONGODB_URI =
  "mongodb+srv://rahadul:rahadul@cluster0.npsow97.mongodb.net/march_food_delivery_system?retryWrites=true&w=majority";
process.env.ACCESS_TOKEN_SECRET = "test_access_secret";
process.env.REFRESH_TOKEN_SECRET = "test_refresh_secret";

const { DeliverymanProfile } = require("../src/modules/delivery/model");
const deliveryValidation = require("../src/modules/delivery/validation/delivery.validation");
const {
  ACTIVE_DELIVERY_ORDER_STATUSES,
  DELIVERY_PROFILE_DEFAULTS,
} = require("../src/modules/delivery/types");

test("deliveryman schema has geo and availability indexes", () => {
  const indexes = DeliverymanProfile.schema.indexes();

  assert.ok(indexes.some(([keys]) => keys.currentLocation === "2dsphere"));
  assert.ok(indexes.some(([keys]) => keys.isAvailable === 1));
});

test("delivery nearby query validation applies defaults", () => {
  const filters = deliveryValidation.validateNearbyQuery({
    lng: 90.4125,
    lat: 23.8103,
  });

  assert.equal(filters.lng, 90.4125);
  assert.equal(filters.lat, 23.8103);
  assert.equal(
    filters.radiusMeters,
    DELIVERY_PROFILE_DEFAULTS.SEARCH_RADIUS_METERS,
  );
  assert.equal(filters.limit, 50);
});

test("delivery active assignment statuses support multi-order tracking", () => {
  assert.ok(Array.isArray(ACTIVE_DELIVERY_ORDER_STATUSES));
  assert.ok(ACTIVE_DELIVERY_ORDER_STATUSES.includes("ASSIGNED"));
  assert.ok(ACTIVE_DELIVERY_ORDER_STATUSES.includes("PICKED_UP"));
});
