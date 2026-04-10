# Kitob Market Group Ready

## Variables
- DATABASE_URL
- ADMIN_PIN=2026
- SESSION_SECRET=kitob-market-super-secret-2026
- DELIVERY_FEE=25000
- TELEGRAM_BOT_TOKEN=your_bot_token
- TELEGRAM_GROUP_CHAT_ID=your_group_chat_id
- APP_URL=https://your-app.up.railway.app

## Telegram group orders
1. Botni groupga qo'shing va admin qiling
2. Variables ga TELEGRAM_BOT_TOKEN va TELEGRAM_GROUP_CHAT_ID yozing
3. Webhook o'rnating:
   https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=<APP_URL>/telegram/webhook

## Yangi narsalar
- Bitta tugma bilan real lokatsiya olish
- Zakaz groupga avtomatik tushadi
- Groupta tugmalar:
  - Yetkazildi
  - Jarayonda
  - Vozvrat
- Bosilganda order holati yangilanadi
