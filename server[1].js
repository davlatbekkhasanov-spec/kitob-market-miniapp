const express = require("express");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const PDFDocument = require("pdfkit");
const { Pool } = require("pg");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PIN = process.env.ADMIN_PIN || "2026";
const SESSION_SECRET = process.env.SESSION_SECRET || "kitob-market-secret-change-me";
const UPLOAD_DIR = path.join(__dirname, "uploads");

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes("localhost")
    ? false
    : { rejectUnauthorized: false },
});

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const safeExt = path.extname(file.originalname || "").toLowerCase() || ".jpg";
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${safeExt}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ["image/jpeg", "image/png", "image/webp", "image/jpg"].includes(file.mimetype);
    if (!ok) return cb(new Error("Faqat JPG, PNG yoki WEBP mumkin"));
    cb(null, true);
  }
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser(SESSION_SECRET));
app.use("/uploads", express.static(UPLOAD_DIR));

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function money(value) {
  return Number(value || 0).toLocaleString("ru-RU") + " so'm";
}

function signAdmin() {
  return crypto
    .createHash("sha256")
    .update(`${ADMIN_PIN}|${SESSION_SECRET}`)
    .digest("hex");
}

function isAdmin(req) {
  return req.signedCookies.admin === signAdmin();
}

function requireAdmin(req, res, next) {
  if (!isAdmin(req)) return res.redirect("/admin/login");
  next();
}

function layout(title, body, opts = {}) {
  const adminBtn = opts.admin ? `<a class="btn soft" href="/admin">Boshqaruv</a>` : "";
  return `<!doctype html>
<html lang="uz">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
:root{
  --bg:#f3f6fb;
  --card:#ffffff;
  --line:#dce6f7;
  --text:#122033;
  --muted:#617089;
  --primary:#2f6fff;
  --dark:#13213b;
  --green:#17a34a;
  --red:#dc3c3c;
}
*{box-sizing:border-box}
body{
  margin:0;
  font-family:Arial,Helvetica,sans-serif;
  background:linear-gradient(180deg,#0f1c34 0, #0f1c34 170px, var(--bg) 170px);
  color:var(--text);
}
.top{
  max-width:1100px;
  margin:0 auto;
  padding:20px 14px 26px;
  color:#fff;
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
  gap:12px;
}
.brand{font-size:34px;font-weight:900}
.sub{color:#b9c8e8;margin-top:4px}
.wrap{max-width:1100px;margin:0 auto;padding:0 14px 80px}
.hero{
  background:linear-gradient(135deg,#16284b,#223e73);
  color:#fff;
  border-radius:28px;
  padding:22px;
  box-shadow:0 16px 42px rgba(13,24,47,.25);
}
h1,h2,h3{margin:0 0 12px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-top:18px}
.card{
  background:var(--card);
  border-radius:22px;
  padding:14px;
  box-shadow:0 10px 30px rgba(19,33,59,.08);
}
.book-image{
  height:220px;
  background:#e8eef8;
  border-radius:18px;
  display:flex;
  align-items:center;
  justify-content:center;
  overflow:hidden;
}
.book-image img{width:100%;height:100%;object-fit:cover}
.book-title{font-size:22px;font-weight:900;margin-top:12px}
.muted{color:var(--muted)}
.price{font-size:22px;font-weight:900;margin-top:12px}
.stock{margin-top:8px;font-weight:700}
.stock.ok{color:var(--green)}
.stock.no{color:var(--red)}
.panel{
  background:#fff;
  border-radius:24px;
  padding:18px;
  box-shadow:0 10px 30px rgba(19,33,59,.08);
  margin-top:18px;
}
.nav,.actions{display:flex;gap:10px;flex-wrap:wrap}
.btn,button{
  border:0;
  border-radius:14px;
  padding:11px 14px;
  text-decoration:none;
  background:var(--primary);
  color:#fff;
  font-weight:800;
  cursor:pointer;
}
.btn.dark{background:var(--dark)}
.btn.soft{background:#e8f0ff;color:#1741a5}
.btn.red{background:var(--red)}
.btn.green{background:var(--green)}
.form{display:grid;gap:12px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.grid4{display:grid;grid-template-columns:1.6fr .8fr .9fr .9fr;gap:10px}
input,select,textarea{
  width:100%;
  border:1px solid var(--line);
  border-radius:14px;
  padding:12px 13px;
  font-size:16px;
  background:#fff;
}
textarea{min-height:90px;resize:vertical}
table{width:100%;border-collapse:collapse}
th,td{padding:10px 8px;border-bottom:1px solid #edf2fb;text-align:left;vertical-align:top;font-size:14px}
.badge{
  display:inline-block;
  background:#eaf1ff;
  color:#1741a5;
  border-radius:999px;
  padding:5px 10px;
  font-size:12px;
  font-weight:800;
}
.alert{
  border-radius:16px;
  padding:12px 14px;
  font-weight:700;
  margin-bottom:12px;
}
.alert.err{background:#fff0f0;color:#b91c1c}
.alert.ok{background:#edfdf1;color:#0a7a34}
.right{text-align:right}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-top:14px}
.stat{background:#fff;border-radius:20px;padding:16px;box-shadow:0 10px 30px rgba(19,33,59,.08)}
.stat .n{font-size:26px;font-weight:900;margin-top:6px}
.line-item{background:#f8fbff;border:1px solid #e5edf8;border-radius:18px;padding:10px}
@media(max-width:700px){
  .grid2,.grid4{grid-template-columns:1fr}
  .brand{font-size:28px}
}
</style>
</head>
<body>
  <div class="top">
    <div>
      <div class="brand">Kitob Market</div>
      <div class="sub">Chiroyli vitrina + kuchli hisob</div>
    </div>
    ${adminBtn}
  </div>
  <div class="wrap">${body}</div>
</body>
</html>`;
}

