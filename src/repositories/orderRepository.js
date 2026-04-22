const { q } = require('../config/db');

async function getBatchIdByOrderId(orderId) {
  const r = await q(`SELECT batch_id FROM customer_orders WHERE id=$1`, [orderId]);
  return String(r.rows[0]?.batch_id || '');
}

async function updateStatusByBatch(batchId, status) {
  await q(`UPDATE customer_orders SET status=$1 WHERE batch_id=$2`, [status, batchId]);
}

async function updateReceiptSentByBatch(batchId) {
  await q(`UPDATE customer_orders SET receipt_sent=TRUE WHERE batch_id=$1`, [batchId]);
}

async function updatePaymentStatusByBatch(batchId, paymentStatus) {
  await q(`UPDATE customer_orders SET payment_status=$1 WHERE batch_id=$2`, [paymentStatus, batchId]);
}

module.exports = {
  getBatchIdByOrderId,
  updateStatusByBatch,
  updateReceiptSentByBatch,
  updatePaymentStatusByBatch,
};
