# Kitob Market Final Patch

## Nima qo'shildi
- Savatcha (cart) va bitta zakazda bir nechta mahsulot
- Delivery fee faqat bir marta hisoblanadi
- Source / QR tracking (`?source=school_1`)
- Adminda QR manbalar sahifasi
- Admin hisobotida manba bo'yicha analytics
- Kategoriya CRUD
- Lokatsiya tugmasida loading va success holat
- Telegram callback tugmalari: Jarayonda / Yetkazildi / Vozvrat
- Telegram xabarda manba ham ko'rinadi
- Rasm `object-fit: contain` bilan to'liq ko'rinadi

## Muhim
Telegram token ochiq bo'lib qolgani uchun BotFather orqali tokenni yangilang.

## Railway Variables
Majburiy:
- DATABASE_URL
- ADMIN_PIN=2026
- SESSION_SECRET=kitob-market-super-secret-2026
- DELIVERY_FEE=25000
- APP_URL=https://kitob-market-miniapp-production.up.railway.app
- TELEGRAM_BOT_TOKEN=
- TELEGRAM_GROUP_CHAT_ID=
- IMGBB_API_KEY=

## Webhook
Webhook URL faylda bor:
`webhook.txt`

## QR tracking
Misol:
- `https://kitob-market-miniapp-production.up.railway.app/?source=school_1`
- `https://kitob-market-miniapp-production.up.railway.app/?source=college_1`
- `https://kitob-market-miniapp-production.up.railway.app/?source=center_1`

Admin panel:
- `/admin/sources` -> barcha linklar
- `/admin/reports` -> analytics