async function q(text, params = []) {
  return pool.query(text, params);
}

async function initDb() {
  await q(`CREATE TABLE IF NOT EXISTS counterparties (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT DEFAULT '',
    note TEXT DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`);

  await q(`CREATE TABLE IF NOT EXISTS books (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT DEFAULT '',
    sale_price BIGINT NOT NULL DEFAULT 0,
    image TEXT DEFAULT '',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`);

  await q(`ALTER TABLE books ADD COLUMN IF NOT EXISTS author TEXT DEFAULT ''`);
  await q(`ALTER TABLE books ADD COLUMN IF NOT EXISTS sale_price BIGINT NOT NULL DEFAULT 0`);
  await q(`ALTER TABLE books ADD COLUMN IF NOT EXISTS image TEXT DEFAULT ''`);
  await q(`ALTER TABLE books ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE`);
  await q(`ALTER TABLE books ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW()`);
  await q(`ALTER TABLE books ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW()`);

  await q(`CREATE TABLE IF NOT EXISTS purchases (
    id BIGSERIAL PRIMARY KEY,
    doc_no TEXT UNIQUE,
    doc_date DATE NOT NULL DEFAULT CURRENT_DATE,
    counterparty_id BIGINT REFERENCES counterparties(id) ON DELETE SET NULL,
    note TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft',
    total_sum BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`);

  await q(`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS doc_no TEXT`);
  await q(`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS doc_date DATE NOT NULL DEFAULT CURRENT_DATE`);
  await q(`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS counterparty_id BIGINT`);
  await q(`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS note TEXT DEFAULT ''`);
  await q(`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft'`);
  await q(`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS total_sum BIGINT NOT NULL DEFAULT 0`);
  await q(`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW()`);
  await q(`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW()`);

  await q(`CREATE TABLE IF NOT EXISTS purchase_lines (
    id BIGSERIAL PRIMARY KEY,
    purchase_id BIGINT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    book_id BIGINT NOT NULL REFERENCES books(id) ON DELETE RESTRICT,
    qty INT NOT NULL CHECK (qty > 0),
    price BIGINT NOT NULL CHECK (price >= 0),
    line_sum BIGINT NOT NULL CHECK (line_sum >= 0)
  )`);

  await q(`CREATE TABLE IF NOT EXISTS sales (
    id BIGSERIAL PRIMARY KEY,
    doc_no TEXT UNIQUE,
    doc_date DATE NOT NULL DEFAULT CURRENT_DATE,
    customer_name TEXT DEFAULT '',
    customer_phone TEXT DEFAULT '',
    payment_method TEXT DEFAULT 'naqd',
    note TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'posted',
    total_sum BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`);

  await q(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS doc_no TEXT`);
  await q(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS doc_date DATE NOT NULL DEFAULT CURRENT_DATE`);
  await q(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_name TEXT DEFAULT ''`);
  await q(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_phone TEXT DEFAULT ''`);
  await q(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'naqd'`);
  await q(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS note TEXT DEFAULT ''`);
  await q(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'posted'`);
  await q(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS total_sum BIGINT NOT NULL DEFAULT 0`);
  await q(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW()`);
  await q(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW()`);

  await q(`CREATE TABLE IF NOT EXISTS sale_lines (
    id BIGSERIAL PRIMARY KEY,
    sale_id BIGINT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    book_id BIGINT NOT NULL REFERENCES books(id) ON DELETE RESTRICT,
    qty INT NOT NULL CHECK (qty > 0),
    price BIGINT NOT NULL CHECK (price >= 0),
    line_sum BIGINT NOT NULL CHECK (line_sum >= 0)
  )`);

  await q(`CREATE TABLE IF NOT EXISTS counters (
    name TEXT PRIMARY KEY,
    last_value BIGINT NOT NULL DEFAULT 0
  )`);

  await q(`INSERT INTO counters(name,last_value) VALUES ('purchase',0) ON CONFLICT (name) DO NOTHING`);
  await q(`INSERT INTO counters(name,last_value) VALUES ('sale',0) ON CONFLICT (name) DO NOTHING`);
}

async function nextDocNo(client, kind) {
  const r = await client.query(
    `UPDATE counters SET last_value = last_value + 1 WHERE name = $1 RETURNING last_value`,
    [kind]
  );
  const n = Number(r.rows[0].last_value);
  return `${kind === "purchase" ? "PR" : "SL"}-${String(n).padStart(6, "0")}`;
}

async function booksWithStock(includeInactive = false) {
  const where = includeInactive ? "" : "WHERE b.active = TRUE";
  const result = await q(`
    SELECT
      b.id,b.title,b.author,b.sale_price,b.image,b.active,
      COALESCE((SELECT SUM(pl.qty) FROM purchase_lines pl JOIN purchases p ON p.id=pl.purchase_id WHERE p.status='posted' AND pl.book_id=b.id),0)
      - COALESCE((SELECT SUM(sl.qty) FROM sale_lines sl JOIN sales s ON s.id=sl.sale_id WHERE s.status='posted' AND sl.book_id=b.id),0)
      AS qty_left
    FROM books b
    ${where}
    ORDER BY b.id DESC
  `);
  return result.rows;
}

