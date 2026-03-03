const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/march_food_delivery_test';
process.env.ACCESS_TOKEN_SECRET = 'test_access_secret';
process.env.REFRESH_TOKEN_SECRET = 'test_refresh_secret';

const { Restaurant } = require('../src/modules/restaurant/model');
const restaurantValidation = require('../src/modules/restaurant/validation/restaurant.validation');
const restaurantService = require('../src/modules/restaurant/service/restaurant.service');

test('restaurant schema contains required geo and owner indexes', () => {
  const indexes = Restaurant.schema.indexes();

  assert.ok(indexes.some(([keys]) => keys.geoLocation === '2dsphere'));
  assert.ok(indexes.some(([keys]) => keys.ownerId === 1));
});

test('restaurant create payload validation normalizes address and geolocation', () => {
  const payload = restaurantValidation.validateCreatePayload({
    name: 'Demo Kitchen',
    description: 'Fast delivery restaurant',
    address: '123 Main Street, Dhaka',
    longitude: 90.4125,
    latitude: 23.8103,
    commissionRate: 17.5
  });

  assert.equal(payload.address.fullAddress, '123 Main Street, Dhaka');
  assert.equal(payload.geoLocation.type, 'Point');
  assert.deepEqual(payload.geoLocation.coordinates, [90.4125, 23.8103]);
  assert.equal(payload.commissionRate, 17.5);
});

test('commission calculation returns deterministic financial totals', () => {
  const result = restaurantService.calculateCommissionAmount(1000, 12.5);

  assert.equal(result.subtotal, 1000);
  assert.equal(result.commissionRate, 12.5);
  assert.equal(result.commissionAmount, 125);
  assert.equal(result.ownerNetAmount, 875);
});
