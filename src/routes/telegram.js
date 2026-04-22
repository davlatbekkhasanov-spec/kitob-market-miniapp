const express = require('express');
const { validate } = require('../middlewares/validate');

function createTelegramRouter(controller) {
  const router = express.Router();

  router.get('/status/:orderId/:status/:sig', controller.status);
  router.post('/webhook', controller.webhook);
  router.get('/bind/status', controller.bindStatus);
  router.post('/webapp-auth', validate((body) => String(body.id || '').trim() ? null : "Ma'lumot yetarli emas"), controller.webappAuth);

  return router;
}

module.exports = { createTelegramRouter };
