const express = require("express");
const { Pool } = require("pg");

const app = express();
app.use(express.json());

// 🔥 DATABASE CONNECTION
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// 🔥 CREATE TABLE (auto)
pool.query(`
  CREATE TABLE IF NOT EXISTS books (
    id SERIAL PRIMARY KEY,
    title TEXT,
    price INT
  )
`);

// 🔥 GET BOOKS
app.get("/", async (req, res) => {
  const result = await pool.query("SELECT * FROM books");

  let booksHTML = "";

  result.rows.forEach((book) => {
    booksHTML += `
      <div class="book">
        <h3>${book.title}</h3>
        <p>${book.price} so'm</p>
      </div>
    `;
  });

  res.send(`
    <html>
      <head>
        <style>
          body { font-family: Arial; padding: 20px; background: #f5f5f5; }
          .book { background: white; padding: 10px; margin: 10px 0; border-radius: 10px; }
        </style>
      </head>
      <body>
        <h1>📚 Kitoblar</h1>
        ${booksHTML}
      </body>
    </html>
  `);
});

// 🔥 ADD BOOK (ADMIN API)
app.post("/add-book", async (req, res) => {
  const { title, price } = req.body;

  await pool.query(
    "INSERT INTO books (title, price) VALUES ($1, $2)",
    [title, price]
  );

  res.send({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT);
