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
const SESSION_SECRET = process.env.SESSION_SECRET || "kitob-market-super-secret-2026";
const DELIVERY_FEE = Number(process.env.DELIVERY_FEE || 25000);
const UPLOAD_DIR = path.join(__dirname, "uploads");

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DATABASE_URL && process.env.DATABASE_URL.includes("localhost")
      ? false
      : { rejectUnauthorized: false },
});

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ["image/jpeg", "image/png", "image/webp", "image/jpg"].includes(file.mimetype);
    if (!ok) return cb(new Error("Faqat JPG, PNG yoki WEBP rasm mumkin"));
    cb(null, true);
  },
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser(SESSION_SECRET));
app.use("/uploads", express.static(UPLOAD_DIR));

function q(text, params = []) {
  return pool.query(text, params);
}

function esc(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function money(v) {
  return Number(v || 0).toLocaleString("ru-RU") + " so'm";
}

function signedAdminValue() {
  return crypto
    .createHash("sha256")
    .update(`${ADMIN_PIN}|${SESSION_SECRET}`)
    .digest("hex");
}

function isAdmin(req) {
  return req.signedCookies.admin === signedAdminValue();
}

function requireAdmin(req, res, next) {
  if (!isAdmin(req)) return res.redirect("/admin/login");
  next();
}

function page(title, body, opts = {}) {
  const adminChip = opts.admin
    ? `<a class="btn soft" href="/admin">Admin</a>`
    : `<a class="btn soft" href="/admin/login">Admin</a>`;

  return `<!doctype html>
<html lang="uz">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${esc(title)}</title>
<style>
:root{
  --bg:#f2f5fb;
  --text:#142032;
  --muted:#607089;
  --card:#ffffff;
  --line:#dde6f4;
  --primary:#2f6fff;
  --dark:#15233f;
  --green:#18a34a;
  --red:#d93b3b;
}
*{box-sizing:border-box}
body{
  margin:0;
  font-family:Arial,Helvetica,sans-serif;
  background:linear-gradient(180deg,#0f1e38 0,#0f1e38 170px,var(--bg) 170px);
  color:var(--text)
}
.top{
  max-width:1100px;
  margin:0 auto;
  padding:18px 14px 24px;
  color:#fff;
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
  gap:12px
}
.brand{font-size:34px;font-weight:900}
.sub{color:#c5d1ea;margin-top:4px}
.wrap{max-width:1100px;margin:0 auto;padding:0 14px 90px}
.hero{
  background:linear-gradient(135deg,#182c54,#23417a);
  border-radius:28px;
  color:#fff;
  padding:22px;
  box-shadow:0 16px 40px rgba(15,23,42,.22)
}
.hero h1{margin:0 0 8px;font-size:38px}
.hero p{margin:0;color:#d9e3f7;line-height:1.5}
.panel,.card,.stat{
  background:var(--card);
  border-radius:22px;
  box-shadow:0 10px 28px rgba(15,23,42,.08)
}
.panel{padding:18px;margin-top:18px}
.cards{
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:14px;
  margin-top:18px
}
@media(max-width:700px){
  .cards{grid-template-columns:1fr}
  .hero h1{font-size:30px}
  .brand{font-size:28px}
}
.card{padding:14px}
.book-image{
  height:220px;
  background:#eef3fb;
  border-radius:18px;
  display:flex;
  align-items:center;
  justify-content:center;
  overflow:hidden
}
.book-image img{width:100%;height:100%;object-fit:cover}
.title{font-size:23px;font-weight:900;margin-top:12px}
.muted{color:var(--muted)}
.price{font-size:24px;font-weight:900;margin-top:10px}
.stock{margin-top:8px;font-weight:700}
.stock.ok{color:var(--green)}
.stock.no{color:var(--red)}
.nav,.actions,.searchbar{
  display:flex;
  gap:10px;
  flex-wrap:wrap
}
.btn,button{
  border:0;
  border-radius:14px;
  padding:11px 15px;
  background:var(--primary);
  color:#fff;
  text-decoration:none;
  font-weight:800;
  cursor:pointer
}
.btn.dark{background:var(--dark)}
.btn.soft{background:#e8f0ff;color:#1741a5}
.btn.green{background:var(--green)}
.btn.red{background:var(--red)}
.form{display:grid;gap:12px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media(max-width:700px){.grid2{grid-template-columns:1fr}}
input,select,textarea{
  width:100%;
  border:1px solid var(--line);
  border-radius:14px;
  padding:12px 13px;
  font-size:16px;
  background:#fff
}
textarea{min-height:90px;resize:vertical}
table{width:100%;border-collapse:collapse}
th,td{
  padding:10px 8px;
  border-bottom:1px solid #edf2fb;
  text-align:left;
  vertical-align:top;
  font-size:14px
}
.stat-grid{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(170px,1fr));
  gap:12px;
  margin-top:14px
}
.stat{padding:16px}
.n{font-size:26px;font-weight:900;margin-top:6px}
.alert{
  padding:12px 14px;
  border-radius:16px;
  margin-bottom:12px;
  font-weight:700
}
.alert.err{background:#fff0f0;color:#b91c1c}
.alert.ok{background:#edfdf1;color:#0a7a34}
.badge{
  display:inline-block;
  background:#eaf1ff;
  color:#1741a5;
  border-radius:999px;
  padding:5px 10px;
  font-size:12px;
  font-weight:800
}
.right{text-align:right}
.label{font-size:13px;color:var(--muted);font-weight:700;margin-bottom:4px}
.order-summary{
  background:#f8fbff;
  border:1px solid #e2ebf8;
  border-radius:18px;
  padding:14px
}
</style>
</head>
<body>
  <div class="top">
    <div>
      <div class="brand">Kitob Market</div>
      <div class="sub">Chiroyli vitrina + kuchli hisob</div>
    </div>
    ${adminChip}
  </div>
  <div class="wrap">${body}</div>
</body>
</html>`;
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
    image TEXT DEFAULT '',
    purchase_price BIGINT NOT NULL DEFAULT 0,
    markup_percent NUMERIC(10,2) NOT NULL DEFAULT 0,
    sale_price BIGINT NOT NULL DEFAULT 0,
    stock_qty INT NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`);

  await q(`ALTER TABLE books ADD COLUMN IF NOT EXISTS author TEXT DEFAULT ''`);
  await q(`ALTER TABLE books ADD COLUMN IF NOT EXISTS image TEXT DEFAULT ''`);
  await q(`ALTER TABLE books ADD COLUMN IF NOT EXISTS purchase_price BIGINT NOT NULL DEFAULT 0`);
  await q(`ALTER TABLE books ADD COLUMN IF NOT EXISTS markup_percent NUMERIC(10,2) NOT NULL DEFAULT 0`);
  await q(`ALTER TABLE books ADD COLUMN IF NOT EXISTS sale_price BIGINT NOT NULL DEFAULT 0`);
  await q(`ALTER TABLE books ADD COLUMN IF NOT EXISTS stock_qty INT NOT NULL DEFAULT 0`);
  await q(`ALTER TABLE books ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE`);
  await q(`ALTER TABLE books ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW()`);
  await q(`ALTER TABLE books ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW()`);

  await q(`
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name='books' AND column_name='image_url'
  ) THEN
    UPDATE books
    SET image = COALESCE(NULLIF(image, ''), image_url)
    WHERE COALESCE(image, '') = '';
  END IF;
END $$;
`);

  await q(`
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name='books' AND column_name='price'
  ) THEN
    UPDATE books
    SET
      purchase_price = CASE WHEN COALESCE(purchase_price, 0) = 0 THEN COALESCE(price, 0) ELSE purchase_price END,
      sale_price = CASE WHEN COALESCE(sale_price, 0) = 0 THEN COALESCE(price, 0) ELSE sale_price END
    WHERE price IS NOT NULL;
  END IF;
