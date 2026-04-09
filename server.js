const express = require("express");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const PDFDocument = require("pdfkit");
const { Pool } = require("pg");
const crypto = require("crypto");

const app = express();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes("localhost")
    ? false
    : { rejectUnauthorized: false },
});

const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || "change-me-secret";
const ADMIN_PIN = process.env.ADMIN_PIN || "1234";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ["image/jpeg", "image/png", "image/webp", "image/jpg"].includes(file.mimetype);
    cb(ok ? null : new Error("Faqat JPG, PNG, WEBP mumkin"), ok);
  },
});

app.set("trust proxy", 1);
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser(SESSION_SECRET));

function hashText(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function formatMoney(v) {
  return Number(v || 0).toLocaleString("ru-RU") + " so'm";
}

function escapeHtml(v = "") {
  return String(v)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function getSignedAdminCookieValue() {
  return hashText(ADMIN_PIN + "|admin");
}

function isAdmin(req) {
  return req.signedCookies.admin === getSignedAdminCookieValue();
}

function requireAdmin(req, res, next) {
  if (!isAdmin(req)) return res.redirect("/a/login");
  next();
}

function shell(title, body, options = {}) {
  const adminChip = options.admin ? `<a href="/a" class="gear">⚙ Boshqaruv</a>` : "";
  return `<!doctype html>
<html lang="uz">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root{
      --bg:#0b1220;
      --card:#131d31;
      --soft:#1b2740;
      --text:#eef4ff;
      --muted:#9fb0cf;
      --accent:#4f7cff;
      --green:#19b45b;
      --red:#de4c4c;
      --page:#eef3fb;
      --darkText:#111827;
    }
    *{box-sizing:border-box}
    body{
      margin:0;
      font-family:Arial,Helvetica,sans-serif;
      background:linear-gradient(180deg,#0a1220,#0e1730 180px,var(--page) 180px);
      color:var(--darkText)
    }
    .top{
      padding:18px 16px 28px;
      color:var(--text);
      display:flex;
      justify-content:space-between;
      align-items:center;
      gap:12px
    }
    .brand{font-size:32px;font-weight:900;letter-spacing:-0.02em}
    .subbrand{color:var(--muted);font-size:13px;margin-top:4px}
    .gear{
      color:var(--text);
      text-decoration:none;
      background:rgba(255,255,255,.08);
      padding:10px 14px;
      border-radius:14px;
      font-weight:700
    }
    .wrap{max-width:1100px;margin:0 auto;padding:0 12px 120px}
    .hero{
      background:linear-gradient(135deg,#111b31,#1b2c54);
      border-radius:28px;
      padding:18px;
      display:flex;
      gap:14px;
      align-items:center;
      color:var(--text);
      box-shadow:0 18px 50px rgba(10,16,30,.25)
    }
    .hero .logo{font-size:44px}
    .hero h1{margin:0;font-size:26px;line-height:1.1}
    .hero p{margin:8px 0 0;color:#c7d6f7}
    .sectionTitle{margin:18px 2px 12px;font-size:22px;font-weight:900}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}
    .book{
      background:#fff;
      border-radius:22px;
      padding:12px;
      box-shadow:0 14px 40px rgba(21,30,61,.08)
    }
    .imgBox{
      height:230px;
      border-radius:18px;
      background:#e8eef9;
      overflow:hidden;
      display:flex;
      align-items:center;
      justify-content:center
    }
    .imgBox img{width:100%;height:100%;object-fit:cover}
    .placeholder{font-size:56px}
    .title{font-size:20px;font-weight:900;margin:12px 0 6px;color:#0f172a}
    .author{color:#64748b;font-size:14px;min-height:18px}
    .row{display:flex;justify-content:space-between;gap:12px;align-items:center}
    .price{color:#0f172a;font-size:22px;font-weight:900;margin-top:10px}
    .stock{margin-top:8px;font-size:13px;font-weight:700}
    .stock.ok{color:var(--green)}
    .stock.no{color:var(--red)}
    .btn{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      border:0;
      border-radius:16px;
      padding:12px 16px;
      background:var(--accent);
      color:#fff;
      text-decoration:none;
      font-weight:800;
      cursor:pointer
    }
    .btn.green{background:var(--green)}
    .btn.dark{background:#111827}
    .btn.red{background:var(--red)}
    .btn.soft{background:#eaf1ff;color:#16367c}
    .actions{display:flex;gap:8px;flex-wrap:wrap}
    .panel{
      background:#fff;
      border-radius:24px;
      padding:16px;
      box-shadow:0 14px 40px rgba(21,30,61,.08);
      margin-top:16px
    }
    .panel h2,.panel h3{margin:0 0 12px}
    .muted{color:#64748b}
    .form{display:grid;gap:12px}
    .form2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .form3{display:grid;grid-template-columns:1.3fr .7fr .7fr .7fr;gap:10px}
    input,select,textarea{
      width:100%;
      padding:13px 14px;
      border-radius:16px;
      border:1px solid #d5def0;
      font-size:16px;
      background:#fff
    }
    textarea{min-height:96px;resize:vertical}
    table{width:100%;border-collapse:collapse}
    th,td{
      padding:10px 8px;
      border-bottom:1px solid #e8eef9;
      text-align:left;
      font-size:14px;
      vertical-align:top
    }
    .badge{
      display:inline-block;
      padding:6px 10px;
      border-radius:999px;
      background:#eaf1ff;
      color:#1f4ed8;
      font-size:12px;
      font-weight:800
    }
    .statGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}
    .stat{
      background:linear-gradient(180deg,#ffffff,#f7faff);
      border-radius:22px;
      padding:16px;
      border:1px solid #e7eefc
    }
    .stat .n{font-size:26px;font-weight:900;margin-top:6px}
    .alert{padding:12px 14px;border-radius:16px;margin:12px 0;font-weight:700}
    .alert.ok{background:#eafbf0;color:#0d7c3b}
    .alert.err{background:#fff0f0;color:#bb2020}
    .nav{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}
    .lines{display:grid;gap:10px}
    .line{
      background:#f8fbff;
      border:1px solid #e5edf9;
      border-radius:18px;
      padding:10px
    }
    .right{text-align:right}
    .empty{padding:26px;text-align:center;color:#64748b}
    @media (max-width:700px){
      .form2,.form3{grid-template-columns:1fr}
      .brand{font-size:26px}
      .hero h1{font-size:22px}
      .imgBox{height:200px}
    }
  </style>
</head>
<body>
  <div class="top">
    <div>
      <div class="brand">Kitob Market</div>
      <div class="subbrand">Chiroyli vitrina + kuchli hisob</div>
    </div>
    ${adminChip}
  </div>
  <div class="wrap">${body}</div>
</body>
</html>`;
}

async function query(text, params = []) {
  return pool.query(text, params);
}

async function initDb() {
  await query(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS counterparties (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT DEFAULT '',
      note TEXT DEFAULT '',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS books (
      id BIGSERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT DEFAULT '',
      sale_price BIGINT NOT NULL DEFAULT 0,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      image_data BYTEA,
      image_mime TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await query(`ALTER TABLE books ADD COLUMN IF NOT EXISTS author TEXT DEFAULT ''`);
  await query(`ALTER TABLE books ADD COLUMN IF NOT EXISTS sale_price BIGINT NOT NULL DEFAULT 0`);
  await query(`ALTER TABLE books ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE`);
  await query(`ALTER TABLE books ADD COLUMN IF NOT EXISTS image_data BYTEA`);
  await query(`ALTER TABLE books ADD COLUMN IF NOT EXISTS image_mime TEXT`);
  await query(`ALTER TABLE books ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW()`);
  await query(`ALTER TABLE books ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW()`);

  await query(`
    CREATE TABLE IF NOT EXISTS purchases (
      id BIGSERIAL PRIMARY KEY,
      doc_no TEXT UNIQUE,
      doc_date DATE NOT NULL DEFAULT CURRENT_DATE,
      counterparty_id BIGINT REFERENCES counterparties(id) ON DELETE SET NULL,
      note TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      total_sum BIGINT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await query(`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS doc_no TEXT`);
  await query(`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS doc_date DATE NOT NULL DEFAULT CURRENT_DATE`);
  await query(`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS counterparty_id BIGINT`);
  await query(`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS note TEXT DEFAULT ''`);
  await query(`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft'`);
  await query(`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS total_sum BIGINT NOT NULL DEFAULT 0`);
  await query(`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW()`);
  await query(`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW()`);

  await query(`
    CREATE TABLE IF NOT EXISTS purchase_lines (
      id BIGSERIAL PRIMARY KEY,
      purchase_id BIGINT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
      book_id BIGINT NOT NULL REFERENCES books(id) ON DELETE RESTRICT,
      qty INT NOT NULL CHECK (qty > 0),
      price BIGINT NOT NULL CHECK (price >= 0),
      line_sum BIGINT NOT NULL CHECK (line_sum >= 0)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS sales (
      id BIGSERIAL PRIMARY KEY,
      doc_no TEXT UNIQUE,
      doc_date DATE NOT NULL DEFAULT CURRENT_DATE,
      customer_name TEXT DEFAULT '',
      customer_phone TEXT DEFAULT '',
      note TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'posted',
      total_sum BIGINT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS doc_no TEXT`);
  await query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS doc_date DATE NOT NULL DEFAULT CURRENT_DATE`);
  await query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_name TEXT DEFAULT ''`);
  await query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_phone TEXT DEFAULT ''`);
  await query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS note TEXT DEFAULT ''`);
  await query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'posted'`);
  await query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS total_sum BIGINT NOT NULL DEFAULT 0`);
  await query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW()`);
  await query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW()`);

  await query(`
    CREATE TABLE IF NOT EXISTS sale_lines (
      id BIGSERIAL PRIMARY KEY,
      sale_id BIGINT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      book_id BIGINT NOT NULL REFERENCES books(id) ON DELETE RESTRICT,
      qty INT NOT NULL CHECK (qty > 0),
      price BIGINT NOT NULL CHECK (price >= 0),
      line_sum BIGINT NOT NULL CHECK (line_sum >= 0)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS counters (
      name TEXT PRIMARY KEY,
      last_value BIGINT NOT NULL DEFAULT 0
    )
  `);

  await query(`INSERT INTO counters(name,last_value) VALUES ('purchase',0) ON CONFLICT (name) DO NOTHING`);
  await query(`INSERT INTO counters(name,last_value) VALUES ('sale',0) ON CONFLICT (name) DO NOTHING`);

  const demoBooks = await query(`SELECT COUNT(*)::int AS c FROM books`);
  if (demoBooks.rows[0].c === 0) {
    await query(`
      INSERT INTO books(title,author,sale_price,active)
      VALUES
      ('Alifbo kitobi','',20000,TRUE),
      ('Matematika 1-sinf','',25000,TRUE)
    `);
  }
}

async function nextDocNo(client, kind) {
  const r = await client.query(
    `UPDATE counters SET last_value = last_value + 1 WHERE name = $1 RETURNING last_value`,
    [kind]
  );
  const n = Number(r.rows[0].last_value);
  return `${kind === 'purchase' ? 'PR' : 'SL'}-${String(n).padStart(6, '0')}`;
}

async function getBooksWithStock() {
  const r = await query(`
    SELECT
      b.id,
      b.title,
      b.author,
      b.sale_price,
      b.active,
      b.image_mime,
      COALESCE((SELECT SUM(pl.qty) FROM purchase_lines pl JOIN purchases p ON p.id=pl.purchase_id WHERE p.status='posted' AND pl.book_id=b.id),0)
      - COALESCE((SELECT SUM(sl.qty) FROM sale_lines sl JOIN sales s ON s.id=sl.sale_id WHERE s.status='posted' AND sl.book_id=b.id),0)
      AS qty_left
    FROM books b
    WHERE b.active = TRUE
    ORDER BY b.id DESC
  `);
  return r.rows;
}

async function getAllBooksWithStock() {
  const r = await query(`
    SELECT
      b.id,
      b.title,
      b.author,
      b.sale_price,
      b.active,
      b.image_mime,
      COALESCE((SELECT SUM(pl.qty) FROM purchase_lines pl JOIN purchases p ON p.id=pl.purchase_id WHERE p.status='posted' AND pl.book_id=b.id),0)
      - COALESCE((SELECT SUM(sl.qty) FROM sale_lines sl JOIN sales s ON s.id=sl.sale_id WHERE s.status='posted' AND sl.book_id=b.id),0)
      AS qty_left
    FROM books b
    ORDER BY b.id DESC
  `);
  return r.rows;
}

app.get("/health", (req, res) => res.send("ok"));

app.get("/book-image/:id", async (req, res) => {
  const id = Number(req.params.id);
  const r = await query(`SELECT image_data, image_mime FROM books WHERE id=$1`, [id]);
  if (!r.rows.length || !r.rows[0].image_data) return res.status(404).send("Not found");
  res.setHeader("Content-Type", r.rows[0].image_mime || "image/jpeg");
  res.send(r.rows[0].image_data);
});

app.get("/", async (req, res) => {
  const books = await getBooksWithStock();
  const cards = books.length
    ? books.map((b) => `
      <div class="book">
        <div class="imgBox">
          ${b.image_mime ? `<img src="/book-image/${b.id}" alt="${escapeHtml(b.title)}" />` : `<div class="placeholder">📚</div>`}
        </div>
        <div class="title">${escapeHtml(b.title)}</div>
        <div class="author">${escapeHtml(b.author || '')}</div>
        <div class="price">${formatMoney(b.sale_price)}</div>
        <div class="row" style="margin-top:10px">
          <div class="stock ${Number(b.qty_left) > 0 ? 'ok' : 'no'}">
            ${Number(b.qty_left) > 0 ? `Omborda: ${b.qty_left} dona` : `Hozircha qolmagan`}
          </div>
        </div>
      </div>
    `).join("")
    : `<div class="panel empty">Hozircha kitob yo'q</div>`;

  res.send(shell("Kitob Market", `
    <div class="hero">
      <div class="logo">📚</div>
      <div>
        <h1>Kitoblar do'koni</h1>
        <p>Har bir kitob bo'yicha narx va qolgan soni ko'rinadi.</p>
      </div>
    </div>
    <div class="sectionTitle">Mavjud kitoblar</div>
    <div class="grid">${cards}</div>
  `, { admin: isAdmin(req) }));
});

app.get("/a/login", (req, res) => {
  res.send(shell("Admin login", `
    <div class="panel" style="max-width:520px;margin:0 auto">
      <h2>🔐 Admin kirish</h2>
      <p class="muted">Bu panel xaridorlarga ko'rinmaydi. Faqat kod bilan kiriladi.</p>
      <form method="post" action="/a/login" class="form">
        <input type="password" name="pin" placeholder="Admin kod" required />
        <button class="btn">Kirish</button>
      </form>
      <div style="margin-top:10px"><a href="/">← Orqaga</a></div>
    </div>
  `));
});

app.post("/a/login", (req, res) => {
  const pin = String(req.body.pin || "");
  if (pin !== ADMIN_PIN) {
    return res.send(shell("Admin login", `
      <div class="panel" style="max-width:520px;margin:0 auto">
        <div class="alert err">Kod noto'g'ri</div>
        <a class="btn" href="/a/login">Qayta urinish</a>
      </div>
    `));
  }
  res.cookie("admin", getSignedAdminCookieValue(), {
    signed: true,
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    maxAge: 1000 * 60 * 60 * 12,
  });
  res.redirect("/a");
});

app.get("/a/logout", (req, res) => {
  res.clearCookie("admin");
  res.redirect("/");
});

app.get("/a", requireAdmin, async (req, res) => {
  const stats = await query(`
    SELECT
      (SELECT COUNT(*) FROM books) AS books_count,
      (SELECT COUNT(*) FROM counterparties) AS counterparties_count,
      (SELECT COUNT(*) FROM purchases WHERE status='posted') AS purchases_count,
      (SELECT COUNT(*) FROM sales WHERE status='posted') AS sales_count,
      (SELECT COALESCE(SUM(total_sum),0) FROM purchases WHERE status='posted') AS purchases_sum,
      (SELECT COALESCE(SUM(total_sum),0) FROM sales WHERE status='posted') AS sales_sum
  `);
  const s = stats.rows[0];

  res.send(shell("Admin", `
    <div class="panel">
      <div class="nav">
        <a class="btn dark" href="/a/books">Kitoblar</a>
        <a class="btn dark" href="/a/counterparties">Kontragentlar</a>
        <a class="btn dark" href="/a/purchases">Prihodlar</a>
        <a class="btn dark" href="/a/sales">Sotuvlar</a>
        <a class="btn dark" href="/a/reports">Hisobotlar</a>
        <a class="btn red" href="/a/logout">Chiqish</a>
      </div>
      <h2>📊 Boshqaruv paneli</h2>
      <div class="statGrid">
        <div class="stat"><div class="muted">Kitoblar</div><div class="n">${s.books_count}</div></div>
        <div class="stat"><div class="muted">Kontragentlar</div><div class="n">${s.counterparties_count}</div></div>
        <div class="stat"><div class="muted">Prihodlar</div><div class="n">${s.purchases_count}</div></div>
        <div class="stat"><div class="muted">Sotuvlar</div><div class="n">${s.sales_count}</div></div>
        <div class="stat"><div class="muted">Jami prihod</div><div class="n">${formatMoney(s.purchases_sum)}</div></div>
        <div class="stat"><div class="muted">Jami sotuv</div><div class="n">${formatMoney(s.sales_sum)}</div></div>
      </div>
    </div>
  `, { admin: true }));
});
