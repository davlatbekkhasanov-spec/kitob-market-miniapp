KITOB MARKET - FIXED VERSION

1) package.json orqali dependency'larni o'rnating:
   npm install

2) .env.example fayldan nusxa olib .env yarating:
   cp .env.example .env

3) .env ichiga ayniqsa quyidagilarni to'ldiring:
   - DATABASE_URL
   - SESSION_SECRET
   - ADMIN_PIN
   - APP_URL
   - TELEGRAM_* kerak bo'lsa
   - CLOUDINARY_* kerak bo'lsa

4) Ishga tushirish:
   npm start

MUHIM TUZATISHLAR:
- dotenv qo'shildi
- fetch fallback qo'shildi (node-fetch)
- DATABASE_URL tekshiruvi qo'shildi
- default secret/pin uchun warning qo'shildi
- rasm saqlash data URL o'rniga local file fallback qilindi
- /health endpoint qo'shildi
- server error loglari yaxshilandi

ESLATMA:
- Railway'da uploads papkasi ephemeral bo'lishi mumkin.
- Production uchun rasm storage sifatida Cloudinary ishlatish tavsiya qilinadi.
