const healthService = require('./health.service');

function getHealth(req, res) {
  const snapshot = healthService.getHealthSnapshot();
  const statusCode = snapshot.status === 'ok' ? 200 : 503;

  return res.success({
    statusCode,
    message: 'Health check result',
    data: snapshot
  });
}

module.exports = {
  getHealth
};
