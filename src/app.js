const express = require('express');

const env = require('./core/config/env');
const routes = require('./routes');
const healthRoute = require('./core/health/health.route');
const applySecurityMiddlewares = require('./core/middlewares/security');
const requestIdMiddleware = require('./core/middlewares/requestId');
const rateLimiter = require('./core/middlewares/rateLimiter');
const { requestMetricsMiddleware } = require('./core/monitoring/metrics');
const { attachResponseHelpers } = require('./core/response/apiResponse');
const notFoundHandler = require('./core/errors/notFoundHandler');
const errorHandler = require('./core/errors/errorHandler');

const app = express();

// Required for correct client-IP handling behind load balancers / API gateways.
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(requestIdMiddleware);
app.use(requestMetricsMiddleware);
applySecurityMiddlewares(app);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

app.use(attachResponseHelpers);
app.use('/health', healthRoute);
app.use(rateLimiter);
app.use(env.API_PREFIX, routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
