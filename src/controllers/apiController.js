const { listProductsForApi } = require('../repositories/bookRepository');

async function getProducts(_req, res, next) {
  try {
    const rows = await listProductsForApi();
    const data = rows.map((b) => ({
      sku: String(b.id || ''),
      barcode: null,
      title: String(b.title || ''),
      price: Number(b.sale_price || 0),
      stock_qty: Number(b.stock_qty || 0),
      image_url: String(b.image || ''),
      category: String(b.category_name || 'Kitob'),
      active: Boolean(b.active),
    }));
    res.json(data);
  } catch (e) {
    next(e);
  }
}

module.exports = { getProducts };
