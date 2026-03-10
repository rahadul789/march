const test = require("node:test");
const assert = require("node:assert/strict");

process.env.NODE_ENV = "test";
process.env.MONGODB_URI =
  "mongodb+srv://rahadul:rahadul@cluster0.npsow97.mongodb.net/march_food_delivery_system?retryWrites=true&w=majority";
process.env.ACCESS_TOKEN_SECRET = "test_access_secret";
process.env.REFRESH_TOKEN_SECRET = "test_refresh_secret";

const {
  getUserRoom,
  getOrderRoom,
} = require("../src/core/sockets/socketRooms");
const {
  createSocketEventThrottle,
} = require("../src/core/sockets/socketThrottle");
const { extractSocketAccessToken } = require("../src/core/sockets/socketAuth");
const {
  normalizeOrderIds,
  validateTrackingLocationPayload,
} = require("../src/core/sockets/socketEvents");

test("socket room helpers generate deterministic room names", () => {
  assert.equal(getUserRoom("abc123"), "user:abc123");
  assert.equal(getOrderRoom("ord001"), "order:ord001");
});

test("socket normalizeOrderIds removes invalid and duplicate order ids", () => {
  const orderIds = normalizeOrderIds([
    "67cd50f17f4c1020fb4ba111",
    "67cd50f17f4c1020fb4ba111",
    "bad",
    "",
    "67cd50f17f4c1020fb4ba222",
  ]);

  assert.equal(orderIds.length, 2);
  assert.equal(orderIds[0], "67cd50f17f4c1020fb4ba111");
  assert.equal(orderIds[1], "67cd50f17f4c1020fb4ba222");
});

test("socket event throttle blocks when max events exceeded in active window", () => {
  const throttle = createSocketEventThrottle({
    windowMs: 1000,
    maxEvents: 2,
  });

  assert.equal(throttle.isAllowed("presence:heartbeat"), true);
  assert.equal(throttle.isAllowed("presence:heartbeat"), true);
  assert.equal(throttle.isAllowed("presence:heartbeat"), false);
});

test("extractSocketAccessToken supports handshake auth token and bearer header", () => {
  const fromAuth = extractSocketAccessToken({
    handshake: {
      auth: {
        token: "token_from_auth",
      },
      headers: {},
    },
  });

  assert.equal(fromAuth, "token_from_auth");

  const fromHeader = extractSocketAccessToken({
    handshake: {
      auth: {},
      headers: {
        authorization: "Bearer token_from_header",
      },
    },
  });

  assert.equal(fromHeader, "token_from_header");
});

test("validateTrackingLocationPayload enforces schema and geo ranges", () => {
  const payload = validateTrackingLocationPayload({
    orderId: "67cd50f17f4c1020fb4ba111",
    lng: 90.4125,
    lat: 23.8103,
    accuracyMeters: 12,
  });

  assert.equal(payload.orderId, "67cd50f17f4c1020fb4ba111");
  assert.equal(payload.lng, 90.4125);
  assert.equal(payload.lat, 23.8103);
  assert.equal(payload.accuracyMeters, 12);

  assert.throws(() => {
    validateTrackingLocationPayload({
      orderId: "67cd50f17f4c1020fb4ba111",
      lng: 500,
      lat: 23.8103,
    });
  });
});
