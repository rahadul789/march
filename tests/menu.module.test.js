const test = require("node:test");
const assert = require("node:assert/strict");

process.env.NODE_ENV = "test";
process.env.MONGODB_URI =
  "mongodb+srv://rahadul:rahadul@cluster0.npsow97.mongodb.net/march_food_delivery_system?retryWrites=true&w=majority";
process.env.ACCESS_TOKEN_SECRET = "test_access_secret";
process.env.REFRESH_TOKEN_SECRET = "test_refresh_secret";

const { Menu } = require("../src/modules/menu/model");
const menuValidation = require("../src/modules/menu/validation/menu.validation");
const { ACTIVE_ORDER_STATUSES } = require("../src/modules/menu/types");

test("menu schema includes composite index (restaurantId + categoryId)", () => {
  const indexes = Menu.schema.indexes();

  assert.ok(
    indexes.some(([keys]) => keys.restaurantId === 1 && keys.categoryId === 1),
  );
});

test("menu create validation normalizes numeric fields and defaults", () => {
  const payload = menuValidation.validateCreatePayload(
    {
      name: "Chicken Burger",
      description: "Grilled chicken with sauce",
      categoryId: "507f1f77bcf86cd799439012",
      price: 199.99,
    },
    "507f1f77bcf86cd799439011",
  );

  assert.equal(payload.restaurantId, "507f1f77bcf86cd799439011");
  assert.equal(payload.discount, 0);
  assert.equal(payload.isAvailable, true);
  assert.equal(payload.preparationTime, 15);
});

test("active order statuses list is defined for deletion guard", () => {
  assert.ok(Array.isArray(ACTIVE_ORDER_STATUSES));
  assert.ok(ACTIVE_ORDER_STATUSES.length > 0);
  assert.ok(ACTIVE_ORDER_STATUSES.includes("pending"));
});
