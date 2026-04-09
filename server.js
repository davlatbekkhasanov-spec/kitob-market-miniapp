const express = require("express");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const PDFDocument = require("pdfkit");
const { Pool } = require("pg");
const crypto = require("crypto");

const app = express();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("localhost") ? false : { rejectUnauthorized: false },
});

const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-secret-change-me";
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

function hashPin(pin) {
  return crypto.createHash("sha256").update(String(pin)).digest("hex");
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
  return hashPin(ADMIN_PIN + "|admin");
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
      --accent2:#6c8dff;
      --green:#19b45b;
      --red:#de4c4c;
      --gold:#ffbf47;
      --white:#ffffff;
      --page:#eef3fb;
      --darkText:#111827;
      --radius:20px;
    }
    *{box-sizing:border-box}
    body{margin:0;font-family:Arial,Helvetica,sans-serif;background:linear-gradient(180deg,#0a1220,#0e1730 180px,var(--page) 180px);color:var(--darkText)}
    .top{padding:18px 16px 28px;color:var(--text);display:flex;justify-content:space-between;align-items:center;gap:12px}
    .brand{font-size:32px;font-weight:900;letter-spacing:-0.02em}
    .subbrand{color:var(--muted);font-size:13px;margin-top:4px}
    .gear{color:var(--text);text-decoration:none;background:rgba(255,255,255,.08);padding:10px 14px;border-radius:14px;font-weight:700}
    .wrap{max-width:1100px;margin:0 auto;padding:0 12px 120px}
    .hero{background:linear-gradient(135deg,#111b31,#1b2c54);border-radius:28px;padding:18px;display:flex;gap:14px;align-items:center;color:var(--text);box-shadow:0 18px 50px rgba(10,16,30,.25)}
    .hero .logo{font-size:44px}
    .hero h1{margin:0;font-size:26px;line-height:1.1}
    .hero p{margin:8px 0 0;color:#c7d6f7}
    .sectionTitle{margin:18px 2px 12px;font-size:22px;font-weight:900}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}
    .book{background:#fff;border-radius:22px;padding:12px;box-shadow:0 14px 40px rgba(21,30,61,.08)}
    .imgBox{height:230px;border-radius:18px;background:#e8eef9;overflow:hidden;display:flex;align-items:center;justify-content:center}
    .imgBox img{width:100%;height:100%;object-fit:cover}
    .placeholder{font-size:56px}
    .title{font-size:20px;font-weight:900;margin:12px 0 6px;color:#0f172a}
    .author{color:#64748b;font-size:14px;min-height:18px}
    .row{display:flex;justify-content:space-between;gap:12px;align-items:center}
    .price{color:#0f172a;font-size:22px;font-weight:900;margin-top:10px}
    .stock{margin-top:8px;font-size:13px;font-weight:700}
    .stock.ok{color:var(--green)}
    .stock.no{color:var(--red)}
    .btn{display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:16px;padding:12px 16px;background:var(--accent);color:#fff;text-decoration:none;font-weight:800;cursor:pointer}
    .btn.green{background:var(--green)}
    .btn.dark{background:#111827}
    .btn.red{background:var(--red)}
    .btn.soft{background:#eaf1ff;color:#16367c}
    .actions{display:flex;gap:8px;flex-wrap:wrap}
    .panel{background:#fff;border-radius:24px;padding:16px;box-shadow:0 14px 40px rgba(21,30,61,.08);margin-top:16px}
    .panel h2,.panel h3{margin:0 0 12px}
    .muted{color:#64748b}
    .form{display:grid;gap:12px}
    .form2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .form3{display:grid;grid-template-columns:1.3fr .7fr .7fr .7fr;gap:10px}
    input,select,textarea{width:100%;padding:13px 14px;border-radius:16px;border:1px solid #d5def0;font-size:16px;background:#fff}
    textarea{min-height:96px;resize:vertical}
    table{width:100%;border-collapse:collapse}
    th,td{padding:10px 8px;border-bottom:1px solid #e8eef9;text-align:left;font-size:14px;vertical-align:top}
    .badge{display:inline-block;padding:6px 10px;border-radius:999px;background:#eaf1ff;color:#1f4ed8;font-size:12px;font-weight:800}
    .statGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}
    .stat{background:linear-gradient(180deg,#ffffff,#f7faff);border-radius:22px;padding:16px;border:1px solid #e7eefc}
    .stat .n{font-size:26px;font-weight:900;margin-top:6px}
    .alert{padding:12px 14px;border-radius:16px;margin:12px 0;font-weight:700}
    .alert.ok{background:#eafbf0;color:#0d7c3b}
    .alert.err{background:#fff0f0;color:#bb2020}
    .nav{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}
    .small{font-size:12px}
    .lines{display:grid;gap:10px}
    .line{background:#f8fbff;border:1px solid #e5edf9;border-radius:18px;padding:10px}
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

  await query(`ALTER TABLE books ADD COLUMN IF NOT EXISTS author TEXT DEFAULT ''`);
  await query(`ALTER TABLE books ADD COLUMN IF NOT EXISTS sale_price BIGINT NOT NULL DEFAULT 0`);
  await query(`ALTER TABLE books ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE`);
  await query(`ALTER TABLE books ADD COLUMN IF NOT EXISTS image_data BYTEA`);
  await query(`ALTER TABLE books ADD COLUMN IF NOT EXISTS image_mime TEXT`);
  await query(`ALTER TABLE books ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW()`);
  await query(`ALTER TABLE books ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW()`);

  await query(`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS doc_no TEXT`);
  await query(`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS doc_date DATE NOT NULL DEFAULT CURRENT_DATE`);
  await query(`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS counterparty_id BIGINT`);
  await query(`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS note TEXT DEFAULT ''`);
  await query(`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft'`);
  await query(`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS total_sum BIGINT NOT NULL DEFAULT 0`);
  await query(`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW()`);
  await query(`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW()`);

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
    INSERT INTO counters(name,last_value)
    VALUES ('purchase',0)
    ON CONFLICT (name) DO NOTHING
  `);

  await query(`
    INSERT INTO counters(name,last_value)
    VALUES ('sale',0)
    ON CONFLICT (name) DO NOTHING
  `);

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
    CREATE TABLE IF NOT EXISTS counterparties (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT DEFAULT '',
      note TEXT DEFAULT '',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

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
    );

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
    );

    CREATE TABLE IF NOT EXISTS purchase_lines (
      id BIGSERIAL PRIMARY KEY,
      purchase_id BIGINT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
      book_id BIGINT NOT NULL REFERENCES books(id) ON DELETE RESTRICT,
      qty INT NOT NULL CHECK (qty > 0),
      price BIGINT NOT NULL CHECK (price >= 0),
      line_sum BIGINT NOT NULL CHECK (line_sum >= 0)
    );

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
    );

    CREATE TABLE IF NOT EXISTS sale_lines (
      id BIGSERIAL PRIMARY KEY,
      sale_id BIGINT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      book_id BIGINT NOT NULL REFERENCES books(id) ON DELETE RESTRICT,
      qty INT NOT NULL CHECK (qty > 0),
      price BIGINT NOT NULL CHECK (price >= 0),
      line_sum BIGINT NOT NULL CHECK (line_sum >= 0)
    );

    CREATE TABLE IF NOT EXISTS counters (
      name TEXT PRIMARY KEY,
      last_value BIGINT NOT NULL DEFAULT 0
    );
  `);

  await query(`INSERT INTO counters(name,last_value) VALUES ('purchase',0) ON CONFLICT (name) DO NOTHING;`);
  await query(`INSERT INTO counters(name,last_value) VALUES ('sale',0) ON CONFLICT (name) DO NOTHING;`);

  const demoBooks = await query(`SELECT COUNT(*)::int AS c FROM books`);
  if (demoBooks.rows[0].c === 0) {
    await query(
      `INSERT INTO books(title,author,sale_price) VALUES
      ('Alifbo kitobi','',20000),
      ('Matematika 1-sinf','',25000);`
    );
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
      AS qty_left,
      COALESCE((SELECT SUM(pl.qty * pl.price) FROM purchase_lines pl JOIN purchases p ON p.id=pl.purchase_id WHERE p.status='posted' AND pl.book_id=b.id),0)
      AS purchase_value_total
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
    ? books.map(b => `
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

app.get("/a/books", requireAdmin, async (req, res) => {
  const books = await getAllBooksWithStock();
  const rows = books.map(b => `
    <tr>
      <td>${b.id}</td>
      <td>${escapeHtml(b.title)}</td>
      <td>${escapeHtml(b.author || '')}</td>
      <td>${formatMoney(b.sale_price)}</td>
      <td>${b.qty_left}</td>
      <td>${formatMoney(Number(b.qty_left) * Number(b.sale_price || 0))}</td>
      <td class="actions">
        <a class="btn soft" href="/a/books/${b.id}/edit">Tahrirlash</a>
      </td>
    </tr>
  `).join("");

  res.send(shell("Kitoblar", `
    <div class="panel">
      <div class="nav">
        <a class="btn" href="/a/books/new">+ Yangi kitob</a>
        <a class="btn dark" href="/a">← Admin</a>
      </div>
      <h2>📚 Kitoblar</h2>
      <div style="overflow:auto">
        <table>
          <tr><th>ID</th><th>Nomi</th><th>Muallif</th><th>Цена</th><th>Ostatka</th><th>Sotuv qiymati</th><th></th></tr>
          ${rows || `<tr><td colspan="7" class="empty">Ma'lumot yo'q</td></tr>`}
        </table>
      </div>
    </div>
  `, { admin: true }));
});

app.get("/a/books/new", requireAdmin, (req, res) => {
  res.send(shell("Yangi kitob", `
    <div class="panel" style="max-width:760px;margin:0 auto">
      <h2>➕ Yangi kitob</h2>
      <form class="form" method="post" action="/a/books/new" enctype="multipart/form-data">
        <div class="form2">
          <input name="title" placeholder="Kitob nomi" required />
          <input name="author" placeholder="Muallif" />
        </div>
        <input type="number" name="sale_price" placeholder="Sotuv narxi (so'm)" min="0" required />
        <input type="file" name="image" accept="image/*" />
        <button class="btn green">Saqlash</button>
      </form>
      <div style="margin-top:10px"><a href="/a/books">← Orqaga</a></div>
    </div>
  `, { admin: true }));
});

app.post("/a/books/new", requireAdmin, upload.single("image"), async (req, res) => {
  const title = String(req.body.title || "").trim();
  const author = String(req.body.author || "").trim();
  const salePrice = Number(req.body.sale_price || 0);
  if (!title) return res.status(400).send("title required");

  await query(
    `INSERT INTO books(title, author, sale_price, image_data, image_mime) VALUES ($1,$2,$3,$4,$5)`,
    [title, author, salePrice, req.file ? req.file.buffer : null, req.file ? req.file.mimetype : null]
  );
  res.redirect("/a/books");
});

app.get("/a/books/:id/edit", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const r = await query(`SELECT * FROM books WHERE id=$1`, [id]);
  if (!r.rows.length) return res.status(404).send("Not found");
  const b = r.rows[0];
  res.send(shell("Kitobni tahrirlash", `
    <div class="panel" style="max-width:760px;margin:0 auto">
      <h2>✏️ Kitobni tahrirlash</h2>
      <form class="form" method="post" action="/a/books/${id}/edit" enctype="multipart/form-data">
        <div class="form2">
          <input name="title" value="${escapeHtml(b.title)}" placeholder="Kitob nomi" required />
          <input name="author" value="${escapeHtml(b.author || '')}" placeholder="Muallif" />
        </div>
        <input type="number" name="sale_price" value="${Number(b.sale_price || 0)}" placeholder="Sotuv narxi (so'm)" min="0" required />
        <select name="active">
          <option value="true" ${b.active ? 'selected' : ''}>Aktiv</option>
          <option value="false" ${!b.active ? 'selected' : ''}>Nofaol</option>
        </select>
        <input type="file" name="image" accept="image/*" />
        <div class="actions">
          <button class="btn green">Saqlash</button>
          <a class="btn dark" href="/a/books">Orqaga</a>
        </div>
      </form>
    </div>
  `, { admin: true }));
});

app.post("/a/books/:id/edit", requireAdmin, upload.single("image"), async (req, res) => {
  const id = Number(req.params.id);
  const title = String(req.body.title || "").trim();
  const author = String(req.body.author || "").trim();
  const salePrice = Number(req.body.sale_price || 0);
  const active = String(req.body.active) === "true";

  if (req.file) {
    await query(
      `UPDATE books SET title=$1, author=$2, sale_price=$3, active=$4, image_data=$5, image_mime=$6, updated_at=NOW() WHERE id=$7`,
      [title, author, salePrice, active, req.file.buffer, req.file.mimetype, id]
    );
  } else {
    await query(
      `UPDATE books SET title=$1, author=$2, sale_price=$3, active=$4, updated_at=NOW() WHERE id=$5`,
      [title, author, salePrice, active, id]
    );
  }
  res.redirect("/a/books");
});

app.get("/a/counterparties", requireAdmin, async (req, res) => {
  const r = await query(`SELECT * FROM counterparties ORDER BY id DESC`);
  const rows = r.rows.map(c => `
    <tr>
      <td>${c.id}</td>
      <td>${escapeHtml(c.name)}</td>
      <td>${escapeHtml(c.phone || '')}</td>
      <td>${escapeHtml(c.note || '')}</td>
    </tr>
  `).join("");

  res.send(shell("Kontragentlar", `
    <div class="panel">
      <div class="nav">
        <a class="btn" href="/a/counterparties/new">+ Yangi kontragent</a>
        <a class="btn dark" href="/a">← Admin</a>
      </div>
      <h2>🏢 Kontragentlar</h2>
      <table>
        <tr><th>ID</th><th>Nomi</th><th>Telefon</th><th>Izoh</th></tr>
        ${rows || `<tr><td colspan="4" class="empty">Hozircha kontragent yo'q</td></tr>`}
      </table>
    </div>
  `, { admin: true }));
});

app.get("/a/counterparties/new", requireAdmin, (req, res) => {
  res.send(shell("Yangi kontragent", `
    <div class="panel" style="max-width:760px;margin:0 auto">
      <h2>➕ Yangi kontragent</h2>
      <form class="form" method="post" action="/a/counterparties/new">
        <input name="name" placeholder="Kontragent nomi" required />
        <input name="phone" placeholder="Telefon" />
        <textarea name="note" placeholder="Izoh"></textarea>
        <button class="btn green">Saqlash</button>
      </form>
      <div style="margin-top:10px"><a href="/a/counterparties">← Orqaga</a></div>
    </div>
  `, { admin: true }));
});

app.post("/a/counterparties/new", requireAdmin, async (req, res) => {
  await query(`INSERT INTO counterparties(name, phone, note) VALUES ($1,$2,$3)`, [
    String(req.body.name || "").trim(),
    String(req.body.phone || "").trim(),
    String(req.body.note || "").trim(),
  ]);
  res.redirect("/a/counterparties");
});

function purchaseFormLine(books, line = {}, index = 0) {
  const opts = books.map(b => `<option value="${b.id}" ${Number(line.book_id) === Number(b.id) ? 'selected' : ''}>${escapeHtml(b.title)}</option>`).join("");
  return `
    <div class="line">
      <div class="form3">
        <select name="book_id_${index}" required><option value="">Kitob tanlang</option>${opts}</select>
        <input type="number" name="qty_${index}" value="${Number(line.qty || 1)}" min="1" placeholder="Soni" required />
        <input type="number" name="price_${index}" value="${Number(line.price || 0)}" min="0" placeholder="Prihod narxi" required />
        <input type="number" value="${Number(line.line_sum || ((line.qty || 1) * (line.price || 0)))}" placeholder="Summa" disabled />
      </div>
    </div>
  `;
}

app.get("/a/purchases", requireAdmin, async (req, res) => {
  const r = await query(`
    SELECT p.*, c.name AS counterparty_name
    FROM purchases p
    LEFT JOIN counterparties c ON c.id = p.counterparty_id
    ORDER BY p.id DESC
  `);

  const rows = r.rows.map(p => `
    <tr>
      <td>${escapeHtml(p.doc_no || '-')}</td>
      <td>${escapeHtml(String(p.doc_date))}</td>
      <td>${escapeHtml(p.counterparty_name || '-')}</td>
      <td><span class="badge">${escapeHtml(p.status)}</span></td>
      <td>${formatMoney(p.total_sum)}</td>
      <td class="actions">
        <a class="btn soft" href="/a/purchases/${p.id}">Ko'rish</a>
        <a class="btn soft" href="/a/purchases/${p.id}/edit">Tahrirlash</a>
        ${p.status === 'posted' ? `<a class="btn dark" href="/a/purchases/${p.id}/pdf">PDF</a>` : ''}
      </td>
    </tr>
  `).join("");

  res.send(shell("Prihodlar", `
    <div class="panel">
      <div class="nav">
        <a class="btn" href="/a/purchases/new">+ Yangi prihod</a>
        <a class="btn dark" href="/a">← Admin</a>
      </div>
      <h2>📥 Prihodlar</h2>
      <table>
        <tr><th>№</th><th>Sana</th><th>Kontragent</th><th>Status</th><th>Jami</th><th></th></tr>
        ${rows || `<tr><td colspan="6" class="empty">Prihod yo'q</td></tr>`}
      </table>
    </div>
  `, { admin: true }));
});

app.get("/a/purchases/new", requireAdmin, async (req, res) => {
  const books = (await query(`SELECT id,title FROM books WHERE active=TRUE ORDER BY title`)).rows;
  const cps = (await query(`SELECT id,name FROM counterparties ORDER BY name`)).rows;
  const cpOptions = cps.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");

  res.send(shell("Yangi prihod", `
    <div class="panel">
      <h2>📥 Yangi prihod</h2>
      <form class="form" method="post" action="/a/purchases/new">
        <div class="form2">
          <input type="date" name="doc_date" value="${new Date().toISOString().slice(0,10)}" required />
          <select name="counterparty_id"><option value="">Kontragent tanlang</option>${cpOptions}</select>
        </div>
        <textarea name="note" placeholder="Izoh"></textarea>
        <div class="lines">
          ${purchaseFormLine(books, {}, 0)}
          ${purchaseFormLine(books, {}, 1)}
          ${purchaseFormLine(books, {}, 2)}
        </div>
        <button class="btn green">Saqlash (draft)</button>
      </form>
      <div style="margin-top:10px"><a href="/a/purchases">← Orqaga</a></div>
    </div>
  `, { admin: true }));
});

function collectPurchaseLines(body) {
  const lines = [];
  for (let i = 0; i < 20; i++) {
    const bookId = Number(body[`book_id_${i}`] || 0);
    const qty = Number(body[`qty_${i}`] || 0);
    const price = Number(body[`price_${i}`] || 0);
    if (bookId && qty > 0) {
      lines.push({ book_id: bookId, qty, price, line_sum: qty * price });
    }
  }
  return lines;
}

app.post("/a/purchases/new", requireAdmin, async (req, res) => {
  const lines = collectPurchaseLines(req.body);
  if (!lines.length) return res.status(400).send("Kamida bitta qator kiriting");

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
    res.redirect(`/a/purchases/${purchaseId}`);
  } catch (e) {
    await client.query("ROLLBACK");
    res.status(500).send("Xatolik: " + e.message);
  } finally {
    client.release();
  }
});

app.get("/a/purchases/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const h = await query(`
    SELECT p.*, c.name AS counterparty_name
    FROM purchases p
    LEFT JOIN counterparties c ON c.id = p.counterparty_id
    WHERE p.id=$1
  `, [id]);
  if (!h.rows.length) return res.status(404).send("Not found");
  const p = h.rows[0];
  const lines = await query(`
    SELECT pl.*, b.title
    FROM purchase_lines pl
    JOIN books b ON b.id = pl.book_id
    WHERE pl.purchase_id=$1
    ORDER BY pl.id
  `, [id]);

  const lineRows = lines.rows.map(l => `
    <tr>
      <td>${escapeHtml(l.title)}</td>
      <td>${l.qty}</td>
      <td>${formatMoney(l.price)}</td>
      <td>${formatMoney(l.line_sum)}</td>
    </tr>
  `).join("");

  res.send(shell("Prihod", `
    <div class="panel">
      <div class="nav">
        <a class="btn dark" href="/a/purchases">← Prihodlar</a>
        <a class="btn soft" href="/a/purchases/${id}/edit">Tahrirlash</a>
        ${p.status === 'draft' ? `<form method="post" action="/a/purchases/${id}/post" style="display:inline"><button class="btn green">Provodka qilish</button></form>` : ''}
        ${p.status === 'posted' ? `<a class="btn" href="/a/purchases/${id}/pdf">PDF yuklab olish</a>` : ''}
      </div>
      <h2>📥 Prihod ${escapeHtml(p.doc_no || '(draft)')}</h2>
      <div class="form2">
        <div class="stat"><div class="muted">Sana</div><div class="n" style="font-size:20px">${escapeHtml(String(p.doc_date))}</div></div>
        <div class="stat"><div class="muted">Kontragent</div><div class="n" style="font-size:20px">${escapeHtml(p.counterparty_name || '-')}</div></div>
      </div>
      <div style="margin-top:10px" class="muted">Status: <b>${escapeHtml(p.status)}</b></div>
      <div style="margin-top:10px" class="muted">Izoh: ${escapeHtml(p.note || '-')}</div>
      <table style="margin-top:12px">
        <tr><th>Kitob</th><th>Soni</th><th>Приход сум</th><th>Сумма</th></tr>
        ${lineRows}
      </table>
      <div class="right" style="margin-top:12px;font-size:20px;font-weight:900">Jami: ${formatMoney(p.total_sum)}</div>
    </div>
  `, { admin: true }));
});

app.get("/a/purchases/:id/edit", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const h = await query(`SELECT * FROM purchases WHERE id=$1`, [id]);
  if (!h.rows.length) return res.status(404).send("Not found");
  const p = h.rows[0];
  const books = (await query(`SELECT id,title FROM books WHERE active=TRUE ORDER BY title`)).rows;
  const cps = (await query(`SELECT id,name FROM counterparties ORDER BY name`)).rows;
  const lines = (await query(`SELECT * FROM purchase_lines WHERE purchase_id=$1 ORDER BY id`, [id])).rows;
  const cpOptions = cps.map(c => `<option value="${c.id}" ${Number(c.id) === Number(p.counterparty_id) ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join("");

  const renderedLines = [];
  for (let i = 0; i < Math.max(3, lines.length + 2); i++) {
    renderedLines.push(purchaseFormLine(books, lines[i] || {}, i));
  }

  res.send(shell("Prihodni tahrirlash", `
    <div class="panel">
      <h2>✏️ Prihodni tahrirlash</h2>
      ${p.status === 'posted' ? `<div class="alert ok">Bu prihod provodka qilingan. Tahrirlab saqlasangiz avtomatik draft bo'ladi va qayta provodka qilasiz.</div>` : ''}
      <form class="form" method="post" action="/a/purchases/${id}/edit">
        <div class="form2">
          <input type="date" name="doc_date" value="${escapeHtml(String(p.doc_date))}" required />
          <select name="counterparty_id"><option value="">Kontragent tanlang</option>${cpOptions}</select>
        </div>
        <textarea name="note" placeholder="Izoh">${escapeHtml(p.note || '')}</textarea>
        <div class="lines">${renderedLines.join("")}</div>
        <button class="btn green">Saqlash</button>
      </form>
      <div style="margin-top:10px"><a href="/a/purchases/${id}">← Orqaga</a></div>
    </div>
  `, { admin: true }));
});

app.post("/a/purchases/:id/edit", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const lines = collectPurchaseLines(req.body);
  if (!lines.length) return res.status(400).send("Kamida bitta qator kerak");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`UPDATE purchases SET doc_date=$1, counterparty_id=$2, note=$3, status='draft', doc_no=NULL, updated_at=NOW() WHERE id=$4`, [
      req.body.doc_date,
      req.body.counterparty_id || null,
      String(req.body.note || ""),
      id,
    ]);
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
    res.redirect(`/a/purchases/${id}`);
  } catch (e) {
    await client.query("ROLLBACK");
    res.status(500).send("Xatolik: " + e.message);
  } finally {
    client.release();
  }
});

app.post("/a/purchases/:id/post", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const h = await client.query(`SELECT * FROM purchases WHERE id=$1 FOR UPDATE`, [id]);
    if (!h.rows.length) throw new Error("Prihod topilmadi");
    const p = h.rows[0];
    if (p.status === 'posted') {
      await client.query("ROLLBACK");
      return res.redirect(`/a/purchases/${id}`);
    }
    const docNo = await nextDocNo(client, 'purchase');
    await client.query(`UPDATE purchases SET status='posted', doc_no=$1, updated_at=NOW() WHERE id=$2`, [docNo, id]);
    await client.query("COMMIT");
    res.redirect(`/a/purchases/${id}`);
  } catch (e) {
    await client.query("ROLLBACK");
    res.status(500).send("Xatolik: " + e.message);
  } finally {
    client.release();
  }
});

app.get("/a/purchases/:id/pdf", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const h = await query(`
    SELECT p.*, c.name AS counterparty_name, c.phone AS counterparty_phone
    FROM purchases p
    LEFT JOIN counterparties c ON c.id = p.counterparty_id
    WHERE p.id=$1
  `, [id]);
  if (!h.rows.length) return res.status(404).send("Not found");
  const p = h.rows[0];
  const lines = await query(`
    SELECT pl.*, b.title
    FROM purchase_lines pl
    JOIN books b ON b.id = pl.book_id
    WHERE pl.purchase_id=$1 ORDER BY pl.id
  `, [id]);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${p.doc_no || 'prihod'}.pdf"`);

  const doc = new PDFDocument({ margin: 40, size: "A4" });
  doc.pipe(res);
  doc.fontSize(22).text("PRIHOD NAKLADNOY", { align: "center" });
  doc.moveDown();
  doc.fontSize(12).text(`Hujjat: ${p.doc_no || '-'}`);
  doc.text(`Sana: ${p.doc_date}`);
  doc.text(`Kontragent: ${p.counterparty_name || '-'}`);
  doc.text(`Telefon: ${p.counterparty_phone || '-'}`);
  doc.moveDown();
  doc.fontSize(12).text("Kitob", 40, doc.y, { continued: true });
  doc.text("Soni", 280, doc.y, { width: 60, align: "right", continued: true });
  doc.text("Narx", 350, doc.y, { width: 90, align: "right", continued: true });
  doc.text("Summa", 450, doc.y, { width: 100, align: "right" });
  doc.moveDown(0.3);
  doc.moveTo(40, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown(0.5);

  for (const l of lines.rows) {
    doc.fontSize(11).text(String(l.title), 40, doc.y, { width: 230, continued: true });
    doc.text(String(l.qty), 280, doc.y, { width: 60, align: "right", continued: true });
    doc.text(formatMoney(l.price), 350, doc.y, { width: 90, align: "right", continued: true });
    doc.text(formatMoney(l.line_sum), 450, doc.y, { width: 100, align: "right" });
    doc.moveDown(0.3);
  }
  doc.moveDown();
  doc.fontSize(14).text(`Jami: ${formatMoney(p.total_sum)}`, { align: "right" });
  doc.moveDown(2);
  doc.fontSize(10).text("Topshiruvchi: ______________________");
  doc.text("Qabul qiluvchi: _____________________");
  doc.end();
});

app.get("/a/sales", requireAdmin, async (req, res) => {
  const r = await query(`SELECT * FROM sales ORDER BY id DESC`);
  const rows = r.rows.map(s => `
    <tr>
      <td>${escapeHtml(s.doc_no || '-')}</td>
      <td>${escapeHtml(String(s.doc_date))}</td>
      <td>${escapeHtml(s.customer_name || '-')}</td>
      <td>${formatMoney(s.total_sum)}</td>
      <td><a class="btn soft" href="/a/sales/${s.id}">Ko'rish</a></td>
    </tr>
  `).join("");
  res.send(shell("Sotuvlar", `
    <div class="panel">
      <div class="nav">
        <a class="btn" href="/a/sales/new">+ Yangi sotuv</a>
        <a class="btn dark" href="/a">← Admin</a>
      </div>
      <h2>🧾 Sotuvlar</h2>
      <table>
        <tr><th>№</th><th>Sana</th><th>Xaridor</th><th>Jami</th><th></th></tr>
        ${rows || `<tr><td colspan="5" class="empty">Sotuv yo'q</td></tr>`}
      </table>
    </div>
  `, { admin: true }));
});

function saleFormLine(books, line = {}, index = 0) {
  const opts = books.map(b => `<option value="${b.id}" ${Number(line.book_id) === Number(b.id) ? 'selected' : ''}>${escapeHtml(b.title)} (${b.qty_left} dona)</option>`).join("");
  return `
    <div class="line">
      <div class="form3">
        <select name="book_id_${index}"><option value="">Kitob tanlang</option>${opts}</select>
        <input type="number" name="qty_${index}" value="${Number(line.qty || 1)}" min="1" placeholder="Soni" />
        <input type="number" name="price_${index}" value="${Number(line.price || 0)}" min="0" placeholder="Цена" />
        <input type="number" value="${Number(line.line_sum || ((line.qty || 1) * (line.price || 0)))}" disabled />
      </div>
    </div>
  `;
}

function collectSaleLines(body) {
  const lines = [];
  for (let i = 0; i < 20; i++) {
    const bookId = Number(body[`book_id_${i}`] || 0);
    const qty = Number(body[`qty_${i}`] || 0);
    const price = Number(body[`price_${i}`] || 0);
    if (bookId && qty > 0) {
      lines.push({ book_id: bookId, qty, price, line_sum: qty * price });
    }
  }
  return lines;
}

app.get("/a/sales/new", requireAdmin, async (req, res) => {
  const books = await getAllBooksWithStock();
  res.send(shell("Yangi sotuv", `
    <div class="panel">
      <h2>🧾 Yangi sotuv</h2>
      <form class="form" method="post" action="/a/sales/new">
        <div class="form2">
          <input type="date" name="doc_date" value="${new Date().toISOString().slice(0,10)}" required />
          <input name="customer_name" placeholder="Xaridor nomi" />
        </div>
        <input name="customer_phone" placeholder="Telefon" />
        <textarea name="note" placeholder="Izoh"></textarea>
        <div class="lines">
          ${saleFormLine(books, {}, 0)}
          ${saleFormLine(books, {}, 1)}
          ${saleFormLine(books, {}, 2)}
        </div>
        <button class="btn green">Saqlash</button>
      </form>
      <div style="margin-top:10px"><a href="/a/sales">← Orqaga</a></div>
    </div>
  `, { admin: true }));
});

app.post("/a/sales/new", requireAdmin, async (req, res) => {
  const lines = collectSaleLines(req.body);
  if (!lines.length) return res.status(400).send("Kamida bitta qator kiriting");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const docNo = await nextDocNo(client, 'sale');

    for (const ln of lines) {
      const st = await client.query(`
        SELECT
          COALESCE((SELECT SUM(pl.qty) FROM purchase_lines pl JOIN purchases p ON p.id=pl.purchase_id WHERE p.status='posted' AND pl.book_id=$1),0)
          - COALESCE((SELECT SUM(sl.qty) FROM sale_lines sl JOIN sales s ON s.id=sl.sale_id WHERE s.status='posted' AND sl.book_id=$1),0)
          AS qty_left
      `, [ln.book_id]);
      if (Number(st.rows[0].qty_left) < ln.qty) {
        throw new Error(`Omborda yetarli qoldiq yo'q`);
      }
    }

    const total = lines.reduce((s, x) => s + x.line_sum, 0);
    const h = await client.query(
      `INSERT INTO sales(doc_no, doc_date, customer_name, customer_phone, note, status, total_sum) VALUES ($1,$2,$3,$4,$5,'posted',$6) RETURNING id`,
      [docNo, req.body.doc_date, req.body.customer_name || '', req.body.customer_phone || '', req.body.note || '', total]
    );
    const saleId = h.rows[0].id;

    for (const ln of lines) {
      await client.query(
        `INSERT INTO sale_lines(sale_id, book_id, qty, price, line_sum) VALUES ($1,$2,$3,$4,$5)`,
        [saleId, ln.book_id, ln.qty, ln.price, ln.line_sum]
      );
    }

    await client.query("COMMIT");
    res.redirect(`/a/sales/${saleId}`);
  } catch (e) {
    await client.query("ROLLBACK");
    res.status(500).send("Xatolik: " + e.message);
  } finally {
    client.release();
  }
});

app.get("/a/sales/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const h = await query(`SELECT * FROM sales WHERE id=$1`, [id]);
  if (!h.rows.length) return res.status(404).send("Not found");
  const s = h.rows[0];
  const lines = await query(`SELECT sl.*, b.title FROM sale_lines sl JOIN books b ON b.id=sl.book_id WHERE sale_id=$1 ORDER BY sl.id`, [id]);
  const rows = lines.rows.map(l => `
    <tr>
      <td>${escapeHtml(l.title)}</td>
      <td>${l.qty}</td>
      <td>${formatMoney(l.price)}</td>
      <td>${formatMoney(l.line_sum)}</td>
    </tr>
  `).join("");
  res.send(shell("Sotuv", `
    <div class="panel">
      <div class="nav"><a class="btn dark" href="/a/sales">← Sotuvlar</a></div>
      <h2>🧾 Sotuv ${escapeHtml(s.doc_no || '-')}</h2>
      <div class="muted">Sana: ${escapeHtml(String(s.doc_date))}</div>
      <div class="muted">Xaridor: ${escapeHtml(s.customer_name || '-')}</div>
      <div class="muted">Telefon: ${escapeHtml(s.customer_phone || '-')}</div>
      <table style="margin-top:12px">
        <tr><th>Kitob</th><th>Soni</th><th>Цена</th><th>Сумма</th></tr>
        ${rows}
      </table>
      <div class="right" style="margin-top:12px;font-size:20px;font-weight:900">Jami: ${formatMoney(s.total_sum)}</div>
    </div>
  `, { admin: true }));
});

app.get("/a/reports", requireAdmin, async (req, res) => {
  const stock = await getAllBooksWithStock();
  const purchaseReport = await query(`
    SELECT p.doc_no, p.doc_date, COALESCE(c.name,'-') AS counterparty, p.total_sum
    FROM purchases p
    LEFT JOIN counterparties c ON c.id=p.counterparty_id
    WHERE p.status='posted'
    ORDER BY p.id DESC
    LIMIT 20
  `);
  const salesTop = await query(`
    SELECT b.title, COALESCE(SUM(sl.qty),0)::int AS sold_qty, COALESCE(SUM(sl.line_sum),0)::bigint AS sold_sum
    FROM books b
    LEFT JOIN sale_lines sl ON sl.book_id=b.id
    LEFT JOIN sales s ON s.id=sl.sale_id AND s.status='posted'
    GROUP BY b.id, b.title
    ORDER BY sold_qty DESC, sold_sum DESC
    LIMIT 20
  `);

  const stockRows = stock.map(b => `
    <tr>
      <td>${escapeHtml(b.title)}</td>
      <td>${b.qty_left}</td>
      <td>${formatMoney(b.sale_price)}</td>
      <td>${formatMoney(Number(b.qty_left) * Number(b.sale_price || 0))}</td>
    </tr>
  `).join("");

  const purchaseRows = purchaseReport.rows.map(r => `
    <tr><td>${escapeHtml(r.doc_no || '-')}</td><td>${escapeHtml(String(r.doc_date))}</td><td>${escapeHtml(r.counterparty)}</td><td>${formatMoney(r.total_sum)}</td></tr>
  `).join("");

  const salesRows = salesTop.rows.map(r => `
    <tr><td>${escapeHtml(r.title)}</td><td>${r.sold_qty}</td><td>${formatMoney(r.sold_sum)}</td></tr>
  `).join("");

  res.send(shell("Hisobotlar", `
    <div class="panel">
      <div class="nav"><a class="btn dark" href="/a">← Admin</a></div>
      <h2>📈 Hisobotlar</h2>
      <h3>1) Ostatka</h3>
      <table>
        <tr><th>Kitob</th><th>Qoldiq soni</th><th>Цена</th><th>Qoldiq summasi</th></tr>
        ${stockRows || `<tr><td colspan="4" class="empty">Ma'lumot yo'q</td></tr>`}
      </table>

      <h3 style="margin-top:20px">2) Prihodlar reestri</h3>
      <table>
        <tr><th>№</th><th>Sana</th><th>Kontragent</th><th>Jami</th></tr>
        ${purchaseRows || `<tr><td colspan="4" class="empty">Ma'lumot yo'q</td></tr>`}
      </table>

      <h3 style="margin-top:20px">3) Sotilgan kitoblar</h3>
      <table>
        <tr><th>Kitob</th><th>Sotilgan dona</th><th>Sotuv summasi</th></tr>
        ${salesRows || `<tr><td colspan="3" class="empty">Ma'lumot yo'q</td></tr>`}
      </table>
    </div>
  `, { admin: true }));
});

app.use((err, req, res, next) => {
  res.status(500).send(shell("Xatolik", `
    <div class="panel" style="max-width:760px;margin:0 auto">
      <div class="alert err">${escapeHtml(err.message || 'Noma\'lum xatolik')}</div>
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