function purchaseLinesHtml(books, lines = [], count = 5) {
  let html = "";
  for (let i = 0; i < count; i++) {
    const line = lines[i] || {};
    const options = books.map((b) =>
      `<option value="${b.id}" ${Number(line.book_id) === Number(b.id) ? "selected" : ""}>${escapeHtml(b.title)}</option>`
    ).join("");
    html += `
      <div class="line-item">
        <div class="grid4">
          <select name="book_id_${i}">
            <option value="">Kitob tanlang</option>
            ${options}
          </select>
          <input type="number" name="qty_${i}" min="1" value="${Number(line.qty || "")}" placeholder="Soni" />
          <input type="number" name="price_${i}" min="0" value="${Number(line.price || "")}" placeholder="Narx" />
          <input type="text" disabled value="${line.line_sum ? money(line.line_sum) : ""}" placeholder="Summa" />
        </div>
      </div>`;
  }
  return html;
}

function collectLines(body) {
  const lines = [];
  for (let i = 0; i < 20; i++) {
    const book_id = Number(body[`book_id_${i}`] || 0);
    const qty = Number(body[`qty_${i}`] || 0);
    const price = Number(body[`price_${i}`] || 0);
    if (book_id && qty > 0 && price >= 0) {
      lines.push({ book_id, qty, price, line_sum: qty * price });
    }
  }
  return lines;
}

app.get("/", async (req, res, next) => {
  try {
    const books = await booksWithStock(false);
    const cards = books.map((b) => `
      <div class="card">
        <div class="book-image">
          ${b.image ? `<img src="${escapeHtml(b.image)}" alt="${escapeHtml(b.title)}" />` : "📚"}
        </div>
        <div class="book-title">${escapeHtml(b.title)}</div>
        <div class="muted">${escapeHtml(b.author || "")}</div>
        <div class="price">${money(b.sale_price)}</div>
        <div class="stock ${Number(b.qty_left) > 0 ? "ok" : "no"}">
          ${Number(b.qty_left) > 0 ? `Omborda: ${b.qty_left} dona` : "Hozircha qolmagan"}
        </div>
      </div>
    `).join("") || `<div class="panel">Hozircha kitob yo'q</div>`;

    res.send(layout("Kitob Market", `
      <div class="hero">
        <h1>Kitoblar do'koni</h1>
        <div>Har bir kitob bo'yicha narx va qolgan soni ko'rinadi.</div>
      </div>
      <h2 style="margin-top:18px">Mavjud kitoblar</h2>
      <div class="cards">${cards}</div>
    `, { admin: isAdmin(req) }));
  } catch (e) {
    next(e);
  }
});

app.get("/admin/login", (req, res) => {
  res.send(layout("Admin login", `
    <div class="panel" style="max-width:520px;margin:0 auto">
      <h2>Admin kirish</h2>
      <div class="muted">PIN bilan kirasiz</div>
      <form class="form" method="post" action="/admin/login" style="margin-top:12px">
        <input type="password" name="pin" placeholder="PIN" required />
        <button type="submit">Kirish</button>
      </form>
    </div>
  `));
});

app.post("/admin/login", (req, res) => {
  if (String(req.body.pin || "") !== ADMIN_PIN) {
    return res.send(layout("Admin login", `
      <div class="panel" style="max-width:520px;margin:0 auto">
        <div class="alert err">PIN noto'g'ri</div>
        <a class="btn" href="/admin/login">Qayta urinish</a>
      </div>
    `));
  }
  res.cookie("admin", signAdmin(), {
    signed: true,
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    maxAge: 1000 * 60 * 60 * 12
  });
  res.redirect("/admin");
});

app.get("/admin/logout", (_req, res) => {
  res.clearCookie("admin");
  res.redirect("/");
});

app.get("/admin", requireAdmin, async (req, res, next) => {
  try {
    const stats = await q(`
      SELECT
      (SELECT COUNT(*) FROM books) AS books_count,
      (SELECT COUNT(*) FROM counterparties) AS counterparties_count,
      (SELECT COUNT(*) FROM purchases WHERE status='posted') AS purchases_count,
      (SELECT COUNT(*) FROM sales WHERE status='posted') AS sales_count,
      (SELECT COALESCE(SUM(total_sum),0) FROM purchases WHERE status='posted') AS purchases_sum,
      (SELECT COALESCE(SUM(total_sum),0) FROM sales WHERE status='posted') AS sales_sum
    `);
    const s = stats.rows[0];
    res.send(layout("Admin", `
      <div class="panel">
        <div class="nav">
          <a class="btn dark" href="/admin/books">Kitoblar</a>
          <a class="btn dark" href="/admin/counterparties">Kontragentlar</a>
          <a class="btn dark" href="/admin/purchases">Prihodlar</a>
          <a class="btn dark" href="/admin/sales">Sotuvlar</a>
          <a class="btn dark" href="/admin/reports">Hisobotlar</a>
          <a class="btn red" href="/admin/logout">Chiqish</a>
        </div>
        <h2 style="margin-top:14px">Boshqaruv paneli</h2>
        <div class="stats">
          <div class="stat"><div class="muted">Kitoblar</div><div class="n">${s.books_count}</div></div>
          <div class="stat"><div class="muted">Kontragentlar</div><div class="n">${s.counterparties_count}</div></div>
          <div class="stat"><div class="muted">Prihodlar</div><div class="n">${s.purchases_count}</div></div>
          <div class="stat"><div class="muted">Sotuvlar</div><div class="n">${s.sales_count}</div></div>
          <div class="stat"><div class="muted">Jami prihod</div><div class="n">${money(s.purchases_sum)}</div></div>
          <div class="stat"><div class="muted">Jami sotuv</div><div class="n">${money(s.sales_sum)}</div></div>
        </div>
      </div>
    `, { admin: true }));
  } catch (e) {
    next(e);
  }
});

