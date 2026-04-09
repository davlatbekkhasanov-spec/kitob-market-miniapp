const express = require("express");
const { Pool } = require("pg");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS books (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      price INTEGER NOT NULL
    )
  `);
}

app.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, title, price FROM books ORDER BY id DESC"
    );

    const booksHTML = result.rows.length
      ? result.rows.map((book) => `
          <div class="book">
            <h3>${book.title}</h3>
            <p>${book.price.toLocaleString("ru-RU")} so'm</p>
          </div>
        `).join("")
      : `<div class="empty">Hozircha kitoblar yo'q</div>`;

    res.send(`
      <!DOCTYPE html>
      <html lang="uz">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Kitob Market</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              margin: 0;
              background: #f5f5f5;
            }
            h1 {
              margin-top: 0;
            }
            .topbar {
              display: flex;
              gap: 10px;
              margin-bottom: 20px;
            }
            .btn {
              display: inline-block;
              background: #111;
              color: #fff;
              text-decoration: none;
              padding: 10px 14px;
              border-radius: 10px;
              font-size: 14px;
            }
            .book {
              background: #fff;
              border-radius: 14px;
              padding: 16px;
              margin-bottom: 12px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.06);
            }
            .book h3 {
              margin: 0 0 8px 0;
            }
            .book p {
              margin: 0;
              font-size: 18px;
              font-weight: bold;
              color: #1a7f37;
            }
            .empty {
              background: #fff;
              border-radius: 14px;
              padding: 16px;
            }
          </style>
        </head>
        <body>
          <h1>📚 Kitoblar</h1>

          <div class="topbar">
            <a class="btn" href="/admin">Admin panel</a>
          </div>

          ${booksHTML}
        </body>
      </html>
    `);
  } catch (error) {
    console.error("GET / error:", error);
    res.status(500).send("Xatolik: kitoblarni yuklab bo'lmadi");
  }
});

app.get("/admin", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="uz">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Admin Panel</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            margin: 0;
            background: #f5f5f5;
          }
          .card {
            background: #fff;
            border-radius: 14px;
            padding: 18px;
            max-width: 500px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.06);
          }
          h1 {
            margin-top: 0;
          }
          label {
            display: block;
            margin: 12px 0 6px;
            font-weight: bold;
          }
          input {
            width: 100%;
            padding: 12px;
            border: 1px solid #ccc;
            border-radius: 10px;
            font-size: 16px;
            box-sizing: border-box;
          }
          button {
            margin-top: 16px;
            width: 100%;
            padding: 12px;
            border: none;
            border-radius: 10px;
            background: #0a7f2e;
            color: #fff;
            font-size: 16px;
            cursor: pointer;
          }
          a {
            display: inline-block;
            margin-top: 14px;
            text-decoration: none;
            color: #111;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>🛠 Admin panel</h1>
          <form method="POST" action="/admin/add-book">
            <label>Kitob nomi</label>
            <input type="text" name="title" required />

            <label>Narxi</label>
            <input type="number" name="price" required />

            <button type="submit">Kitob qo'shish</button>
          </form>

          <a href="/">← Ortga qaytish</a>
        </div>
      </body>
    </html>
  `);
});

app.post("/admin/add-book", async (req, res) => {
  try {
    const { title, price } = req.body;

    if (!title || !price) {
      return res.status(400).send("Title va price majburiy");
    }

    await pool.query(
      "INSERT INTO books (title, price) VALUES ($1, $2)",
      [title, Number(price)]
    );

    res.redirect("/");
  } catch (error) {
    console.error("POST /admin/add-book error:", error);
    res.status(500).send("Xatolik: kitob qo'shib bo'lmadi");
  }
});

const PORT = process.env.PORT || 3000;

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log("Server started on port " + PORT);
    });
  })
  .catch((error) => {
    console.error("DB init error:", error);
    process.exit(1);
  });
