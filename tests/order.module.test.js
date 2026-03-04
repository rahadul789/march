const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

process.env.NODE_ENV = "test";
process.env.MONGODB_URI =
  "mongodb+srv://rahadul:rahadul@cluster0.npsow97.mongodb.net/march_food_delivery_system?retryWrites=true&w=majority";
process.env.ACCESS_TOKEN_SECRET = "test_access_secret";
process.env.REFRESH_TOKEN_SECRET = "test_refresh_secret";

const { Order } = require("../src/modules/order/model");
const {
  createDateKey,
  formatOrderNumber,
  buildOrderSnapshotFromMenus,
  calculatePricingBreakdown,
  assertTransitionAllowed,
  getAllowedRolesForTransition,
} = require("../src/modules/order/service/order.service");
const { USER_ROLES } = require("../src/modules/auth/types");
const { ORDER_STATUSES } = require("../src/modules/order/types");

test("order schema has required indexes for restaurant status and userId", () => {
  const indexes = Order.schema.indexes();

  assert.ok(
    indexes.some(([keys]) => keys.restaurantId === 1 && keys.status === 1),
  );
  assert.ok(indexes.some(([keys]) => keys.userId === 1));
});

test("order number generator helpers produce deterministic format", () => {
  const date = new Date(Date.UTC(2026, 2, 4, 10, 20, 30));
  const key = createDateKey(date);

  assert.equal(key, "20260304");
  assert.equal(formatOrderNumber(key, 42), "ORD-20260304-000042");
});

test("order snapshot pricing is calculated from menu db data", () => {
  const menuId = new mongoose.Types.ObjectId();
  const categoryId = new mongoose.Types.ObjectId();

  const cartItems = [
    {
      menuId,
      quantity: 3,
      unitPrice: 1,
      unitDiscount: 99,
      lineSubtotal: 3,
      lineDiscount: 2,
      lineTotal: 1,
    },
  ];

  const menuMap = new Map([
    [
      String(menuId),
      {
        _id: menuId,
        categoryId,
        name: "Beef Burger",
        description: "Double patty burger",
        image: "https://cdn.example.com/beef-burger.jpg",
        preparationTime: 22,
        price: 350,
        discount: 10,
      },
    ],
  ]);

  const snapshots = buildOrderSnapshotFromMenus(cartItems, menuMap);
  const pricing = calculatePricingBreakdown(snapshots);

  assert.equal(snapshots[0].unitPrice, 350);
  assert.equal(snapshots[0].lineSubtotal, 1050);
  assert.equal(snapshots[0].lineDiscount, 105);
  assert.equal(snapshots[0].lineTotal, 945);

  assert.equal(pricing.subtotal, 1050);
  assert.equal(pricing.discountTotal, 105);
  assert.equal(pricing.payableTotal, 945);
  assert.equal(pricing.grandTotal, 945);
  assert.equal(pricing.totalItems, 3);
});

test("order state machine rejects invalid transition", () => {
  assert.throws(() => {
    assertTransitionAllowed(ORDER_STATUSES.PLACED, ORDER_STATUSES.DELIVERED);
  });
});

test("order state machine role map includes deliveryman for pickup transition", () => {
  const roles = getAllowedRolesForTransition(
    ORDER_STATUSES.ASSIGNED,
    ORDER_STATUSES.PICKED_UP,
  );

  assert.ok(roles.includes(USER_ROLES.DELIVERYMAN));
});
