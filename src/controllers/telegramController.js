function createTelegramController(service, deps) {
  const { statusActionSig } = deps;

  return {
    async status(req, res) {
      try {
        const orderId = Number(req.params.orderId);
        const status = String(req.params.status || '');
        const sig = String(req.params.sig || '');
        const out = await service.handleStatusAction(orderId, status, sig, statusActionSig);
        return res.status(out.code).send(out.body);
      } catch (_e) {
        return res.status(500).send('Xatolik');
      }
    },

    async webhook(req, res) {
      try {
        await service.handleWebhook(req.body || {});
        return res.json({ ok: true });
      } catch (e) {
        console.error(e);
        return res.json({ ok: true });
      }
    },

    async bindStatus(req, res) {
      try {
        const token = String(req.query.token || req.signedCookies.tg_bind_token || '').trim();
        const out = await service.bindStatus(token);
        return res.json(out);
      } catch (_e) {
        return res.json({ ok: true, verified: false });
      }
    },

    async webappAuth(req, res) {
      try {
        const out = await service.webappAuth(req, res);
        return res.status(out.code).json(out.body);
      } catch (e) {
        return res.status(500).json({ ok: false, message: e.message || 'Xatolik' });
      }
    },
  };
}

module.exports = { createTelegramController };