app.get("/admin/books", requireAdmin, async (req, res, next) => {
  try {
    const books = await booksWithStock(true);
    const rows = books.map((b) => `
      <tr>
        <td>${b.id}</td>
        <td>${escapeHtml(b.title)}</td>
        <td>${escapeHtml(b.author || "")}</td>
        <td>${money(b.sale_price)}</td>
        <td>${b.qty_left}</td>
        <td>${b.active ? "Aktiv" : "Nofaol"}</td>
        <td><a class="btn soft" href="/admin/books/${b.id}/edit">Tahrirlash</a></td>
      </tr>
    `).join("");
    res.send(layout("Kitoblar", `
      <div class="panel">
        <div class="nav">
          <a class="btn" href="/admin/books/new">+ Yangi kitob</a>
          <a class="btn dark" href="/admin">← Admin</a>
        </div>
        <h2>Kitoblar</h2>
        <table>
          <tr><th>ID</th><th>Nomi</th><th>Muallif</th><th>Narx</th><th>Qoldiq</th><th>Status</th><th></th></tr>
          ${rows || `<tr><td colspan="7">Ma'lumot yo'q</td></tr>`}
        </table>
      </div>
    `, { admin: true }));
  } catch (e) {
    next(e);
  }
});

app.get("/admin/books/new", requireAdmin, (_req, res) => {
  res.send(layout("Yangi kitob", `
    <div class="panel" style="max-width:760px;margin:0 auto">
      <h2>Yangi kitob</h2>
      <form class="form" method="post" action="/admin/books/new" enctype="multipart/form-data">
        <div class="grid2">
          <input name="title" placeholder="Kitob nomi" required />
          <input name="author" placeholder="Muallif" />
        </div>
        <input type="number" name="sale_price" placeholder="Sotuv narxi" min="0" required />
        <input type="file" name="image" accept="image/*" />
        <button type="submit" class="btn green">Saqlash</button>
      </form>
    </div>
  `, { admin: true }));
});

app.post("/admin/books/new", requireAdmin, upload.single("image"), async (req, res, next) => {
  try {
    const title = String(req.body.title || "").trim();
    const author = String(req.body.author || "").trim();
    const sale_price = Number(req.body.sale_price || 0);
    const image = req.file ? `/uploads/${req.file.filename}` : "";
    await q(
      `INSERT INTO books(title, author, sale_price, image) VALUES ($1,$2,$3,$4)`,
      [title, author, sale_price, image]
    );
    res.redirect("/admin/books");
  } catch (e) {
    next(e);
  }
});

app.get("/admin/books/:id/edit", requireAdmin, async (req, res, next) => {
  try {
    const r = await q(`SELECT * FROM books WHERE id=$1`, [Number(req.params.id)]);
    if (!r.rows.length) return res.status(404).send("Topilmadi");
    const b = r.rows[0];
    res.send(layout("Kitobni tahrirlash", `
      <div class="panel" style="max-width:760px;margin:0 auto">
        <h2>Kitobni tahrirlash</h2>
        <form class="form" method="post" action="/admin/books/${b.id}/edit" enctype="multipart/form-data">
          <div class="grid2">
            <input name="title" value="${escapeHtml(b.title)}" required />
            <input name="author" value="${escapeHtml(b.author || "")}" />
          </div>
          <input type="number" name="sale_price" value="${Number(b.sale_price || 0)}" min="0" required />
          <select name="active">
            <option value="true" ${b.active ? "selected" : ""}>Aktiv</option>
            <option value="false" ${!b.active ? "selected" : ""}>Nofaol</option>
          </select>
          <input type="file" name="image" accept="image/*" />
          <button type="submit" class="btn green">Saqlash</button>
        </form>
      </div>
    `, { admin: true }));
  } catch (e) {
    next(e);
  }
});

app.post("/admin/books/:id/edit", requireAdmin, upload.single("image"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const title = String(req.body.title || "").trim();
    const author = String(req.body.author || "").trim();
    const sale_price = Number(req.body.sale_price || 0);
    const active = String(req.body.active || "true") === "true";
    if (req.file) {
      await q(
        `UPDATE books SET title=$1, author=$2, sale_price=$3, active=$4, image=$5, updated_at=NOW() WHERE id=$6`,
        [title, author, sale_price, active, `/uploads/${req.file.filename}`, id]
      );
    } else {
      await q(
        `UPDATE books SET title=$1, author=$2, sale_price=$3, active=$4, updated_at=NOW() WHERE id=$5`,
        [title, author, sale_price, active, id]
      );
    }
    res.redirect("/admin/books");
  } catch (e) {
    next(e);
  }
});

