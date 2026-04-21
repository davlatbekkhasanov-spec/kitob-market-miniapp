Yangilangan to'plam:
- server.js ichida QR obyektlar uchun yangi logika qo'shildi
- Eski school/college/center QR manbalari initDb da olib tashlanadi
- 30 ta yangi kuzatiladigan QR obyekt qo'shildi: Obekt 1 ... Obekt 30
- Har bir QR link botga /start param bilan olib kiradi va bot Mini App ochish tugmasini yuboradi
- Buyurtma berilganda mijozga avtomatik "Buyurtmangiz qabul qilindi" xabari yuboriladi
- Buyurtma sahifasidagi qo'shimcha shaxsni tasdiqlash tugmalari olib tashlandi
- Admin panelda /admin/reports va /admin/sources sahifalari QR bo'yicha analytics ko'rsatadi
- Batafsil obyekt hisobot sahifasi: /admin/sources/:code

Muhim:
1) Railway'da TELEGRAM_BOT_TOKEN va TELEGRAM_BOT_USERNAME to'g'ri bo'lsin.
2) BotFather'da Mini App URL allaqachon sozlangan bo'lsa, shu QRlar ishlaydi.
3) Deploy qilingandan keyin initDb eski QR manbalarni source_refs jadvalidan tozalab, 30 ta object_* manbani yaratadi.
