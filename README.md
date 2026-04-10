# Kitob Market Final

## Muhim
Telegram token ochiq bo'lib qoldi. Ishga tushirgandan keyin BotFather orqali tokenni albatta yangilang.

## Railway Variables
Majburiy:
- DATABASE_URL
- ADMIN_PIN=2026
- SESSION_SECRET=kitob-market-super-secret-2026
- DELIVERY_FEE=25000
- TELEGRAM_GROUP_CHAT_ID=group id

Rasm yo'qolmasligi uchun:
- CLOUDINARY_CLOUD_NAME
- CLOUDINARY_API_KEY
- CLOUDINARY_API_SECRET
- CLOUDINARY_FOLDER=kitob-market

Agar Cloudinary variables qo'yilmasa, rasm local uploads ga tushadi. Railway restart bo'lsa yo'qolishi mumkin.
Cloudinary qo'yilsa rasm yo'qolmaydi.

## Webhook
https://api.telegram.org/bot8709186194:AAEtHgdtcxV86UTzUZKcWPVeLMIBnPL_gkk/setWebhook?url=https://kitob-market-miniapp-production.up.railway.app/telegram/webhook

Tekshirish:
https://api.telegram.org/bot8709186194:AAEtHgdtcxV86UTzUZKcWPVeLMIBnPL_gkk/getWebhookInfo

## O'zgarishlar
- Holat o'zbekcha: Yangi, Jarayonda, Yetkazildi, Vozvrat
- Telegram tugma bosilgandan keyin tugmalar yo'qoladi
- Xabar ichidagi holat yangilanadi
- Lokatsiya bitta tugma bilan olinadi
- Rasm uchun Cloudinary tayyor
- Admin cookie secure/proxy aware