app.get("/admin/counterparties", requireAdmin, async (_req, res, next) => {
  try {
    const r = await q(`SELECT * FROM counterparties ORDER BY id DESC`);
    const rows = r.rows.map((c) => `
      <tr>
        <td>${c.id}</td>
        <td>${escapeHtml(c.name)}</td>
        <td>${escapeHtml(c.phone || "")}</td>
        <td>${escapeHtml(c.note || "")}</td>
      </tr>
    `).join("");
    res.send(layout("Kontragentlar", `
      <div class="panel">
        <div class="nav">
          <a class="btn" href="/admin/counterparties/new">+ Yangi kontragent</a>
          <a class="btn dark" href="/admin">← Admin</a>
        </div>
        <h2>Kontragentlar</h2>
        <table>
          <tr><th>ID</th><th>Nomi</th><th>Telefon</th><th>Izoh</th></tr>
          ${rows || `<tr><td colspan="4">Hozircha kontragent yo'q</td></tr>`}
        </table>
      </div>
    `, { admin: true }));
  } catch (e) {
    next(e);
  }
});

app.get("/admin/counterparties/new", requireAdmin, (_req, res) => {
  res.send(layout("Yangi kontragent", `
    <div class="panel" style="max-width:760px;margin:0 auto">
      <h2>Yangi kontragent</h2>
      <form class="form" method="post" action="/admin/counterparties/new">
        <input name="name" placeholder="Nomi" required />
        <input name="phone" placeholder="Telefon" />
        <textarea name="note" placeholder="Izoh"></textarea>
        <button type="submit" class="btn green">Saqlash</button>
      </form>
    </div>
  `, { admin: true }));
});

app.post("/admin/counterparties/new", requireAdmin, async (req, res, next) => {
  try {
    await q(
      `INSERT INTO counterparties(name, phone, note) VALUES ($1,$2,$3)`,
      [String(req.body.name || "").trim(), String(req.body.phone || "").trim(), String(req.body.note || "").trim()]
    );
    res.redirect("/admin/counterparties");
  } catch (e) {
    next(e);
  }
});

app.get("/admin/purchases", requireAdmin, async (_req, res, next) => {
  try {
    const r = await q(`
      SELECT p.*, COALESCE(c.name,'-') AS counterparty_name
      FROM purchases p
      LEFT JOIN counterparties c ON c.id = p.counterparty_id
      ORDER BY p.id DESC
    `);
    const rows = r.rows.map((p) => `
      <tr>
        <td>${escapeHtml(p.doc_no || "-")}</td>
        <td>${escapeHtml(String(p.doc_date))}</td>
        <td>${escapeHtml(p.counterparty_name)}</td>
        <td><span class="badge">${escapeHtml(p.status)}</span></td>
        <td>${money(p.total_sum)}</td>
        <td class="actions">
          <a class="btn soft" href="/admin/purchases/${p.id}">Ko'rish</a>
          <a class="btn soft" href="/admin/purchases/${p.id}/edit">Tahrirlash</a>
          ${p.status === "posted" ? `<a class="btn dark" href="/admin/purchases/${p.id}/pdf">PDF</a>` : ""}
        </td>
      </tr>
    `).join("");
    res.send(layout("Prihodlar", `
      <div class="panel">
        <div class="nav">
          <a class="btn" href="/admin/purchases/new">+ Yangi prihod</a>
          <a class="btn dark" href="/admin">← Admin</a>
        </div>
        <h2>Prihodlar</h2>
        <table>
          <tr><th>№</th><th>Sana</th><th>Kontragent</th><th>Status</th><th>Jami</th><th></th></tr>
          ${rows || `<tr><td colspan="6">Prihod yo'q</td></tr>`}
        </table>
      </div>
    `, { admin: true }));
  } catch (e) {
    next(e);
  }
});

app.get("/admin/purchases/new", requireAdmin, async (_req, res, next) => {
  try {
    const books = (await q(`SELECT id,title FROM books WHERE active=TRUE ORDER BY title`)).rows;
    const cps = (await q(`SELECT id,name FROM counterparties ORDER BY name`)).rows;
    const cpOptions = cps.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
    res.send(layout("Yangi prihod", `
      <div class="panel">
        <h2>Yangi prihod</h2>
        <form class="form" method="post" action="/admin/purchases/new">
          <div class="grid2">
            <input type="date" name="doc_date" value="${new Date().toISOString().slice(0,10)}" required />
            <select name="counterparty_id">
              <option value="">Kontragent tanlang</option>
              ${cpOptions}
            </select>
          </div>
          <textarea name="note" placeholder="Izoh"></textarea>
          <div class="form">${purchaseLinesHtml(books, [], 5)}</div>
          <button type="submit" class="btn green">Saqlash (draft)</button>
        </form>
      </div>
    `, { admin: true }));
  } catch (e) {
    next(e);
  }
});

app.post("/admin/purchases/new", requireAdmin, async (req, res, next) => {
  const lines = collectLines(req.body);
  if (!lines.length) return res.status(400).send("Kamida bitta qator kerak");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const h = await client.query(
      `INSERT INTO purchases(doc_date, counterparty_id, note, status) VALUES ($1,$2,$3,'draft') RETURNING id`,
      [req.body.doc_date, req.body.counterparty_id || null, String(req.body.note || "")]
    );
    const purchaseId = h.rows[0].id;
    let total = 0;
    for (const ln of lines) {
      total += ln.line_sum;
      await client.query(
        `INSERT INTO purchase_lines(purchase_id, book_id, qty, price, line_sum) VALUES ($1,$2,$3,$4,$5)`,
        [purchaseId, ln.book_id, ln.qty, ln.price, ln.line_sum]
      );
    }
    await client.query(`UPDATE purchases SET total_sum=$1 WHERE id=$2`, [total, purchaseId]);
    await client.query("COMMIT");
    res.redirect(`/admin/purchases/${purchaseId}`);
  } catch (e) {
    await client.query("ROLLBACK");
    next(e);
  } finally {
    client.release();
  }
});

app.get("/admin/purchases/:id", requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const h = await q(`
      SELECT p.*, COALESCE(c.name,'-') AS counterparty_name, COALESCE(c.phone,'-') AS counterparty_phone
      FROM purchases p
      LEFT JOIN counterparties c ON c.id = p.counterparty_id
      WHERE p.id=$1
    `, [id]);
    if (!h.rows.length) return res.status(404).send("Topilmadi");
    const p = h.rows[0];
    const lines = await q(`
      SELECT pl.*, b.title
      FROM purchase_lines pl
      JOIN books b ON b.id = pl.book_id
      WHERE pl.purchase_id=$1
      ORDER BY pl.id
    `, [id]);

    const rows = lines.rows.map((l) => `
      <tr>
        <td>${escapeHtml(l.title)}</td>
        <td>${l.qty}</td>
        <td>${money(l.price)}</td>
        <td>${money(l.line_sum)}</td>
      </tr>
    `).join("");

    res.send(layout("Prihod", `
      <div class="panel">
        <div class="nav">
          <a class="btn dark" href="/admin/purchases">← Prihodlar</a>
          <a class="btn soft" href="/admin/purchases/${id}/edit">Tahrirlash</a>
          ${p.status === "draft" ? `<form method="post" action="/admin/purchases/${id}/post" style="display:inline"><button type="submit" class="btn green">Provodka qilish</button></form>` : ""}
          ${p.status === "posted" ? `<a class="btn" href="/admin/purchases/${id}/pdf">PDF yuklab olish</a>` : ""}
        </div>
        <h2>Prihod ${escapeHtml(p.doc_no || "(draft)")}</h2>
        <div class="grid2">
          <div class="card"><b>Sana:</b><br>${escapeHtml(String(p.doc_date))}</div>
          <div class="card"><b>Kontragent:</b><br>${escapeHtml(p.counterparty_name)}</div>
        </div>
        <div style="margin-top:12px" class="muted">Status: ${escapeHtml(p.status)}</div>
        <div class="muted">Izoh: ${escapeHtml(p.note || "-")}</div>
        <table style="margin-top:12px">
          <tr><th>Kitob</th><th>Soni</th><th>Prihod narxi</th><th>Summa</th></tr>
          ${rows}
        </table>
        <div class="right" style="margin-top:12px;font-size:20px;font-weight:900">Jami: ${money(p.total_sum)}</div>
      </div>
    `, { admin: true }));
  } catch (e) {
    next(e);
  }
});

app.get("/admin/purchases/:id/edit", requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const pRes = await q(`SELECT * FROM purchases WHERE id=$1`, [id]);
    if (!pRes.rows.length) return res.status(404).send("Topilmadi");
    const p = pRes.rows[0];
    const lines = (await q(`SELECT * FROM purchase_lines WHERE purchase_id=$1 ORDER BY id`, [id])).rows;
    const books = (await q(`SELECT id,title FROM books WHERE active=TRUE ORDER BY title`)).rows;
    const cps = (await q(`SELECT id,name FROM counterparties ORDER BY name`)).rows;
    const cpOptions = cps.map((c) => `<option value="${c.id}" ${Number(c.id) === Number(p.counterparty_id) ? "selected" : ""}>${escapeHtml(c.name)}</option>`).join("");

    res.send(layout("Prihodni tahrirlash", `
      <div class="panel">
        <h2>Prihodni tahrirlash</h2>
        ${p.status === "posted" ? `<div class="alert ok">Saqlasangiz draft bo'ladi va qayta provodka qilasiz.</div>` : ""}
        <form class="form" method="post" action="/admin/purchases/${id}/edit">
          <div class="grid2">
            <input type="date" name="doc_date" value="${escapeHtml(String(p.doc_date))}" required />
            <select name="counterparty_id">
              <option value="">Kontragent tanlang</option>
              ${cpOptions}
            </select>
          </div>
          <textarea name="note">${escapeHtml(p.note || "")}</textarea>
          <div class="form">${purchaseLinesHtml(books, lines, Math.max(5, lines.length + 2))}</div>
          <button type="submit" class="btn green">Saqlash</button>
        </form>
      </div>
    `, { admin: true }));
  } catch (e) {
    next(e);
  }
});

app.post("/admin/purchases/:id/edit", requireAdmin, async (req, res, next) => {
  const id = Number(req.params.id);
  const lines = collectLines(req.body);
  if (!lines.length) return res.status(400).send("Kamida bitta qator kerak");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE purchases SET doc_date=$1, counterparty_id=$2, note=$3, status='draft', doc_no=NULL, updated_at=NOW() WHERE id=$4`,
      [req.body.doc_date, req.body.counterparty_id || null, String(req.body.note || ""), id]
    );
    await client.query(`DELETE FROM purchase_lines WHERE purchase_id=$1`, [id]);
    let total = 0;
    for (const ln of lines) {
      total += ln.line_sum;
      await client.query(
        `INSERT INTO purchase_lines(purchase_id, book_id, qty, price, line_sum) VALUES ($1,$2,$3,$4,$5)`,
        [id, ln.book_id, ln.qty, ln.price, ln.line_sum]
      );
    }
    await client.query(`UPDATE purchases SET total_sum=$1 WHERE id=$2`, [total, id]);
    await client.query("COMMIT");
    res.redirect(`/admin/purchases/${id}`);
  } catch (e) {
    await client.query("ROLLBACK");
    next(e);
  } finally {
    client.release();
  }
});

app.post("/admin/purchases/:id/post", requireAdmin, async (req, res, next) => {
  const id = Number(req.params.id);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const r = await client.query(`SELECT * FROM purchases WHERE id=$1 FOR UPDATE`, [id]);
    if (!r.rows.length) throw new Error("Prihod topilmadi");
    const p = r.rows[0];
    if (p.status === "posted") {
      await client.query("ROLLBACK");
      return res.redirect(`/admin/purchases/${id}`);
    }
    const docNo = await nextDocNo(client, "purchase");
    await client.query(`UPDATE purchases SET status='posted', doc_no=$1, updated_at=NOW() WHERE id=$2`, [docNo, id]);
    await client.query("COMMIT");
    res.redirect(`/admin/purchases/${id}`);
  } catch (e) {
    await client.query("ROLLBACK");
    next(e);
  } finally {
    client.release();
  }
});

