const test = require("node:test");
const assert = require("node:assert/strict");

process.env.NODE_ENV = "test";
process.env.MONGODB_URI =
  "mongodb+srv://rahadul:rahadul@cluster0.npsow97.mongodb.net/march_food_delivery_system?retryWrites=true&w=majority";
process.env.ACCESS_TOKEN_SECRET = "test_access_secret";
process.env.REFRESH_TOKEN_SECRET = "test_refresh_secret";

const {
  isExpoPushToken,
  buildExpoMessages,
  chunkArray,
} = require("../src/modules/notification/service/expoPush.service");

test("isExpoPushToken validates expo token formats", () => {
  assert.equal(isExpoPushToken("ExpoPushToken[abc123]"), true);
  assert.equal(isExpoPushToken("ExponentPushToken[xyz789]"), true);
  assert.equal(isExpoPushToken("invalid-token"), false);
});

test("chunkArray splits large arrays by batch size", () => {
  const chunks = chunkArray([1, 2, 3, 4, 5], 2);
  assert.deepEqual(chunks, [[1, 2], [3, 4], [5]]);
});

test("buildExpoMessages targets all active devices for each notification user", () => {
  const notifications = [
    {
      id: "notif-1",
      userId: "u1",
      title: "Order ORD-1 ASSIGNED",
      message: "Your order is now ASSIGNED.",
      type: "ORDER_STATUS_CHANGED",
      payload: { orderId: "o1" },
    },
  ];

  const devices = [
    {
      userId: "u1",
      sessionId: "s1",
      pushToken: "ExpoPushToken[token-1]",
    },
    {
      userId: "u1",
      sessionId: "s2",
      pushToken: "ExponentPushToken[token-2]",
    },
    {
      userId: "u1",
      sessionId: "s3",
      pushToken: "bad-token",
    },
  ];

  const messages = buildExpoMessages(notifications, devices);

  assert.equal(messages.length, 2);
  assert.equal(messages[0].notificationId, "notif-1");
  assert.equal(messages[1].notificationId, "notif-1");
});
