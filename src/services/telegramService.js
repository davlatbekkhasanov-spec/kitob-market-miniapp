const orderRepository = require('../repositories/orderRepository');
const telegramBindingRepository = require('../repositories/telegramBindingRepository');

function createTelegramService(deps) {
  const {
    tg,
    decodeBatchToken,
    sourceMeta,
    openWebAppButton,
    normalizeTelegramTarget,
    statusLabel,
    updateGroupOrderMessage,
    sendReceiptNotifications,
    verifyTelegramInitData,
    ensureBindToken,
    TELEGRAM_GROUP_CHAT_ID,
  } = deps;

  async function handleStatusAction(orderId, status, sig, statusActionSig) {
    if (!orderId || !['delivered', 'returned'].includes(status)) return { code: 400, body: "Noto'g'ri so'rov" };
    if (sig !== statusActionSig(orderId, status)) return { code: 403, body: "Ruxsat yo'q" };
    const batch = await orderRepository.getBatchIdByOrderId(orderId);
    if (!batch) return { code: 404, body: 'Topilmadi' };
    await orderRepository.updateStatusByBatch(batch, status);
    if (status === 'delivered') {
      await orderRepository.updateReceiptSentByBatch(batch);
      await sendReceiptNotifications(batch);
    }
    await updateGroupOrderMessage(batch);
    return {
      code: 200,
      body: `<html><body style="font-family:Arial;padding:24px"><h2>✅ Holat yangilandi: ${statusLabel(status)}</h2><p>Telegramga qaytishingiz mumkin.</p></body></html>`,
    };
  }

  async function handleWebhook(update = {}) {
    if (update.callback_query && update.callback_query.data) {
      const data = String(update.callback_query.data);
      try { await tg('answerCallbackQuery', { callback_query_id: update.callback_query.id, text: "So'rov qabul qilindi ✅" }); } catch (_e) {}
      const mOrder = data.match(/^o:(\d+):(d|r)$/);
      const m2 = data.match(/^b2:([^:]+):(d|r)$/);
      const mLegacy = data.match(/^batch:(.+):(delivered|returned)$/);
      const mPay = data.match(/^pay:(\d+):(cash|online)$/);
      if (mOrder || m2 || mLegacy || mPay) {
        let batch = '';
        let status = '';
        if (mPay) {
          const orderId = Number(mPay[1]);
          const payKind = mPay[2];
          batch = await orderRepository.getBatchIdByOrderId(orderId);
          if (!batch) return;
          await orderRepository.updatePaymentStatusByBatch(batch, payKind === 'online' ? 'paid' : 'confirmed');
          await updateGroupOrderMessage(batch);
        } else {
          if (mOrder) {
            status = mOrder[2] === 'd' ? 'delivered' : 'returned';
            batch = await orderRepository.getBatchIdByOrderId(Number(mOrder[1]));
          } else if (m2) {
            batch = decodeBatchToken(m2[1]);
            status = m2[2] === 'd' ? 'delivered' : 'returned';
          } else {
            batch = mLegacy[1];
            status = mLegacy[2];
          }
          if (!batch) return;
          await orderRepository.updateStatusByBatch(batch, status);
          if (status === 'delivered') {
            await orderRepository.updateReceiptSentByBatch(batch);
            await sendReceiptNotifications(batch);
          }
          await updateGroupOrderMessage(batch);
        }
      } else {
        const fb = data.match(/^feedback:(\d+)$/);
        if (fb) {
          const orderId = Number(fb[1]);
          const chatId = String(update.callback_query.from?.id || '');
          if (chatId) {
            const batchId = String(await orderRepository.getBatchIdByOrderId(orderId) || '').trim();
            await telegramBindingRepository.upsertPendingFeedback(chatId, orderId, batchId);
            await tg('sendMessage', { chat_id: chatId, text: "Iltimos, taklif yoki shikoyatingizni bitta xabar qilib yozing. Biz uni guruhga yuboramiz." });
          }
        }
      }
    }

    if (update.message && update.message.text && update.message.chat && update.message.chat.type === 'private') {
      const chatId = String(update.message.chat.id);
      const txt = String(update.message.text || '').trim();
      const username = String(update.message.from?.username ? `@${update.message.from.username}` : '');
      const startVerifyMatch = txt.match(/^\/start\s+verify_([a-f0-9]{24})$/i);
      const startSourceMatch = txt.match(/^\/start\s+([A-Za-z0-9_-]{1,64})$/i);
      if (startVerifyMatch) {
        const token = startVerifyMatch[1];
        await telegramBindingRepository.upsertTelegramBinding(token, chatId, username);
        await tg('sendMessage', { chat_id: chatId, text: "✅ Shaxsingiz tasdiqlandi. Endi buyurtma berishingiz mumkin." });
      } else if (txt === '/start' || startSourceMatch) {
        const rawSource = startSourceMatch ? startSourceMatch[1] : '';
        const meta = sourceMeta(rawSource);
        const caption = "Assalomu alaykum! Pastdagi tugma orqali kirib buyurtma bering.";
        await tg('sendMessage', { chat_id: chatId, text: caption, reply_markup: { inline_keyboard: [[openWebAppButton(meta.code)]] } });
      }
      const pending = await telegramBindingRepository.getPendingFeedbackByChatId(chatId);
      if (pending) {
        const orderId = pending.order_id;
        const batchLabel = String(pending.batch_id || '').trim() || `Zakaz #${orderId}`;
        if (txt) {
          await tg('sendMessage', { chat_id: TELEGRAM_GROUP_CHAT_ID, text: `💬 Mijoz fikri (${batchLabel}):\n${txt}` });
        }
        await telegramBindingRepository.deletePendingFeedbackByChatId(chatId);
        await tg('sendMessage', { chat_id: chatId, text: 'Rahmat! Fikringiz qabul qilindi ✅' });
      }
    }
  }

  async function bindStatus(token) {
    if (!token) return { ok: true, verified: false };
    const row = await telegramBindingRepository.getTelegramBindingByToken(token);
    return { ok: true, verified: Boolean(row), chat_id: String(row?.chat_id || '') };
  }

  async function webappAuth(req, res) {
    const token = String(req.body.bindToken || req.signedCookies.tg_bind_token || '').trim() || ensureBindToken(req, res);
    const initData = String(req.body.initData || '').trim();
    const telegramId = String(req.body.id || '').trim();
    const username = String(req.body.username || '').trim();
    if (!token || !telegramId) return { code: 400, body: { ok: false, message: "Ma'lumot yetarli emas" } };
    if (initData && !verifyTelegramInitData(initData)) return { code: 403, body: { ok: false, message: "Telegram ma'lumotlari tasdiqlanmadi" } };
    await telegramBindingRepository.upsertTelegramBinding(token, telegramId, username);
    return { code: 200, body: { ok: true, verified: true, chat_id: telegramId, username } };
  }

  return { handleStatusAction, handleWebhook, bindStatus, webappAuth };
}

module.exports = { createTelegramService };