app.get("/admin/purchases/:id/pdf", requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const h = await q(`
      SELECT p.*, COALESCE(c.name,'-') AS counterparty_name, COALESCE(c.phone,'-') AS counterparty_phone
      FROM purchases p
      LEFT JOIN counterparties c ON c.id = p.counterparty_id
      WHERE p.id=$1
    `, [id]);
    if (!h.rows.length) return res.status(404).send("Topilmadi");
    const p = h.rows[0];
    const lines = await q(`
      SELECT pl.*, b.title
      FROM purchase_lines pl
      JOIN books b ON b.id = pl.book_id
      WHERE pl.purchase_id=$1
      ORDER BY pl.id
    `, [id]);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${p.doc_no || "prihod"}.pdf"`);

    const doc = new PDFDocument({ margin: 40 });
    doc.pipe(res);
    doc.fontSize(18).text("PRIHOD NAKLADNOY", { align: "center" });
    doc.moveDown();
    doc.fontSize(12).text(`Hujjat: ${p.doc_no || "-"}`);
    doc.text(`Sana: ${p.doc_date}`);
    doc.text(`Kontragent: ${p.counterparty_name}`);
    doc.text(`Telefon: ${p.counterparty_phone}`);
    doc.moveDown();

    lines.rows.forEach((l, i) => {
      doc.text(`${i + 1}. ${l.title} | ${l.qty} dona | ${money(l.price)} | ${money(l.line_sum)}`);
    });

    doc.moveDown();
    doc.fontSize(14).text(`Jami: ${money(p.total_sum)}`, { align: "right" });
    doc.end();
  } catch (e) {
    next(e);
  }
});

