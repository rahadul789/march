const test = require('node:test');
const assert = require('node:assert/strict');

const { Device } = require('../src/modules/device/model');
const { DEVICE_TYPES } = require('../src/modules/device/types');
const { normalizeDeviceType } = require('../src/modules/device/service/device.service');

test('device type normalization supports platform aliases', () => {
  assert.equal(normalizeDeviceType('ios'), DEVICE_TYPES.IOS);
  assert.equal(normalizeDeviceType('android'), DEVICE_TYPES.ANDROID);
  assert.equal(normalizeDeviceType('iphone'), DEVICE_TYPES.IOS);
  assert.equal(normalizeDeviceType('something-else'), DEVICE_TYPES.UNKNOWN);
});

test('device schema keeps required indexes for user and session', () => {
  const indexes = Device.schema.indexes();

  assert.ok(indexes.some(([keys]) => keys.userId === 1));
  assert.ok(indexes.some(([keys, options]) => keys.sessionId === 1 && options.unique === true));
});

test('device schema includes push token, device type and last active fields', () => {
  assert.equal(Device.schema.path('userId').options.required, true);
  assert.equal(Device.schema.path('pushToken').instance, 'String');
  assert.equal(Device.schema.path('deviceType').instance, 'String');
  assert.equal(Device.schema.path('lastActive').instance, 'Date');
});
