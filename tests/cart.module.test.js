const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

process.env.NODE_ENV = "test";
process.env.MONGODB_URI =
  "mongodb+srv://rahadul:rahadul@cluster0.npsow97.mongodb.net/march_food_delivery_system?retryWrites=true&w=majority";
process.env.ACCESS_TOKEN_SECRET = "test_access_secret";
process.env.REFRESH_TOKEN_SECRET = "test_refresh_secret";

const { Cart } = require("../src/modules/cart/model");
const cartValidation = require("../src/modules/cart/validation/cart.validation");
const {
  calculateCartFromMenus,
} = require("../src/modules/cart/service/cart.service");

test("cart schema has unique active cart index (userId + restaurantId + active)", () => {
  const indexes = Cart.schema.indexes();

  assert.ok(
    indexes.some(
      ([keys, options]) =>
        keys.userId === 1 &&
        keys.restaurantId === 1 &&
        keys.active === 1 &&
        options.unique === true,
    ),
  );
});

test("cart pricing is recalculated from authoritative menu data", () => {
  const menuId = new mongoose.Types.ObjectId();

  const cartItems = [
    {
      menuId,
      quantity: 2,
      unitPrice: 1,
      unitDiscount: 99,
    },
  ];

  const menuMap = new Map([
    [
      String(menuId),
      {
        _id: menuId,
        name: "Chicken Bowl",
        image: "https://cdn.example.com/chicken-bowl.jpg",
        preparationTime: 18,
        price: 250,
        discount: 20,
      },
    ],
  ]);

  const calculated = calculateCartFromMenus(cartItems, menuMap);

  assert.equal(calculated.items[0].unitPrice, 250);
  assert.equal(calculated.items[0].unitDiscount, 20);
  assert.equal(calculated.items[0].lineSubtotal, 500);
  assert.equal(calculated.items[0].lineDiscount, 100);
  assert.equal(calculated.items[0].lineTotal, 400);
  assert.equal(calculated.totals.payableTotal, 400);
});

test("lock payload validation applies default ttl when value is omitted", () => {
  const payload = cartValidation.validateLockPayload({});

  assert.equal(payload.lockTtlSeconds, 120);
});
