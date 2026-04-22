function createTelegramService(deps) {
  const {
    q,
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
    const r = await q(`SELECT batch_id FROM customer_orders WHERE id=$1`, [orderId]);
    const batch = String(r.rows[0]?.batch_id || '');
    if (!batch) return { code: 404, body: 'Topilmadi' };
    await q(`UPDATE customer_orders SET status=$1 WHERE batch_id=$2`, [status, batch]);
    if (status === 'delivered') {
      await q(`UPDATE customer_orders SET receipt_sent=TRUE WHERE batch_id=$1`, [batch]);
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
          const row = await q(`SELECT batch_id FROM customer_orders WHERE id=$1`, [orderId]);
          batch = String(row.rows[0]?.batch_id || '');
          if (!batch) return;
          await q(`UPDATE customer_orders SET payment_status=$1 WHERE batch_id=$2`, [payKind === 'online' ? 'paid' : 'confirmed', batch]);
          await updateGroupOrderMessage(batch);
        } else {
          if (mOrder) {
            status = mOrder[2] === 'd' ? 'delivered' : 'returned';
            const row = await q(`SELECT batch_id FROM customer_orders WHERE id=$1`, [Number(mOrder[1])]);
            batch = String(row.rows[0]?.batch_id || '');
          } else if (m2) {
            batch = decodeBatchToken(m2[1]);
            status = m2[2] === 'd' ? 'delivered' : 'returned';
          } else {
            batch = mLegacy[1];
            status = mLegacy[2];
          }
          if (!batch) return;
          await q(`UPDATE customer_orders SET status=$1 WHERE batch_id=$2`, [status, batch]);
          if (status === 'delivered') {
            await q(`UPDATE customer_orders SET receipt_sent=TRUE WHERE batch_id=$1`, [batch]);
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
            const orderRow = await q(`SELECT batch_id FROM customer_orders WHERE id=$1`, [orderId]);
            const batchId = String(orderRow.rows[0]?.batch_id || '').trim();
            await q(`INSERT INTO pending_feedback(chat_id, order_id, batch_id) VALUES ($1,$2,$3) ON CONFLICT (chat_id) DO UPDATE SET order_id=EXCLUDED.order_id, batch_id=EXCLUDED.batch_id, created_at=NOW()`, [chatId, orderId, batchId]);
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
        await q(`INSERT INTO telegram_bindings(token, chat_id, username) VALUES ($1,$2,$3)
                 ON CONFLICT (token) DO UPDATE SET chat_id=EXCLUDED.chat_id, username=EXCLUDED.username, updated_at=NOW()`, [token, chatId, username]);
        await tg('sendMessage', { chat_id: chatId, text: "✅ Shaxsingiz tasdiqlandi. Endi buyurtma berishingiz mumkin." });
      } else if (txt === '/start' || startSourceMatch) {
        const rawSource = startSourceMatch ? startSourceMatch[1] : '';
        const meta = sourceMeta(rawSource);
        const caption = "Assalomu alaykum! Pastdagi tugma orqali kirib buyurtma bering.";
        await tg('sendMessage', { chat_id: chatId, text: caption, reply_markup: { inline_keyboard: [[openWebAppButton(meta.code)]] } });
      }
      const pending = await q(`SELECT order_id, batch_id FROM pending_feedback WHERE chat_id=$1`, [chatId]);
      if (pending.rows.length) {
        const orderId = pending.rows[0].order_id;
        const batchLabel = String(pending.rows[0].batch_id || '').trim() || `Zakaz #${orderId}`;
        if (txt) {
          await tg('sendMessage', { chat_id: TELEGRAM_GROUP_CHAT_ID, text: `💬 Mijoz fikri (${batchLabel}):\n${txt}` });
        }
        await q(`DELETE FROM pending_feedback WHERE chat_id=$1`, [chatId]);
        await tg('sendMessage', { chat_id: chatId, text: 'Rahmat! Fikringiz qabul qilindi ✅' });
      }
    }
  }

  async function bindStatus(token) {
    if (!token) return { ok: true, verified: false };
    const r = await q(`SELECT chat_id FROM telegram_bindings WHERE token=$1`, [token]);
    return { ok: true, verified: Boolean(r.rows.length), chat_id: String(r.rows[0]?.chat_id || '') };
  }

  async function webappAuth(req, res) {
    const token = String(req.body.bindToken || req.signedCookies.tg_bind_token || '').trim() || ensureBindToken(req, res);
    const initData = String(req.body.initData || '').trim();
    const telegramId = String(req.body.id || '').trim();
    const username = String(req.body.username || '').trim();
    if (!token || !telegramId) return { code: 400, body: { ok: false, message: "Ma'lumot yetarli emas" } };
    if (initData && !verifyTelegramInitData(initData)) return { code: 403, body: { ok: false, message: "Telegram ma'lumotlari tasdiqlanmadi" } };
    await q(`INSERT INTO telegram_bindings(token, chat_id, username)
             VALUES ($1,$2,$3)
             ON CONFLICT (token) DO UPDATE SET chat_id=EXCLUDED.chat_id, username=EXCLUDED.username, updated_at=NOW()`,
    [token, telegramId, username]);
    return { code: 200, body: { ok: true, verified: true, chat_id: telegramId, username } };
  }

  return { handleStatusAction, handleWebhook, bindStatus, webappAuth };
}

module.exports = { createTelegramService };
