const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Kitob Mini App</title>
      </head>
      <body>
        <h1>📚 Kitob Mini App ishlayapti!</h1>
        <p>Bu sizning birinchi Telegram Mini App'ingiz 🚀</p>
      </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server ishlayapti: " + PORT);
});
