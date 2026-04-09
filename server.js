const express = require("express");
const cookieParser = require("cookie-parser");
const { Pool } = require("pg");

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

const PORT = process.env.PORT || 3000;
const ADMIN_PIN = process.env.ADMIN_PIN || "12345";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

function formatMoney(value) {
  return Number(value || 0).toLocaleString("ru-RU") + " so'm";
}

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isAdmin(req) {
  return req.cookies.admin_auth === "ok";
}

function adminOnly(req, res, next) {
  if (!isAdmin(req)) {
    return res.redirect("/admin/login");
  }
  next();
}

function pageTemplate(title, body) {
  return `
  <!DOCTYPE html>
  <html lang="uz">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${title}</title>
      <style>
        :root{
          --bg:#f5f6fb;
          --card:#ffffff;
          --text:#111827;
          --muted:#6b7280;
          --primary:#2563eb;
          --primary2:#1d4ed8;
          --success:#16a34a;
          --danger:#dc2626;
          --border:#e5e7eb;
          --shadow:0 10px 30px rgba(0,0,0,.08);
          --radius:18px;
        }
        * { box-sizing:border-box; }
        body{
          margin:0;
          padding:0;
          font-family:Arial, Helvetica, sans-serif;
          background:linear-gradient(180deg,#eef2ff 0%, #f8fafc 30%, #f5f6fb 100%);
          color:var(--text);
        }
        .wrap{
          max-width:1100px;
          margin:0 auto;
          padding:20px 14px 40px;
        }
        .hero{
          background:linear-gradient(135deg,#111827 0%, #1e3a8a 100%);
          color:#fff;
          border-radius:26px;
          padding:24px;
          box-shadow:var(--shadow);
          margin-bottom:18px;
        }
        .hero h1{
          margin:0 0 8px 0;
          font-size:32px;
        }
        .hero p{
          margin:0;
          opacity:.9;
          line-height:1.5;
        }
        .nav{
          display:flex;
          flex-wrap:wrap;
          gap:10px;
          margin-top:16px;
        }
        .btn, button{
          border:none;
          cursor:pointer;
          text-decoration:none;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          gap:8px;
          padding:12px 16px;
          border-radius:14px;
          font-weight:700;
          font-size:14px;
          transition:.2s ease;
        }
        .btn-primary, button{
          background:var(--primary);
          color:#fff;
        }
        .btn-primary:hover, button:hover{
          background:var(--primary2);
        }
        .btn-dark{
          background:#111827;
          color:#fff;
        }
        .btn-light{
          background:#fff;
          color:#111827;
          border:1px solid var(--border);
        }
        .grid{
          display:grid;
          grid-template-columns:repeat(auto-fit,minmax(240px,1fr));
          gap:16px;
        }
        .card{
          background:var(--card);
          border-radius:var(--radius);
          padding:18px;
          box-shadow:var(--shadow);
          border:1px solid rgba(255,255,255,.5);
        }
        .card h2,.card h3{
          margin-top:0;
        }
        .muted{
          color:var(--muted);
        }
        .book-card img{
          width:100%;
          height:220px;
          object-fit:cover;
          border-radius:14px;
          background:#eef2ff;
          margin-bottom:12px;
        }
        .book-title{
          font-size:20px;
          font-weight:800;
          margin:0 0 8px 0;
        }
        .price{
          font-size:18px;
          font-weight:800;
          color:var(--success);
        }
        .pill{
          display:inline-block;
          background:#eef2ff;
          color:#1e3a8a;
          padding:6px 10px;
          border-radius:999px;
          font-size:12px;
          font-weight:700;
        }
        .stats{
          display:grid;
          grid-template-columns:repeat(auto-fit,minmax(180px,1fr));
          gap:14px;
          margin-bottom:18px;
        }
        .stat{
          background:var(--card);
          border-radius:18px;
          padding:16px;
          box-shadow:var(--shadow);
        }
        .stat small{
          color:var(--muted);
          display:block;
          margin-bottom:8px;
        }
        .stat strong{
          font-size:24px;
        }
        form{
          display:grid;
          gap:12px;
        }
        label{
          font-size:14px;
          font-weight:700;
          margin-bottom:4px;
          display:block;
        }
        input, select, textarea{
          width:100%;
          border:1px solid var(--border);
          border-radius:14px;
          padding:12px 14px;
          font-size:16px;
          background:#fff;
        }
        textarea{
          min-height:90px;
          resize:vertical;
        }
        table{
          width:100%;
          border-collapse:collapse;
          background:#fff;
          border-radius:14px;
          overflow:hidden;
        }
        th, td{
          padding:12px 10px;
          border-bottom:1px solid var(--border);
          text-align:left;
          vertical-align:top;
          font-size:14px;
        }
        th{
          background:#f8fafc;
        }
        .row{
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:12px;
        }
        .row-3{
          display:grid;
          grid-template-columns:1fr 1fr 1fr;
          gap:12px;
        }
        .center{
          max-width:480px;
          margin:60px auto;
        }
        .error{
          background:#fef2f2;
          color:#991b1b;
          border:1px solid #fecaca;
          padding:12px 14px;
          border-radius:14px;
        }
        .success{
          background:#f0fdf4;
          color:#166534;
          border:1px solid #bbf7d0;
          padding:12px 14px;
          border-radius:14px;
        }
        .topbar{
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap:10px;
          margin-bottom:16px;
          flex-wrap:wrap;
        }
        @media (max-width:700px){
          .hero h1{ font-size:26px; }
          .row, .row-3{ grid-template-columns:1fr; }
        }
      </style>
    </head>
    <body>
      <div class="wrap">
        ${body}
      </div>
    </body>
  </html>
  `;
}

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS counterparties (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT DEFAULT '',
      note TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS books (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT DEFAULT '',
      image_url TEXT DEFAULT '',
      sale_price BIGINT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS purchases (
      id SERIAL PRIMARY KEY,
      doc_no TEXT NOT NULL UNIQUE,
      counterparty_id INTEGER REFERENCES counterparties(id) ON DELETE SET NULL,
      doc_date DATE NOT NULL DEFAULT CURRENT_DATE,
      total_sum BIGINT NOT NULL DEFAULT 0,
      note TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS purchase_items (
      id SERIAL PRIMARY KEY,
      purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
      book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      qty INTEGER NOT NULL,
      price BIGINT NOT NULL,
      line_total BIGINT NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sales (
      id SERIAL PRIMARY KEY,
      book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      qty INTEGER NOT NULL DEFAULT 1,
      sale_price BIGINT NOT NULL DEFAULT 0,
      total_sum BIGINT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
}

async function nextPurchaseNumber() {
  const now = new Date();
  const year = now.getFullYear();

  const result = await pool.query(
    `SELECT doc_no
     FROM purchases
     WHERE doc_no LIKE $1
     ORDER BY id DESC
     LIMIT 1`,
    [`PR-${year}-%`]
  );

  let next = 1;
  if (result.rows.length) {
    const last = result.rows[0].doc_no;
    const parts = last.split("-");
    const n = parseInt(parts[2], 10);
    if (!Number.isNaN(n)) next = n + 1;
  }

  return `PR-${year}-${String(next).padStart(5, "0")}`;
}

async function getDashboardStats() {
  const [books, counterparties, purchases, stock] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS count FROM books`),
    pool.query(`SELECT COUNT(*)::int AS count FROM counterparties`),
    pool.query(`SELECT COALESCE(SUM(total_sum),0)::bigint AS total FROM purchases`),
    pool.query(`
      SELECT COALESCE(SUM(stock_qty),0)::bigint AS qty, COALESCE(SUM(stock_sum),0)::bigint AS total
      FROM (
        SELECT
          b.id,
          COALESCE((
            SELECT SUM(pi.qty) FROM purchase_items pi WHERE pi.book_id = b.id
          ),0) - COALESCE((
            SELECT SUM(s.qty) FROM sales s WHERE s.book_id = b.id
          ),0) AS stock_qty,
          (COALESCE((
            SELECT SUM(pi.qty) FROM purchase_items pi WHERE pi.book_id = b.id
          ),0) - COALESCE((
            SELECT SUM(s.qty) FROM sales s WHERE s.book_id = b.id
          ),0)) * COALESCE(b.sale_price,0) AS stock_sum
        FROM books b
      ) x
    `)
  ]);

  return {
    books: books.rows[0].count,
    counterparties: counterparties.rows[0].count,
    purchasesSum: purchases.rows[0].total,
    stockQty: stock.rows[0].qty,
    stockSum: stock.rows[0].total
  };
}

app.get("/", async (req, res) => {
  try {
    const stats = await getDashboardStats();

    const books = await pool.query(`
      SELECT
        b.*,
        COALESCE((
          SELECT SUM(pi.qty) FROM purchase_items pi WHERE pi.book_id = b.id
        ),0) - COALESCE((
          SELECT SUM(s.qty) FROM sales s WHERE s.book_id = b.id
        ),0) AS stock_qty
      FROM books b
      ORDER BY b.id DESC
    `);

    const cards = books.rows.length
      ? books.rows.map((b) => `
        <div class="card book-card">
          <img src="${escapeHtml(b.image_url || "https://placehold.co/600x800?text=Kitob")}" alt="${escapeHtml(b.title)}" />
          <div class="pill">Omborda: ${b.stock_qty} dona</div>
          <div class="book-title">${escapeHtml(b.title)}</div>
          <div class="muted">${escapeHtml(b.author || "Muallif ko'rsatilmagan")}</div>
          <div style="height:10px"></div>
          <div class="price">${formatMoney(b.sale_price)}</div>
        </div>
      `).join("")
      : `<div class="card"><h3>Hozircha kitoblar yo‘q</h3><div class="muted">Admin paneldan kitob va приход qo‘shing.</div></div>`;

    res.send(pageTemplate("Kitob Market", `
      <div class="hero">
        <h1>📚 Kitob Market</h1>
        <p>Chiroyli katalog, аниқ приход ҳисоби, контрагентлар, омбор қолдиғи ва админ бошқаруви.</p>
        <div class="nav">
          <a class="btn btn-light" href="/admin">Admin panel</a>
          <a class="btn btn-light" href="/admin/reports/stock">Ostatka hisoboti</a>
          <a class="btn btn-light" href="/admin/purchases">Prihodlar</a>
        </div>
      </div>

      <div class="stats">
        <div class="stat"><small>Kitoblar</small><strong>${stats.books}</strong></div>
        <div class="stat"><small>Kontragentlar</small><strong>${stats.counterparties}</strong></div>
        <div class="stat"><small>Jami prihod</small><strong>${formatMoney(stats.purchasesSum)}</strong></div>
        <div class="stat"><small>Ombordagi jami</small><strong>${stats.stockQty} dona / ${formatMoney(stats.stockSum)}</strong></div>
      </div>

      <div class="grid">
        ${cards}
      </div>
    `));
  } catch (error) {
    console.error(error);
    res.status(500).send("Xatolik");
  }
});

app.get("/admin/login", (req, res) => {
  res.send(pageTemplate("Admin Login", `
    <div class="center">
      <div class="card">
        <h2>🔐 Admin kirish</h2>
        <p class="muted">Admin panelga kirish учун код киритинг.</p>
        <form method="POST" action="/admin/login">
          <div>
            <label>Kod / PIN</label>
            <input type="password" name="pin" placeholder="Masalan: 12345" required />
          </div>
          <button type="submit">Kirish</button>
        </form>
        <div style="height:12px"></div>
        <a class="btn btn-light" href="/">← Ortga</a>
      </div>
    </div>
  `));
});

app.post("/admin/login", (req, res) => {
  const pin = String(req.body.pin || "");
  if (pin !== ADMIN_PIN) {
    return res.send(pageTemplate("Admin Login", `
      <div class="center">
        <div class="card">
          <div class="error">Kod noto‘g‘ri</div>
          <div style="height:12px"></div>
          <a class="btn btn-light" href="/admin/login">Qayta urinish</a>
        </div>
      </div>
    `));
  }

  res.cookie("admin_auth", "ok", { httpOnly: true });
  res.redirect("/admin");
});

app.get("/admin/logout", (req, res) => {
  res.clearCookie("admin_auth");
  res.redirect("/");
});

app.get("/admin", adminOnly, async (req, res) => {
  const stats = await getDashboardStats();

  res.send(pageTemplate("Admin Panel", `
    <div class="topbar">
      <h1>🛠 Admin panel</h1>
      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        <a class="btn btn-light" href="/">Katalog</a>
        <a class="btn btn-dark" href="/admin/logout">Chiqish</a>
      </div>
    </div>

    <div class="stats">
      <div class="stat"><small>Kitoblar</small><strong>${stats.books}</strong></div>
      <div class="stat"><small>Kontragentlar</small><strong>${stats.counterparties}</strong></div>
      <div class="stat"><small>Jami prihod</small><strong>${formatMoney(stats.purchasesSum)}</strong></div>
      <div class="stat"><small>Ombor</small><strong>${stats.stockQty} dona</strong></div>
    </div>

    <div class="grid">
      <div class="card">
        <h3>📘 Kitob qo‘shish</h3>
        <p class="muted">Kitob номи, muallif, rasm URL ва sotuv narxini kiriting.</p>
        <a class="btn btn-primary" href="/admin/books/new">Kitob qo‘shish</a>
      </div>

      <div class="card">
        <h3>🏢 Kontragentlar</h3>
        <p class="muted">Yetkazib beruvchilarni qo‘shish ва tanlash.</p>
        <a class="btn btn-primary" href="/admin/counterparties">Kontragentlar</a>
      </div>

      <div class="card">
        <h3>📥 Prihod hujjati</h3>
        <p class="muted">Prihod номер, цена, сумма ва kontрагент bilan kirim qilish.</p>
        <a class="btn btn-primary" href="/admin/purchases/new">Yangi prihod</a>
      </div>

      <div class="card">
        <h3>📊 Hisobotlar</h3>
        <p class="muted">Ostatka ва приходлар рўйхати.</p>
        <a class="btn btn-primary" href="/admin/reports/stock">Ostatka</a>
      </div>
    </div>
  `));
});

app.get("/admin/books/new", adminOnly, (req, res) => {
  res.send(pageTemplate("Yangi Kitob", `
    <div class="topbar">
      <h1>📘 Yangi kitob</h1>
      <a class="btn btn-light" href="/admin">← Admin</a>
    </div>
    <div class="card">
      <form method="POST" action="/admin/books/new">
        <div>
          <label>Kitob nomi</label>
          <input type="text" name="title" required />
        </div>
        <div>
          <label>Muallif</label>
          <input type="text" name="author" />
        </div>
        <div>
          <label>Rasm URL</label>
          <input type="text" name="image_url" placeholder="https://..." />
        </div>
        <div>
          <label>Sotuv narxi (so'm)</label>
          <input type="number" name="sale_price" required />
        </div>
        <button type="submit">Saqlash</button>
      </form>
    </div>
  `));
});

app.post("/admin/books/new", adminOnly, async (req, res) => {
  const { title, author, image_url, sale_price } = req.body;

  await pool.query(
    `INSERT INTO books (title, author, image_url, sale_price)
     VALUES ($1, $2, $3, $4)`,
    [title, author || "", image_url || "", Number(sale_price || 0)]
  );

  res.redirect("/admin");
});

app.get("/admin/counterparties", adminOnly, async (req, res) => {
  const cps = await pool.query(`SELECT * FROM counterparties ORDER BY id DESC`);

  const rows = cps.rows.length
    ? cps.rows.map((c) => `
      <tr>
        <td>${c.id}</td>
        <td>${escapeHtml(c.name)}</td>
        <td>${escapeHtml(c.phone || "")}</td>
        <td>${escapeHtml(c.note || "")}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="4">Hozircha kontragent yo‘q</td></tr>`;

  res.send(pageTemplate("Kontragentlar", `
    <div class="topbar">
      <h1>🏢 Kontragentlar</h1>
      <a class="btn btn-light" href="/admin">← Admin</a>
    </div>

    <div class="grid">
      <div class="card">
        <h3>Yangi kontragent</h3>
        <form method="POST" action="/admin/counterparties">
          <div>
            <label>Nomi</label>
            <input type="text" name="name" required />
          </div>
          <div>
            <label>Telefon</label>
            <input type="text" name="phone" />
          </div>
          <div>
            <label>Izoh</label>
            <textarea name="note"></textarea>
          </div>
          <button type="submit">Qo‘shish</button>
        </form>
      </div>

      <div class="card">
        <h3>Ro‘yxat</h3>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Nomi</th>
              <th>Telefon</th>
              <th>Izoh</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `));
});

app.post("/admin/counterparties", adminOnly, async (req, res) => {
  const { name, phone, note } = req.body;

  await pool.query(
    `INSERT INTO counterparties (name, phone, note)
     VALUES ($1, $2, $3)`,
    [name, phone || "", note || ""]
  );

  res.redirect("/admin/counterparties");
});

app.get("/admin/purchases/new", adminOnly, async (req, res) => {
  const docNo = await nextPurchaseNumber();
  const counterparties = await pool.query(`SELECT * FROM counterparties ORDER BY name ASC`);
  const books = await pool.query(`SELECT * FROM books ORDER BY title ASC`);

  const cpOptions = counterparties.rows.map((c) =>
    `<option value="${c.id}">${escapeHtml(c.name)}</option>`
  ).join("");

  const bookOptions = books.rows.map((b) =>
    `<option value="${b.id}">${escapeHtml(b.title)}</option>`
  ).join("");

  res.send(pageTemplate("Yangi Prihod", `
    <div class="topbar">
      <h1>📥 Yangi prihod</h1>
      <a class="btn btn-light" href="/admin">← Admin</a>
    </div>

    <div class="card">
      <form method="POST" action="/admin/purchases/new">
        <div class="row">
          <div>
            <label>Hujjat raqami</label>
            <input type="text" name="doc_no" value="${docNo}" readonly />
          </div>
          <div>
            <label>Sana</label>
            <input type="date" name="doc_date" value="${new Date().toISOString().slice(0, 10)}" required />
          </div>
        </div>

        <div>
          <label>Kontragent</label>
          <select name="counterparty_id" required>
            <option value="">Tanlang</option>
            ${cpOptions}
          </select>
        </div>

        <div class="row-3">
          <div>
            <label>Kitob</label>
            <select name="book_id" required>
              <option value="">Tanlang</option>
              ${bookOptions}
            </select>
          </div>
          <div>
            <label>Miqdor</label>
            <input type="number" name="qty" min="1" required />
          </div>
          <div>
            <label>Prihod narxi (so'm)</label>
            <input type="number" name="price" min="0" required />
          </div>
        </div>

        <div>
          <label>Izoh</label>
          <textarea name="note"></textarea>
        </div>

        <button type="submit">Prihodni saqlash</button>
      </form>
    </div>
  `));
});

app.post("/admin/purchases/new", adminOnly, async (req, res) => {
  const { doc_no, doc_date, counterparty_id, book_id, qty, price, note } = req.body;

  const q = Number(qty || 0);
  const p = Number(price || 0);
  const total = q * p;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const purchase = await client.query(
      `INSERT INTO purchases (doc_no, doc_date, counterparty_id, total_sum, note)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [doc_no, doc_date, counterparty_id, total, note || ""]
    );

    const purchaseId = purchase.rows[0].id;

    await client.query(
      `INSERT INTO purchase_items (purchase_id, book_id, qty, price, line_total)
       VALUES ($1, $2, $3, $4, $5)`,
      [purchaseId, book_id, q, p, total]
    );

    await client.query("COMMIT");
    res.redirect("/admin/purchases");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).send("Prihodni saqlab bo‘lmadi");
  } finally {
    client.release();
  }
});

app.get("/admin/purchases", adminOnly, async (req, res) => {
  const result = await pool.query(`
    SELECT
      p.id,
      p.doc_no,
      p.doc_date,
      p.total_sum,
      p.note,
      c.name AS counterparty_name
    FROM purchases p
    LEFT JOIN counterparties c ON c.id = p.counterparty_id
    ORDER BY p.id DESC
  `);

  const rows = result.rows.length
    ? result.rows.map((r) => `
      <tr>
        <td>${escapeHtml(r.doc_no)}</td>
        <td>${r.doc_date}</td>
        <td>${escapeHtml(r.counterparty_name || "-")}</td>
        <td>${formatMoney(r.total_sum)}</td>
        <td>${escapeHtml(r.note || "")}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="5">Prihodlar yo‘q</td></tr>`;

  res.send(pageTemplate("Prihodlar", `
    <div class="topbar">
      <h1>📥 Prihodlar</h1>
      <div style="display:flex; gap:10px;">
        <a class="btn btn-primary" href="/admin/purchases/new">Yangi prihod</a>
        <a class="btn btn-light" href="/admin">← Admin</a>
      </div>
    </div>

    <div class="card">
      <table>
        <thead>
          <tr>
            <th>№</th>
            <th>Sana</th>
            <th>Kontragent</th>
            <th>Jami summa</th>
            <th>Izoh</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `));
});

app.get("/admin/reports/stock", adminOnly, async (req, res) => {
  const result = await pool.query(`
    SELECT
      b.id,
      b.title,
      b.author,
      b.sale_price,
      COALESCE((
        SELECT SUM(pi.qty) FROM purchase_items pi WHERE pi.book_id = b.id
      ),0) AS in_qty,
      COALESCE((
        SELECT SUM(s.qty) FROM sales s WHERE s.book_id = b.id
      ),0) AS out_qty
    FROM books b
    ORDER BY b.title ASC
  `);

  const rows = result.rows.map((r) => {
    const stockQty = Number(r.in_qty) - Number(r.out_qty);
    const stockSum = stockQty * Number(r.sale_price || 0);

    return `
      <tr>
        <td>${escapeHtml(r.title)}</td>
        <td>${escapeHtml(r.author || "")}</td>
        <td>${Number(r.in_qty)}</td>
        <td>${Number(r.out_qty)}</td>
        <td><strong>${stockQty}</strong></td>
        <td>${formatMoney(r.sale_price)}</td>
        <td><strong>${formatMoney(stockSum)}</strong></td>
      </tr>
    `;
  }).join("");

  res.send(pageTemplate("Ostatka Hisoboti", `
    <div class="topbar">
      <h1>📊 Ostatka hisoboti</h1>
      <a class="btn btn-light" href="/admin">← Admin</a>
    </div>

    <div class="card">
      <table>
        <thead>
          <tr>
            <th>Kitob</th>
            <th>Muallif</th>
            <th>Kirim</th>
            <th>Chiqim</th>
            <th>Qoldiq</th>
            <th>Sotuv narxi</th>
            <th>Qoldiq summasi</th>
          </tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="7">Ma'lumot yo‘q</td></tr>`}</tbody>
      </table>
    </div>
  `));
});

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log("Server running on port " + PORT);
    });
  })
  .catch((err) => {
    console.error("DB init error:", err);
    process.exit(1);
  });