END $$;
`);

  await q(`
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name='books' AND column_name='price'
  ) THEN
    ALTER TABLE books DROP COLUMN price;
  END IF;
END $$;
`);

  await q(`
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name='books' AND column_name='image_url'
  ) THEN
    ALTER TABLE books DROP COLUMN image_url;
  END IF;
END $$;
`);

  await q(`CREATE TABLE IF NOT EXISTS purchases (
    id BIGSERIAL PRIMARY KEY,
    doc_no TEXT UNIQUE,
    doc_date DATE NOT NULL DEFAULT CURRENT_DATE,
    counterparty_id BIGINT REFERENCES counterparties(id) ON DELETE SET NULL,
    note TEXT DEFAULT '',
    total_sum BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`);

  await q(`CREATE TABLE IF NOT EXISTS purchase_lines (
    id BIGSERIAL PRIMARY KEY,
    purchase_id BIGINT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    book_id BIGINT NOT NULL REFERENCES books(id) ON DELETE RESTRICT,
    qty INT NOT NULL DEFAULT 1,
    purchase_price BIGINT NOT NULL DEFAULT 0,
    markup_percent NUMERIC(10,2) NOT NULL DEFAULT 0,
    sale_price BIGINT NOT NULL DEFAULT 0,
    line_sum BIGINT NOT NULL DEFAULT 0
  )`);

  await q(`CREATE TABLE IF NOT EXISTS customer_orders (
    id BIGSERIAL PRIMARY KEY,
    book_id BIGINT NOT NULL REFERENCES books(id) ON DELETE RESTRICT,
    qty INT NOT NULL DEFAULT 1,
    customer_name TEXT DEFAULT '',
    phone TEXT NOT NULL,
    address_text TEXT DEFAULT '',
    latitude TEXT DEFAULT '',
    longitude TEXT DEFAULT '',
    delivery_fee BIGINT NOT NULL DEFAULT 25000,
    subtotal BIGINT NOT NULL DEFAULT 0,
    total_sum BIGINT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'new',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`);

  await q(`CREATE TABLE IF NOT EXISTS counters (
    name TEXT PRIMARY KEY,
    last_value BIGINT NOT NULL DEFAULT 0
  )`);

  await q(`INSERT INTO counters(name,last_value) VALUES ('purchase',0) ON CONFLICT (name) DO NOTHING`);
}

async function nextPurchaseNo(client) {
  const r = await client.query(`UPDATE counters SET last_value=last_value+1 WHERE name='purchase' RETURNING last_value`);
  return `PR-${String(Number(r.rows[0].last_value)).padStart(6, "0")}`;
}

app.get("/", async (req, res, next) => {
  try {
    const search = String(req.query.search || "").trim();
    const params = [];
    let where = `WHERE active = TRUE AND stock_qty > 0`;
    if (search) {
      params.push(`%${search}%`);
      where += ` AND (title ILIKE $1 OR author ILIKE $1)`;
    }
    const books = await q(`SELECT * FROM books ${where} ORDER BY id DESC`, params);

    const cards = books.rows.map((b) => `
      <div class="card">
        <div class="book-image">${b.image ? `<img src="${esc(b.image)}" alt="${esc(b.title)}" />` : "📚"}</div>
        <div class="title">${esc(b.title)}</div>
        <div class="muted">${esc(b.author || "")}</div>
        <div class="price">${money(b.sale_price)}</div>
        <div class="stock ok">Omborda: ${b.stock_qty} dona</div>
        <div class="actions" style="margin-top:12px"><a class="btn green" href="/order/${b.id}">Buyurtma berish</a></div>
      </div>
    `).join("") || `<div class="panel">Qidiruv bo'yicha kitob topilmadi</div>`;

    res.send(page("Kitob Market", `
      <div class="hero">
        <h1>Kitoblar do'koni</h1>
        <p>Yaxshi kitoblarni tanlang. Qolgan soni, narxi va buyurtma berish bir joyda.</p>
        <form class="searchbar" method="get" action="/">
          <input type="text" name="search" value="${esc(search)}" placeholder="Kitob nomi yoki muallif bo'yicha qidiring" />
          <button type="submit">Poisk</button>
        </form>
      </div>
      <h2 style="margin-top:18px">Mavjud kitoblar</h2>
      <div class="cards">${cards}</div>
    `, { admin: isAdmin(req) }));
  } catch (e) {
    next(e);
  }
});

