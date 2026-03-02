const test = require("node:test");
const assert = require("node:assert/strict");

process.env.NODE_ENV = "test";
process.env.MONGODB_URI =
  "mongodb+srv://rahadul:rahadul@cluster0.npsow97.mongodb.net/march_food_delivery_system?retryWrites=true&w=majority";
process.env.ACCESS_TOKEN_SECRET = "test_access_secret";
process.env.REFRESH_TOKEN_SECRET = "test_refresh_secret";

const {
  signAccessToken,
  createRefreshTokenDescriptor,
  verifyAccessToken,
  verifyRefreshToken,
} = require("../src/modules/auth/service/token.service");

test("token service signs and verifies access token", () => {
  const accessToken = signAccessToken({
    userId: "507f1f77bcf86cd799439011",
    role: "user",
    status: "active",
    sessionId: "507f1f77bcf86cd799439012",
  });

  const payload = verifyAccessToken(accessToken);

  assert.equal(payload.sub, "507f1f77bcf86cd799439011");
  assert.equal(payload.role, "user");
  assert.equal(payload.type, "access");
});

test("token service creates and verifies refresh token descriptor", () => {
  const descriptor = createRefreshTokenDescriptor({
    userId: "507f1f77bcf86cd799439011",
    sessionId: "507f1f77bcf86cd799439012",
  });

  const payload = verifyRefreshToken(descriptor.refreshToken);

  assert.equal(payload.sub, "507f1f77bcf86cd799439011");
  assert.equal(payload.sid, "507f1f77bcf86cd799439012");
  assert.equal(payload.type, "refresh");
  assert.ok(descriptor.tokenIdHash);
  assert.ok(descriptor.expiresAt instanceof Date);
});
