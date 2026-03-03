const test = require("node:test");
const assert = require("node:assert/strict");

process.env.NODE_ENV = "test";
process.env.MONGODB_URI =
  "mongodb+srv://rahadul:rahadul@cluster0.npsow97.mongodb.net/march_food_delivery_system?retryWrites=true&w=majority";
process.env.ACCESS_TOKEN_SECRET = "test_access_secret";
process.env.REFRESH_TOKEN_SECRET = "test_refresh_secret";

const { Category } = require("../src/modules/category/model");
const categoryValidation = require("../src/modules/category/validation/category.validation");

test("category schema includes required composite index (restaurantId + sortOrder)", () => {
  const indexes = Category.schema.indexes();

  assert.ok(
    indexes.some(([keys]) => keys.restaurantId === 1 && keys.sortOrder === 1),
  );
});

test("category create validation applies defaults and accepts valid payload", () => {
  const payload = categoryValidation.validateCreatePayload(
    {
      name: "Burgers",
    },
    "507f1f77bcf86cd799439011",
  );

  assert.equal(payload.name, "Burgers");
  assert.equal(payload.restaurantId, "507f1f77bcf86cd799439011");
  assert.equal(payload.sortOrder, 0);
  assert.equal(payload.isActive, true);
});

test("category update validation rejects empty patch payload", () => {
  assert.throws(() => {
    categoryValidation.validateUpdatePayload({});
  });
});
