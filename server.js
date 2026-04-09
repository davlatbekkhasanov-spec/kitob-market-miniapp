const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Kitob Market</title>
        <style>
          body {
            font-family: Arial;
            background: #f5f5f5;
            margin: 0;
            padding: 20px;
          }
          h1 {
            text-align: center;
          }
          .book {
            background: white;
            padding: 15px;
            margin: 10px 0;
            border-radius: 10px;
          }
          button {
            background: green;
            color: white;
            padding: 10px;
            border: none;
            border-radius: 5px;
          }
        </style>
      </head>
      <body>
        <h1>📚 Kitoblar do‘koni</h1>

        <div class="book">
          <h3>Alifbo kitobi</h3>
          <p>Narxi: 20 000 so‘m</p>
          <button>Savatga qo‘shish</button>
        </div>

        <div class="book">
          <h3>Matematika 1-sinf</h3>
          <p>Narxi: 25 000 so‘m</p>
          <button>Savatga qo‘shish</button>
        </div>

      </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT);