app.get("/admin/login", (req, res) => {
  res.send(page("Admin login", `
    <div class="panel" style="max-width:520px;margin:0 auto">
      <h2>Admin kirish</h2>
      <form class="form" method="post" action="/admin/login">
        <input type="password" name="pin" placeholder="PIN" required />
        <button type="submit">Kirish</button>
      </form>
    </div>
  `));
});

app.post("/admin/login", (req, res) => {
  if (String(req.body.pin || "") !== ADMIN_PIN) {
    return res.send(page("Admin login", `
      <div class="panel" style="max-width:520px;margin:0 auto">
        <div class="alert err">PIN noto'g'ri</div>
        <a class="btn" href="/admin/login">Qayta urinish</a>
      </div>
    `));
  }
  res.cookie("admin", signedAdminValue(), {
    signed: true,
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    maxAge: 1000 * 60 * 60 * 12,
  });
  res.redirect("/admin");
});

app.get("/admin/logout", (_req, res) => {
  res.clearCookie("admin");
  res.redirect("/");
});

app.get("/admin", requireAdmin, async (_req, res, next) => {
  try {
    const stats = await q(`
      SELECT
      (SELECT COUNT(*) FROM books) AS books_count,
      (SELECT COUNT(*) FROM counterparties) AS counterparties_count,
      (SELECT COUNT(*) FROM purchases) AS purchases_count,
      (SELECT COUNT(*) FROM customer_orders) AS orders_count,
      (SELECT COALESCE(SUM(total_sum),0) FROM purchases) AS purchases_sum,
      (SELECT COALESCE(SUM(total_sum),0) FROM customer_orders) AS orders_sum
    `);
    const s = stats.rows[0];
    res.send(page("Admin", `
      <div class="panel">
        <div class="nav">
          <a class="btn dark" href="/admin/counterparties">Kontragentlar</a>
          <a class="btn dark" href="/admin/purchases/new">Prihod qilish</a>
          <a class="btn dark" href="/admin/purchases">Prihodlar</a>
          <a class="btn dark" href="/admin/books">Kitoblar</a>
          <a class="btn dark" href="/admin/orders">Zakazlar</a>
          <a class="btn red" href="/admin/logout">Chiqish</a>
        </div>
        <h2 style="margin-top:14px">Boshqaruv paneli</h2>
        <div class="stat-grid">
          <div class="stat"><div class="muted">Kitoblar</div><div class="n">${s.books_count}</div></div>
          <div class="stat"><div class="muted">Kontragentlar</div><div class="n">${s.counterparties_count}</div></div>
          <div class="stat"><div class="muted">Prihodlar</div><div class="n">${s.purchases_count}</div></div>
          <div class="stat"><div class="muted">Zakazlar</div><div class="n">${s.orders_count}</div></div>
          <div class="stat"><div class="muted">Jami prihod</div><div class="n">${money(s.purchases_sum)}</div></div>
          <div class="stat"><div class="muted">Jami zakaz</div><div class="n">${money(s.orders_sum)}</div></div>
        </div>
      </div>
    `, { admin: true }));
  } catch (e) {
    next(e);
  }
});

