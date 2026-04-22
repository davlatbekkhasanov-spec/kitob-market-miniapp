const { q } = require('../app');

async function listProductsForApi() {
  const r = await q(`SELECT b.id, b.title, b.sale_price, b.stock_qty, b.image, b.active, c.name AS category_name
                     FROM books b
                     LEFT JOIN categories c ON c.id=b.category_id
                     ORDER BY b.id DESC`);
  return r.rows;
}

module.exports = { listProductsForApi };
