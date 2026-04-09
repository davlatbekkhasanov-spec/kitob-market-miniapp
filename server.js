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
          .cart {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: black;
            color: white;
            padding: 15px;
            border-radius: 10px;
          }
        </style>
      </head>
      <body>

        <h1>📚 Kitoblar do‘koni</h1>

        <div class="book">
          <h3>Alifbo kitobi</h3>
          <p>20 000 so‘m</p>
          <button onclick="addToCart('Alifbo', 20000)">Savatga qo‘shish</button>
        </div>

        <div class="book">
          <h3>Matematika 1-sinf</h3>
          <p>25 000 so‘m</p>
          <button onclick="addToCart('Matematika', 25000)">Savatga qo‘shish</button>
        </div>

        <div class="cart" id="cart">
          Savat: 0 so‘m
        </div>

        <script>
          let total = 0;

          function addToCart(name, price) {
            total += price;
            document.getElementById("cart").innerText = "Savat: " + total + " so‘m";
          }
        </script>

      </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT);