app.get("/admin/counterparties", requireAdmin, async (_req, res, next) => {
  try {
    const r = await q(`SELECT * FROM counterparties ORDER BY id DESC`);
    const rows = r.rows.map((c) => `<tr><td>${c.id}</td><td>${esc(c.name)}</td><td>${esc(c.phone)}</td><td>${esc(c.note)}</td></tr>`).join("");
    res.send(page("Kontragentlar", `
      <div class="panel">
        <div class="nav">
          <a class="btn" href="/admin/counterparties/new">+ Yangi kontragent</a>
          <a class="btn dark" href="/admin">← Admin</a>
        </div>
        <h2>Kontragentlar</h2>
        <table>
          <tr><th>ID</th><th>Nomi</th><th>Telefon</th><th>Izoh</th></tr>
          ${rows || `<tr><td colspan="4">Kontragent yo'q</td></tr>`}
        </table>
      </div>
    `, { admin: true }));
  } catch (e) {
    next(e);
  }
});

app.get("/admin/counterparties/new", requireAdmin, (_req, res) => {
  res.send(page("Yangi kontragent", `
    <div class="panel" style="max-width:760px;margin:0 auto">
      <h2>Yangi kontragent</h2>
      <form class="form" method="post" action="/admin/counterparties/new">
        <input name="name" placeholder="Kontragent nomi" required />
        <input name="phone" placeholder="Telefon" />
        <textarea name="note" placeholder="Izoh"></textarea>
        <button class="btn green" type="submit">Saqlash</button>
      </form>
    </div>
  `, { admin: true }));
});

app.post("/admin/counterparties/new", requireAdmin, async (req, res, next) => {
  try {
    await q(`INSERT INTO counterparties(name, phone, note) VALUES ($1,$2,$3)`, [
      String(req.body.name || ""),
      String(req.body.phone || ""),
      String(req.body.note || "")
    ]);
    res.redirect("/admin/counterparties");
  } catch (e) {
    next(e);
  }
});

app.get("/admin/purchases/new", requireAdmin, async (_req, res, next) => {
  try {
    const cps = (await q(`SELECT id,name FROM counterparties ORDER BY name`)).rows;
    const books = (await q(`SELECT id,title FROM books ORDER BY title`)).rows;
    const cpOptions = cps.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
    const bookOptions = books.map((b) => `<option value="${b.id}">${esc(b.title)}</option>`).join("");

    res.send(page("Prihod qilish", `
      <div class="panel" style="max-width:900px;margin:0 auto">
        <div class="nav">
          <a class="btn dark" href="/admin">← Admin</a>
          <a class="btn soft" href="/admin/counterparties/new">Avval kontragent qo'shish</a>
        </div>
        <h2>Prihod qilish</h2>
        <form class="form" method="post" action="/admin/purchases/new" enctype="multipart/form-data">
          <div class="grid2">
            <select name="counterparty_id" required>
              <option value="">Kontragent tanlang</option>
              ${cpOptions}
            </select>
            <input type="date" name="doc_date" value="${new Date().toISOString().slice(0, 10)}" required />
          </div>
          <div class="grid2">
            <select name="existing_book_id">
              <option value="">Mavjud kitobni tanlang (ixtiyoriy)</option>
              ${bookOptions}
            </select>
            <input name="title" placeholder="Yoki yangi kitob nomi" />
          </div>
          <div class="grid2">
            <input name="author" placeholder="Muallif" />
            <input type="file" name="image" accept="image/*" />
          </div>
          <div class="grid2">
            <input type="number" name="qty" min="1" placeholder="Nechta olingan" required />
            <input type="number" name="purchase_price" min="0" placeholder="Nech pulga olingan (1 dona)" required />
          </div>
          <div class="grid2">
            <input type="number" step="0.01" name="markup_percent" min="0" placeholder="Pereocenka foizi" required />
            <input type="text" value="Sotuv narxi avtomatik hisoblanadi" disabled />
          </div>
          <textarea name="note" placeholder="Izoh"></textarea>
          <button type="submit" class="btn green">Saqlash</button>
        </form>
      </div>
    `, { admin: true }));
  } catch (e) {
    next(e);
  }
});

app.post("/admin/purchases/new", requireAdmin, upload.single("image"), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const qty = Number(req.body.qty || 0);
    const purchasePrice = Number(req.body.purchase_price || 0);
    const markupPercent = Number(req.body.markup_percent || 0);

    if (!Number.isFinite(qty) || qty <= 0) throw new Error("Soni noto'g'ri");
    if (!Number.isFinite(purchasePrice) || purchasePrice < 0) throw new Error("Olingan narx noto'g'ri");
    if (!Number.isFinite(markupPercent) || markupPercent < 0) throw new Error("Pereocenka foizi noto'g'ri");

    await client.query("BEGIN");

    let bookId = Number(req.body.existing_book_id || 0);
    const imagePath = req.file ? `/uploads/${req.file.filename}` : "";
    const salePrice = Math.round(purchasePrice * (1 + markupPercent / 100));
    const lineSum = qty * purchasePrice;

    if (!bookId) {
      const title = String(req.body.title || "").trim();
      if (!title) throw new Error("Yangi kitob nomini kiriting yoki mavjud kitobni tanlang");

      const inserted = await client.query(
        `INSERT INTO books(title, author, image, purchase_price, markup_percent, sale_price, stock_qty, active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE)
         RETURNING id`,
        [title, String(req.body.author || ""), imagePath, purchasePrice, markupPercent, salePrice, qty]
      );

      bookId = inserted.rows[0].id;
    } else {
      const current = await client.query(`SELECT * FROM books WHERE id=$1 FOR UPDATE`, [bookId]);
      if (!current.rows.length) throw new Error("Kitob topilmadi");

      await client.query(
        `UPDATE books SET
          author = CASE WHEN $1 <> '' THEN $1 ELSE author END,
          image = CASE WHEN $2 <> '' THEN $2 ELSE image END,
          purchase_price = $3,
          markup_percent = $4,
          sale_price = $5,
          stock_qty = stock_qty + $6,
          updated_at = NOW()
         WHERE id = $7`,
        [String(req.body.author || ""), imagePath, purchasePrice, markupPercent, salePrice, qty, bookId]
      );
    }

    const docNo = await nextPurchaseNo(client);
    const purchase = await client.query(
      `INSERT INTO purchases(doc_no, doc_date, counterparty_id, note, total_sum)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id`,
      [docNo, req.body.doc_date, req.body.counterparty_id, String(req.body.note || ""), lineSum]
    );

    await client.query(
      `INSERT INTO purchase_lines(purchase_id, book_id, qty, purchase_price, markup_percent, sale_price, line_sum)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [purchase.rows[0].id, bookId, qty, purchasePrice, markupPercent, salePrice, lineSum]
    );

    await client.query("COMMIT");
    res.redirect(`/admin/purchases/${purchase.rows[0].id}`);
  } catch (e) {
    await client.query("ROLLBACK");
    next(e);
  } finally {
    client.release();
  }
});

app.use((err, req, res, _next) => {
  res.status(500).send(page("Xatolik", `
    <div class="panel" style="max-width:760px;margin:0 auto">
      <div class="alert err">${esc(err && err.message ? err.message : "Noma'lum xatolik")}</div>
      <a class="btn dark" href="javascript:history.back()">← Ortga</a>
    </div>
  `, { admin: isAdmin(req) }));
});

(async () => {
  try {
    await initDb();
    app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
