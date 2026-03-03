const deviceService = require('../service/device.service');
const deviceValidation = require('../validation/device.validation');

async function listMyDevices(req, res) {
  deviceValidation.validateListQuery(req.query);

  const devices = await deviceService.getUserDevices(req.auth.userId);

  return res.success({
    message: 'Devices fetched successfully',
    data: {
      devices
    }
  });
}

module.exports = {
  listMyDevices
};
