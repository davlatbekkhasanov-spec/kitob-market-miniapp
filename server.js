const express = require("express");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const upload = multer({ storage: multer.memoryStorage() });

async function uploadImage(file) {
  if (!file) return "";
  const base64 = file.buffer.toString("base64");

  const resp = await fetch(
    "https://api.imgbb.com/1/upload?key=08fc0452211bdc806ac49694254bc485",
    {
      method: "POST",
      body: new URLSearchParams({ image: base64 }),
    }
  );

  const data = await resp.json();
  return data.data.url;
}

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS books(
      id SERIAL PRIMARY KEY,
      title TEXT,
      price INT,
      image TEXT,
      stock INT DEFAULT 0
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS cart(
      id SERIAL,
      session TEXT,
      book_id INT,
      qty INT DEFAULT 1
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders(
      id SERIAL,
      items TEXT,
      total INT,
      source TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

app.get("/", async (req, res) => {
  const source = req.query.source;
  if (source) res.cookie("source", source);

  const books = await pool.query("SELECT * FROM books");

  res.send(`
    <h1>Kitob Market</h1>
    ${books.rows.map(b => `
      <div>
        <img src="${b.image}" width="100"/>
        <h3>${b.title}</h3>
        <p>${b.price} so'm</p>
        <button onclick="add(${b.id})">Savatcha</button>
      </div>
    `).join("")}

<script>
function add(id){
 fetch("/cart/"+id,{method:"POST"})
 alert("Qo'shildi")
}
</script>
  `);
});

app.post("/cart/:id", async (req, res) => {
  const sid = req.cookies.sid || Date.now().toString();
  res.cookie("sid", sid);

  await pool.query(
    "INSERT INTO cart(session, book_id, qty) VALUES ($1,$2,1)",
    [sid, req.params.id]
  );

  res.json({ ok: true });
});

app.post("/checkout", async (req, res) => {
  const sid = req.cookies.sid;
  const source = req.cookies.source || "unknown";

  const items = await pool.query(
    "SELECT * FROM cart WHERE session=$1",
    [sid]
  );

  let total = 0;

  for (let item of items.rows) {
    const book = await pool.query(
      "SELECT * FROM books WHERE id=$1",
      [item.book_id]
    );
    total += book.rows[0].price * item.qty;
  }

  await pool.query(
    "INSERT INTO orders(items,total,source) VALUES($1,$2,$3)",
    [JSON.stringify(items.rows), total, source]
  );

  res.send("Zakaz qabul qilindi");
});

app.post("/admin/add", upload.single("image"), async (req, res) => {
  const img = await uploadImage(req.file);

  await pool.query(
    "INSERT INTO books(title,price,image,stock) VALUES($1,$2,$3,$4)",
    [req.body.title, req.body.price, img, req.body.stock]
  );

  res.send("Qo'shildi");
});

app.listen(PORT, async () => {
  await init();
  console.log("Server working");
});
