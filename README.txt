Kitob Market - tayyor yangilangan server.js

Qo'shilgan asosiy funksiyalar:
1) QR orqali Telegram ichida kirilganda avtomatik bind/auth
2) Username bo'lmasa ham Telegram ID orqali mijoz akkauntiga o'tish linki
3) Guruhga yuboriladigan xabarda "Mijoz akkaunti" tugmasi

Nima qilish kerak:
1. Eski server.js o'rniga shu faylni qo'ying
2. Railway'da deploy qiling
3. APP_URL va TELEGRAM_BOT_TOKEN to'g'ri ekanini tekshiring
4. Webhook qayta o'rnatilgan bo'lsa yaxshi

Webhook namunasi:
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=<APP_URL>/telegram/webhook