app.get("/admin/sales", requireAdmin, async (_req, res, next) => {
  try {
    const r = await q(`SELECT * FROM sales ORDER BY id DESC`);
    const rows = r.rows.map((s) => `
      <tr>
        <td>${escapeHtml(s.doc_no || "-")}</td>
        <td>${escapeHtml(String(s.doc_date))}</td>
        <td>${escapeHtml(s.customer_name || "-")}</td>
        <td>${escapeHtml(s.payment_method || "-")}</td>
        <td>${money(s.total_sum)}</td>
        <td><a class="btn soft" href="/admin/sales/${s.id}">Ko'rish</a></td>
      </tr>
    `).join("");
    res.send(layout("Sotuvlar", `
      <div class="panel">
        <div class="nav">
          <a class="btn" href="/admin/sales/new">+ Yangi sotuv</a>
          <a class="btn dark" href="/admin">← Admin</a>
        </div>
        <h2>Sotuvlar</h2>
        <table>
          <tr><th>№</th><th>Sana</th><th>Xaridor</th><th>To'lov</th><th>Jami</th><th></th></tr>
          ${rows || `<tr><td colspan="6">Sotuv yo'q</td></tr>`}
        </table>
      </div>
    `, { admin: true }));
  } catch (e) {
    next(e);
  }
});

app.get("/admin/sales/new", requireAdmin, async (_req, res, next) => {
  try {
    const books = await booksWithStock(true);
    const optionsHtml = purchaseLinesHtml(books, [], 5);
    res.send(layout("Yangi sotuv", `
      <div class="panel">
        <h2>Yangi sotuv</h2>
        <form class="form" method="post" action="/admin/sales/new">
          <div class="grid2">
            <input type="date" name="doc_date" value="${new Date().toISOString().slice(0,10)}" required />
            <input name="customer_name" placeholder="Xaridor nomi" />
          </div>
          <div class="grid2">
            <input name="customer_phone" placeholder="Telefon" />
            <select name="payment_method">
              <option value="naqd">Naqd</option>
              <option value="plastik">Plastik</option>
              <option value="aralash">Aralash</option>
            </select>
          </div>
          <textarea name="note" placeholder="Izoh"></textarea>
          <div class="form">${optionsHtml}</div>
          <button type="submit" class="btn green">Saqlash</button>
        </form>
      </div>
    `, { admin: true }));
  } catch (e) {
    next(e);
  }
});

app.post("/admin/sales/new", requireAdmin, async (req, res, next) => {
  const lines = collectLines(req.body);
  if (!lines.length) return res.status(400).send("Kamida bitta qator kerak");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const ln of lines) {
      const st = await client.query(`
        SELECT
          COALESCE((SELECT SUM(pl.qty) FROM purchase_lines pl JOIN purchases p ON p.id=pl.purchase_id WHERE p.status='posted' AND pl.book_id=$1),0)
          - COALESCE((SELECT SUM(sl.qty) FROM sale_lines sl JOIN sales s ON s.id=sl.sale_id WHERE s.status='posted' AND sl.book_id=$1),0)
          AS qty_left
      `, [ln.book_id]);
      if (Number(st.rows[0].qty_left) < ln.qty) {
        throw new Error("Omborda yetarli qoldiq yo'q");
      }
    }

    const docNo = await nextDocNo(client, "sale");
    const total = lines.reduce((sum, x) => sum + x.line_sum, 0);
    const h = await client.query(
      `INSERT INTO sales(doc_no, doc_date, customer_name, customer_phone, payment_method, note, total_sum)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [
        docNo,
        req.body.doc_date,
        String(req.body.customer_name || ""),
        String(req.body.customer_phone || ""),
        String(req.body.payment_method || "naqd"),
        String(req.body.note || ""),
        total
      ]
    );
    const saleId = h.rows[0].id;

    for (const ln of lines) {
      await client.query(
        `INSERT INTO sale_lines(sale_id, book_id, qty, price, line_sum) VALUES ($1,$2,$3,$4,$5)`,
        [saleId, ln.book_id, ln.qty, ln.price, ln.line_sum]
      );
    }

    await client.query("COMMIT");
    res.redirect(`/admin/sales/${saleId}`);
  } catch (e) {
    await client.query("ROLLBACK");
    next(e);
  } finally {
    client.release();
  }
});

app.get("/admin/sales/:id", requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const h = await q(`SELECT * FROM sales WHERE id=$1`, [id]);
    if (!h.rows.length) return res.status(404).send("Topilmadi");
    const s = h.rows[0];
    const lines = await q(`
      SELECT sl.*, b.title
      FROM sale_lines sl
      JOIN books b ON b.id=sl.book_id
      WHERE sl.sale_id=$1
      ORDER BY sl.id
    `, [id]);

    const rows = lines.rows.map((l) => `
      <tr>
        <td>${escapeHtml(l.title)}</td>
        <td>${l.qty}</td>
        <td>${money(l.price)}</td>
        <td>${money(l.line_sum)}</td>
      </tr>
    `).join("");

    res.send(layout("Sotuv", `
      <div class="panel">
        <div class="nav">
          <a class="btn dark" href="/admin/sales">← Sotuvlar</a>
        </div>
        <h2>Sotuv ${escapeHtml(s.doc_no || "-")}</h2>
        <div class="grid2">
          <div class="card"><b>Sana:</b><br>${escapeHtml(String(s.doc_date))}</div>
          <div class="card"><b>To'lov turi:</b><br>${escapeHtml(s.payment_method || "-")}</div>
        </div>
        <div class="muted" style="margin-top:12px">Xaridor: ${escapeHtml(s.customer_name || "-")}</div>
        <div class="muted">Telefon: ${escapeHtml(s.customer_phone || "-")}</div>
        <table style="margin-top:12px">
          <tr><th>Kitob</th><th>Soni</th><th>Narx</th><th>Summa</th></tr>
          ${rows}
        </table>
        <div class="right" style="margin-top:12px;font-size:20px;font-weight:900">Jami: ${money(s.total_sum)}</div>
      </div>
    `, { admin: true }));
  } catch (e) {
    next(e);
  }
});

