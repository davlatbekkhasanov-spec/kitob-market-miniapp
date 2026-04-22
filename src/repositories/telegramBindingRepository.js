const { q } = require('../config/db');

async function upsertTelegramBinding(token, chatId, username) {
  await q(`INSERT INTO telegram_bindings(token, chat_id, username)
           VALUES ($1,$2,$3)
           ON CONFLICT (token) DO UPDATE SET chat_id=EXCLUDED.chat_id, username=EXCLUDED.username, updated_at=NOW()`,
  [token, chatId, username]);
}

async function getTelegramBindingByToken(token) {
  const r = await q(`SELECT chat_id FROM telegram_bindings WHERE token=$1`, [token]);
  return r.rows[0] || null;
}

async function upsertPendingFeedback(chatId, orderId, batchId) {
  await q(`INSERT INTO pending_feedback(chat_id, order_id, batch_id) VALUES ($1,$2,$3)
           ON CONFLICT (chat_id) DO UPDATE SET order_id=EXCLUDED.order_id, batch_id=EXCLUDED.batch_id, created_at=NOW()`, [chatId, orderId, batchId]);
}

async function getPendingFeedbackByChatId(chatId) {
  const r = await q(`SELECT order_id, batch_id FROM pending_feedback WHERE chat_id=$1`, [chatId]);
  return r.rows[0] || null;
}

async function deletePendingFeedbackByChatId(chatId) {
  await q(`DELETE FROM pending_feedback WHERE chat_id=$1`, [chatId]);
}

module.exports = {
  upsertTelegramBinding,
  getTelegramBindingByToken,
  upsertPendingFeedback,
  getPendingFeedbackByChatId,
  deletePendingFeedbackByChatId,
};
