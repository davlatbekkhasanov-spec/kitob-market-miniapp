const express = require("express");
    SELECT s.*, b.title,
      COALESCE((SELECT AVG(pi.price) FROM purchase_items pi WHERE pi.book_id = b.id),0)::bigint AS avg_cost
    FROM sales s
    JOIN books b ON b.id = s.book_id
    ORDER BY s.id DESC
  `);

  const rows = result.rows.length ? result.rows.map((r) => {
    const costTotal = Number(r.avg_cost || 0) * Number(r.qty || 0);
    const profit = Number(r.total_sum || 0) - costTotal;
    return `
      <tr>
        <td>${escapeHtml(r.doc_no)}</td>
        <td>${escapeHtml(r.title)}</td>
        <td>${r.qty}</td>
        <td>${formatMoney(r.sale_price)}</td>
        <td>${formatMoney(r.total_sum)}</td>
        <td>${formatMoney(costTotal)}</td>
        <td>${formatMoney(profit)}</td>
      </tr>
    `;
  }).join("") : `<tr><td colspan="7">Sotuvlar yo'q</td></tr>`;

  res.send(pageTemplate("Sotuvlar", `
    <div class="topbar">
      <h1>💸 Sotuvlar</h1>
      <div class="actions"><a class="btn btn-primary" href="/admin/sales/new">Yangi sotuv</a><a class="btn btn-light" href="/admin">← Admin</a></div>
    </div>
    <div class="card">
      <table>
        <thead><tr><th>№</th><th>Kitob</th><th>Miqdor</th><th>Narx</th><th>Summa</th><th>Tannarx</th><th>Foyda</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `));
});

app.get("/admin/reports/stock", adminOnly, async (req, res) => {
  const result = await pool.query(`
    SELECT
      b.id,b.title,b.author,b.sale_price,
      COALESCE((SELECT SUM(pi.qty) FROM purchase_items pi WHERE pi.book_id=b.id),0) AS in_qty,
      COALESCE((SELECT SUM(s.qty) FROM sales s WHERE s.book_id=b.id),0) AS out_qty,
      COALESCE((SELECT AVG(pi.price) FROM purchase_items pi WHERE pi.book_id=b.id),0)::bigint AS avg_cost
    FROM books b
    ORDER BY b.title ASC
  `);

  const rows = result.rows.map((r) => {
    const stockQty = Number(r.in_qty) - Number(r.out_qty);
    const stockSaleSum = stockQty * Number(r.sale_price || 0);
    const stockCostSum = stockQty * Number(r.avg_cost || 0);
    return `
      <tr>
        <td>${escapeHtml(r.title)}</td>
        <td>${escapeHtml(r.author || "")}</td>
        <td>${Number(r.in_qty)}</td>
        <td>${Number(r.out_qty)}</td>
        <td><strong>${stockQty}</strong></td>
        <td>${formatMoney(r.avg_cost)}</td>
        <td>${formatMoney(r.sale_price)}</td>
        <td>${formatMoney(stockCostSum)}</td>
        <td><strong>${formatMoney(stockSaleSum)}</strong></td>
      </tr>
    `;
  }).join("") || `<tr><td colspan="9">Ma'lumot yo'q</td></tr>`;

  res.send(pageTemplate("Ostatka Hisoboti", `
    <div class="topbar"><h1>📊 Ostatka hisoboti</h1><a class="btn btn-light" href="/admin">← Admin</a></div>
    <div class="card">
      <table>
        <thead>
          <tr>
            <th>Kitob</th><th>Muallif</th><th>Kirim</th><th>Chiqim</th><th>Qoldiq</th><th>O'rtacha tannarx</th><th>Sotuv narxi</th><th>Tannarx summasi</th><th>Sotuv summasi</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `));
});

initDb().then(() => {
  app.listen(PORT, () => console.log("Server running on port " + PORT));
}).catch((err) => {
  console.error("DB init error:", err);
  process.exit(1);
});