app.get("/admin/reports", requireAdmin, async (_req, res, next) => {
  try {
    const stock = await booksWithStock(true);
    const purchaseList = await q(`
      SELECT p.doc_no, p.doc_date, COALESCE(c.name,'-') AS counterparty, p.total_sum
      FROM purchases p
      LEFT JOIN counterparties c ON c.id=p.counterparty_id
      WHERE p.status='posted'
      ORDER BY p.id DESC
      LIMIT 50
    `);

    const salesTop = await q(`
      SELECT b.title,
             COALESCE(SUM(sl.qty),0)::int AS sold_qty,
             COALESCE(SUM(sl.line_sum),0)::bigint AS sold_sum
      FROM books b
      LEFT JOIN sale_lines sl ON sl.book_id=b.id
      LEFT JOIN sales s ON s.id=sl.sale_id AND s.status='posted'
      GROUP BY b.id, b.title
      ORDER BY sold_qty DESC, sold_sum DESC
      LIMIT 50
    `);

    const stockRows = stock.map((b) => `
      <tr>
        <td>${escapeHtml(b.title)}</td>
        <td>${b.qty_left}</td>
        <td>${money(b.sale_price)}</td>
        <td>${money(Number(b.qty_left) * Number(b.sale_price || 0))}</td>
      </tr>
    `).join("");

    const purchaseRows = purchaseList.rows.map((r) => `
      <tr>
        <td>${escapeHtml(r.doc_no || "-")}</td>
        <td>${escapeHtml(String(r.doc_date))}</td>
        <td>${escapeHtml(r.counterparty)}</td>
        <td>${money(r.total_sum)}</td>
      </tr>
    `).join("");

    const salesRows = salesTop.rows.map((r) => `
      <tr>
        <td>${escapeHtml(r.title)}</td>
        <td>${r.sold_qty}</td>
        <td>${money(r.sold_sum)}</td>
      </tr>
    `).join("");

    res.send(layout("Hisobotlar", `
      <div class="panel">
        <div class="nav"><a class="btn dark" href="/admin">← Admin</a></div>
        <h2>Hisobotlar</h2>

        <h3 style="margin-top:18px">1) Ostatka</h3>
        <table>
          <tr><th>Kitob</th><th>Qoldiq soni</th><th>Narx</th><th>Qoldiq summasi</th></tr>
          ${stockRows || `<tr><td colspan="4">Ma'lumot yo'q</td></tr>`}
        </table>

        <h3 style="margin-top:18px">2) Prihodlar reestri</h3>
        <table>
          <tr><th>№</th><th>Sana</th><th>Kontragent</th><th>Jami</th></tr>
          ${purchaseRows || `<tr><td colspan="4">Ma'lumot yo'q</td></tr>`}
        </table>

        <h3 style="margin-top:18px">3) Sotilgan kitoblar</h3>
        <table>
          <tr><th>Kitob</th><th>Sotilgan dona</th><th>Sotuv summasi</th></tr>
          ${salesRows || `<tr><td colspan="3">Ma'lumot yo'q</td></tr>`}
        </table>
      </div>
    `, { admin: true }));
  } catch (e) {
    next(e);
  }
});

app.use((err, req, res, _next) => {
  const message = err && err.message ? err.message : "Noma'lum xatolik";
  res.status(500).send(layout("Xatolik", `
    <div class="panel" style="max-width:760px;margin:0 auto">
      <div class="alert err">${escapeHtml(message)}</div>
      <a class="btn dark" href="javascript:history.back()">← Orqaga</a>
    </div>
  `, { admin: isAdmin(req) }));
});

(async () => {
  try {
    await initDb();
    app.listen(PORT, () => {
      console.log(`Server listening on ${PORT}`);
    });
  } catch (e) {
    console.error("Startup error:", e);
    process.exit(1);
  }
})();