module.exports = {
  PORT: process.env.PORT || 3000,
  DATABASE_URL: process.env.DATABASE_URL || '',
  ADMIN_PIN: process.env.ADMIN_PIN || '2026',
  SESSION_SECRET: process.env.SESSION_SECRET || 'kitob-market-super-secret-2026',
  STORE_LAT: Number(process.env.STORE_LAT || 39.653642),
  STORE_LNG: Number(process.env.STORE_LNG || 66.960933),
};
