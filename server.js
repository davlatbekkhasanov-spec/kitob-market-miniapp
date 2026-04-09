const express = require("express")
const { Pool } = require("pg")
const multer = require("multer")
const path = require("path")

const app = express()
app.use(express.urlencoded({ extended: true }))
app.use(express.json())

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

const storage = multer.diskStorage({
  destination: "./uploads",
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname))
  }
})
const upload = multer({ storage })

app.use("/uploads", express.static("uploads"))

const ADMIN_PIN = "2026"

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS books (
      id SERIAL PRIMARY KEY,
      title TEXT,
      price INT,
      image TEXT,
      stock INT DEFAULT 0
    );
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS counterparties (
      id SERIAL PRIMARY KEY,
      name TEXT
    );
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS purchases (
      id SERIAL PRIMARY KEY,
      counterparty_id INT,
      total INT
    );
  `)
}
initDB()

app.get("/", async (req, res) => {
  const books = await pool.query("SELECT * FROM books")
  let html = "<h1>Kitoblar</h1><a href='/admin'>Admin</a><hr/>"
  books.rows.forEach(b=>{
    html+=`<div>
    <img src="${b.image}" width="100"/>
    <h3>${b.title}</h3>
    <p>${b.price} so'm</p>
    <p>${b.stock} dona</p>
    </div>`
  })
  res.send(html)
})

app.get("/admin",(req,res)=>{
  res.send(`<form method="POST">
  <input name="pin"/>
  <button>Kirish</button>
  </form>`)
})

app.post("/admin",(req,res)=>{
  if(req.body.pin===ADMIN_PIN) return res.redirect("/dashboard")
  res.send("Xato PIN")
})

app.get("/dashboard", async (req,res)=>{
  const books = await pool.query("SELECT * FROM books")
  const cps = await pool.query("SELECT * FROM counterparties")

  let html = `<h2>Admin</h2>

  <form action="/add-book" method="POST" enctype="multipart/form-data">
  <input name="title"/>
  <input name="price"/>
  <input type="file" name="image"/>
  <button>Kitob qo'shish</button>
  </form>

  <form action="/add-counterparty" method="POST">
  <input name="name"/>
  <button>Kontragent</button>
  </form>

  <form action="/purchase" method="POST">
  <select name="book_id">`

  books.rows.forEach(b=>{
    html+=`<option value="${b.id}">${b.title}</option>`
  })

  html+=`</select>
  <input name="qty"/>
  <input name="price"/>

  <select name="counterparty_id">`

  cps.rows.forEach(c=>{
    html+=`<option value="${c.id}">${c.name}</option>`
  })

  html+=`</select>
  <button>Prikhod</button>
  </form>`

  res.send(html)
})

app.post("/add-book", upload.single("image"), async (req,res)=>{
  const {title,price}=req.body
  const image="/uploads/"+req.file.filename

  await pool.query(
    "INSERT INTO books(title,price,image) VALUES($1,$2,$3)",
    [title,price,image]
  )

  res.redirect("/dashboard")
})

app.post("/add-counterparty", async (req,res)=>{
  await pool.query("INSERT INTO counterparties(name) VALUES($1)",[req.body.name])
  res.redirect("/dashboard")
})

app.post("/purchase", async (req,res)=>{
  const {book_id,qty,price,counterparty_id}=req.body
  const total = qty*price

  await pool.query(
    "INSERT INTO purchases(counterparty_id,total) VALUES($1,$2)",
    [counterparty_id,total]
  )

  await pool.query(
    "UPDATE books SET stock=stock+$1 WHERE id=$2",
    [qty,book_id]
  )

  res.redirect("/dashboard")
})

const PORT = process.env.PORT || 3000
app.listen(PORT,()=>console.log("RUNNING",PORT))
