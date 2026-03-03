const test = require("node:test");
const assert = require("node:assert/strict");

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/march_food_delivery_test";
process.env.ACCESS_TOKEN_SECRET = "test_access_secret";
process.env.REFRESH_TOKEN_SECRET = "test_refresh_secret";

const healthService = require("../src/core/health/health.service");

test("health service returns required top-level fields", () => {
  const health = healthService.getHealthSnapshot();

  assert.ok(health.status);
  assert.ok(health.services);
  assert.ok(health.services.database);
  assert.equal(typeof health.uptimeSeconds, "number");
});
