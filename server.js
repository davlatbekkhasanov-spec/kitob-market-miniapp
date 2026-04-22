const express = require("express");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const PDFDocument = require("pdfkit");
const { Pool } = require("pg");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { v2: cloudinary } = require("cloudinary");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PIN = process.env.ADMIN_PIN || "2026";
const SESSION_SECRET = process.env.SESSION_SECRET || "kitob-market-super-secret-2026";
const DELIVERY_FEE = Number(process.env.DELIVERY_FEE || 14500);
const STORE_LAT = Number(process.env.STORE_LAT || 39.653642);
const STORE_LNG = Number(process.env.STORE_LNG || 66.960933);
const APP_URL = process.env.APP_URL || "https://kitob-market-miniapp-production.up.railway.app";
const IMGBB_API_KEY = process.env.IMGBB_API_KEY || "08fc0452211bdc806ac49694254bc485";
const PAYME_PAYMENT_URL = process.env.PAYME_PAYMENT_URL || process.env.PAYME_QR_LINK || "https://transfer.paycom.uz/693801c1958777a0164fea76";
const CLICK_PAYMENT_URL = process.env.CLICK_PAYMENT_URL || process.env.CLICK_QR_LINK || "https://indoor.click.uz/pay?id=081328&t=0";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_GROUP_CHAT_ID = process.env.TELEGRAM_GROUP_CHAT_ID || "";
const TELEGRAM_BOT_USERNAME = String(process.env.TELEGRAM_BOT_USERNAME || "@kitob_maktab_shop_bot").replace(/^@+/, "");
const UPLOAD_DIR = path.join(__dirname, "uploads");

const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || "";
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || "";
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || "";
const CLOUDINARY_FOLDER = process.env.CLOUDINARY_FOLDER || "kitob-market";
const HAS_CLOUDINARY = Boolean(CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET);
if (HAS_CLOUDINARY) {
  cloudinary.config({ cloud_name: CLOUDINARY_CLOUD_NAME, api_key: CLOUDINARY_API_KEY, api_secret: CLOUDINARY_API_SECRET, secure: true });
}
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.set("trust proxy", 1);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false },
});
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ["image/jpeg", "image/png", "image/webp", "image/jpg"].includes(file.mimetype);
    if (!ok) return cb(new Error("Faqat JPG, PNG yoki WEBP rasm mumkin"));
    cb(null, true);
  },
});
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser(SESSION_SECRET));
app.use("/uploads", express.static(UPLOAD_DIR));

function q(text, params = []) { return pool.query(text, params); }
function esc(value = "") { return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }
function money(v) { return Number(v || 0).toLocaleString("ru-RU") + " so'm"; }
function dateUz(v) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v || "");
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}.${mm}.${yy}`;
}
function pickPdfFontPath(name) {
  const candidates = [
    path.join(__dirname, "fonts", name),
    path.join("/usr/share/fonts/truetype/dejavu", name),
    path.join("/usr/share/fonts", name),
  ];
  return candidates.find((p) => fs.existsSync(p)) || "";
}
function signedAdminValue() { return crypto.createHash("sha256").update(`${ADMIN_PIN}|${SESSION_SECRET}`).digest("hex"); }
function isAdmin(req) { return req.signedCookies.admin === signedAdminValue(); }
function requireAdmin(req, res, next) { if (!isAdmin(req)) return res.redirect("/admin/login"); next(); }
function isSecureRequest(req) { return req.secure || req.headers["x-forwarded-proto"] === "https"; }
function ensureBindToken(req, res) {
  const existing = String(req.signedCookies.tg_bind_token || "").trim();
  if (existing) return existing;
  const token = crypto.randomBytes(12).toString("hex");
  res.cookie("tg_bind_token", token, { httpOnly: true, signed: true, sameSite: "lax", secure: isSecureRequest(req), maxAge: 1000 * 60 * 60 * 24 * 30 });
  return token;
}
function statusLabel(status) { return ({ new: "Yangi", in_progress: "Jarayonda", delivered: "Yetkazildi", returned: "Vozvrat" })[String(status||"")] || String(status||""); }
function paymentTypeLabel(v) { return ({ cash: "Naqd", online: "Online" })[String(v||"")] || String(v||""); }
function paymentProviderLabel(v) { return ({ payme: "Payme", click: "Click", none: "-" })[String(v||"")] || String(v||""); }
function normalizeTelegramTarget(value = "") {
  const v = String(value || "").trim();
  if (!v) return "";
  if (/^-?\d+$/.test(v)) return v;
  if (v.startsWith("@")) return v;
  return v.startsWith("https://t.me/") ? `@${v.split("/").pop()}` : `@${v.replace(/^@+/, "")}`;
}
function encodeBatchToken(batchId = "") { return Buffer.from(String(batchId), "utf8").toString("base64url"); }
function decodeBatchToken(token = "") {
  try { return Buffer.from(String(token), "base64url").toString("utf8"); } catch (_e) { return ""; }
}
function statusActionSig(orderId, status) {
  return crypto.createHash("sha256").update(`${orderId}|${status}|${SESSION_SECRET}`).digest("hex").slice(0, 16);
}
function statusActionUrl(orderId, status) {
  return `${APP_URL}/telegram/status/${orderId}/${status}/${statusActionSig(orderId, status)}`;
}


function buildTelegramAccountLink(username = "") {
  const u = String(username || "").trim();
  if (!u) return "";
  return `https://t.me/${u.replace(/^@+/, "")}`;
}
function escapeJsString(value = "") {
  return JSON.stringify(String(value || "")).slice(1, -1);
}
function verifyTelegramInitData(initData = "") {
  try {
    const raw = String(initData || "").trim();
    if (!raw || !TELEGRAM_BOT_TOKEN) return false;
    const params = new URLSearchParams(raw);
    const hash = params.get("hash");
    if (!hash) return false;
    const authDate = Number(params.get("auth_date") || 0);
    if (!authDate) return false;
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - authDate) > 60 * 60 * 24) return false;
    params.delete("hash");
    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");
    const secretKey = crypto.createHmac("sha256", "WebAppData").update(TELEGRAM_BOT_TOKEN).digest();
    const expectedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(expectedHash, "hex"));
  } catch (_e) {
    return false;
  }
}

function sourceMeta(code = "") {
  const value = String(code || "").trim();
  if (!value) return { code: "", type: "", name: "" };
  const m = value.match(/^object_(\d{1,3})$/);
  if (!m) return { code: value, type: "other", name: value };
  const n = Number(m[1]);
  return { code: value, type: "object", name: `Obekt ${n}` };
}
function batchIdFallback() { return `Zakaz №${Date.now()}`; }
function getSourceCode(req) { return String(req.query.source || req.cookies.source_code || req.body.source_code || "").trim(); }
function extractLatLng(value = "") {
  const text = String(value || "").trim();
  if (!text) return null;
  const pairRegexes = [
    /[?&]q=(-?\d+(?:\.\d+)?)%2C(-?\d+(?:\.\d+)?)/i,
    /[?&]q=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i,
    /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i,
    /(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/,
  ];
  for (const rx of pairRegexes) {
    const m = text.match(rx);
    if (!m) continue;
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
    return { lat: String(lat), lng: String(lng) };
  }
  return null;
}
function resolveLocation(rawLat, rawLng, rawLocationUrl, rawAddress) {
  let lat = String(rawLat || "").trim();
  let lng = String(rawLng || "").trim();
  let locationUrl = String(rawLocationUrl || "").trim();
  const address = String(rawAddress || "").trim();

  if (!lat || !lng) {
    const fromUrl = extractLatLng(locationUrl);
    if (fromUrl) {
      lat = fromUrl.lat;
      lng = fromUrl.lng;
    }
  }
  if ((!lat || !lng) && address) {
    const fromAddress = extractLatLng(address);
    if (fromAddress) {
      lat = fromAddress.lat;
      lng = fromAddress.lng;
    }
  }
  if (!locationUrl && lat && lng) locationUrl = buildLocationUrl(lat, lng);
  return { lat, lng, locationUrl };
}

function haversineDistanceKm(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(Number(lat2) - Number(lat1));
  const dLng = toRad(Number(lng2) - Number(lng1));
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(Number(lat1))) * Math.cos(toRad(Number(lat2))) *
    Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function roundDistanceKm(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}
function calculateDelivery(distanceKm) {
  const km = Number(distanceKm || 0);
  const baseDistance = 5;
  const basePrice = 18000;
  const perKm = 3000;
  if (km <= baseDistance) return basePrice;
  return Math.round(basePrice + ((km - baseDistance) * perKm));
}
function calculateDeliveryFromLocation(lat, lng) {
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
    return { distanceKm: 0, deliveryFee: DELIVERY_FEE };
  }
  const distanceKm = roundDistanceKm(haversineDistanceKm(STORE_LAT, STORE_LNG, Number(lat), Number(lng)));
  return { distanceKm, deliveryFee: calculateDelivery(distanceKm) };
}
function normalizePaymentType(value = "") {
  return String(value || "").trim() === "online" ? "online" : "cash";
}
function normalizePaymentProvider(value = "", paymentType = "") {
  const v = String(value || "").trim();
  if (paymentType !== "online") return "none";
  if (v === "payme" || v === "click") return v;
  return "payme";
}
function paymentStatusLabel(value = "") {
  return ({ pending: "Kutilmoqda", confirmed: "Tasdiqlangan", paid: "To'langan" })[String(value || "")] || String(value || "");
}
function paymentProviderLink(value = "") {
  const v = String(value || "").trim();
  if (v === "payme") return PAYME_PAYMENT_URL;
  if (v === "click") return CLICK_PAYMENT_URL;
  return "";
}
function buildPaymentCheckoutLink(provider, amount, orderRef = "") {
  const template = String(paymentProviderLink(provider) || "").trim();
  if (!template) return "";
  const sum = String(Math.max(0, Math.round(Number(amount) || 0)));
  return template
    .replaceAll("{amount}", encodeURIComponent(sum))
    .replaceAll("{summa}", encodeURIComponent(sum))
    .replaceAll("{order}", encodeURIComponent(String(orderRef || "")));
}
function buildOrderActionButtons(order = {}) {
  const buttons = [];
  const accountLink = buildTelegramAccountLink(order.customer_telegram_username);
  if (accountLink) buttons.push([{ text: "👤 Mijoz akkaunti", url: accountLink }]);
  const paymentRow = [];
  const paymentType = normalizePaymentType(order.payment_type);
  const paymentStatus = String(order.payment_status || "pending");
  if (paymentType === "cash" && paymentStatus !== "confirmed") {
    paymentRow.push({ text: "✅ Naqd tasdiqlandi", callback_data: `pay:${order.id}:cash` });
  }
  if (paymentType === "online") {
    if (order.payment_proof_image) paymentRow.push({ text: "🧾 Chek", url: order.payment_proof_image });
    if (paymentStatus !== "paid") paymentRow.push({ text: "✅ Online tasdiqlandi", callback_data: `pay:${order.id}:online` });
  }
  if (paymentRow.length) buttons.push(paymentRow);
  if (String(order.status || "new") !== "delivered" && String(order.status || "new") !== "returned") {
    buttons.push([
      { text: "✅ Yetkazildi", callback_data: `o:${order.id}:d` },
      { text: "↩️ Vozvrat", callback_data: `o:${order.id}:r` }
    ]);
  }
  return buttons;
}
function cartSessionId(req, res) {
  let sid = String(req.signedCookies.cart_sid || "");
  if (!sid) {
    sid = crypto.randomBytes(16).toString("hex");
    res.cookie("cart_sid", sid, { signed: true, httpOnly: true, sameSite: "lax", secure: isSecureRequest(req), maxAge: 1000 * 60 * 60 * 24 * 30 });
  }
  return sid;
}
async function cartCount(req) {
  const sid = String(req.signedCookies.cart_sid || "");
  if (!sid) return 0;
  const r = await q(`SELECT COALESCE(SUM(qty),0)::int AS cnt FROM cart_items WHERE session_id=$1`, [sid]);
  return Number(r.rows[0]?.cnt || 0);
}
async function getCartItems(req) {
  const sid = String(req.signedCookies.cart_sid || "");
  if (!sid) return [];
  const r = await q(`SELECT c.book_id, c.qty, b.title, b.author, b.image, b.sale_price, b.stock_qty
                     FROM cart_items c
                     JOIN books b ON b.id=c.book_id
                     WHERE c.session_id=$1 AND b.active=TRUE
                     ORDER BY c.id DESC`, [sid]);
  return r.rows;
}
function cartItemHtml(item) {
  const sum = Number(item.sale_price || 0) * Number(item.qty || 0);
  return `<div class="card">
    <div class="grid2">
      <div class="book-image" style="height:170px">${item.image ? `<img src="${esc(item.image)}" alt="${esc(item.title)}" />` : "📚"}</div>
      <div>
        <div class="title" style="font-size:22px;margin-top:0">${esc(item.title)}</div>
        <div class="muted">${esc(item.author || "")}</div>
        <div class="price">${money(item.sale_price)}</div>
        <div class="stock ok">Omborda: ${item.stock_qty} dona</div>
        <form class="form" method="post" action="/cart/update/${item.book_id}" style="margin-top:10px">
          <div class="grid2">
            <input type="number" name="qty" min="1" max="${Math.max(1, Number(item.stock_qty || 1))}" value="${Number(item.qty || 1)}" />
            <button class="btn soft" type="submit">Yangilash</button>
          </div>
        </form>
        <div class="order-summary" style="margin-top:10px"><b>Summa:</b> ${money(sum)}</div>
        <form method="post" action="/cart/remove/${item.book_id}" style="margin-top:10px">
          <button class="btn red" type="submit">Olib tashlash</button>
        </form>
      </div>
    </div>
  </div>`;
}
function sourceBadge(sourceCode) {
  const meta = sourceMeta(sourceCode);
  return meta.code ? `<div class="tag">Manba: ${esc(meta.name)}</div>` : "";
}
function openWebAppButton(sourceCode = "") {
  const meta = sourceMeta(sourceCode);
  const code = meta.code || String(sourceCode || "").trim();
  return { text: "📲 Mini Appni ochish", web_app: { url: `${APP_URL}/?source=${encodeURIComponent(code)}` } };
}
async function sendBatchToGroup(batch) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_GROUP_CHAT_ID) return null;
  const first = batch.rows?.[0] || {};
  const buttons = buildOrderActionButtons(first);
  return await tg("sendMessage", { chat_id: TELEGRAM_GROUP_CHAT_ID, text: batch.text, reply_markup: { inline_keyboard: buttons }, disable_web_page_preview: false });
}
async function getBatchSummary(batch) {
  const r = await q(`SELECT o.*, b.title AS book_title FROM customer_orders o JOIN books b ON b.id=o.book_id WHERE o.batch_id=$1 ORDER BY o.id`, [batch]);
  if (!r.rows.length) return null;
  const rows = r.rows;
  const first = rows[0];
  const items = rows.map(x => `• ${x.book_title} — ${x.qty} dona — ${money(x.subtotal)}`).join("\n");
  const locPart = first.location_url ? `\n📍 Lokatsiya: ${first.location_url}` : "";
  const accountLink = buildTelegramAccountLink(first.customer_telegram_username);
  const accountPart = first.customer_telegram_username
    ? `\n🆔 Buyurtmachi akkaunt: ${first.customer_telegram_username}\n🔗 Akkountga o'tish: ${accountLink}`
    : (first.customer_telegram ? `\n🆔 Buyurtmachi ID: ${first.customer_telegram}` : "");
  const total = rows.reduce((a, x) => a + Number(x.total_sum || 0), 0);
  const status = statusLabel(first.status);
  const paymentPart = `\n💳 To'lov: ${paymentTypeLabel(first.payment_type)}${first.payment_type === "online" ? ` (${paymentProviderLabel(first.payment_provider)})` : ""} | ${paymentStatusLabel(first.payment_status)}`;
  const distancePart = Number(first.distance_km || 0) > 0 ? `\n📏 Masofa: ${Number(first.distance_km).toFixed(1)} km` : "";
  const deliveryPart = `\n🚚 Dostavka: ${money(first.delivery_fee)}`;
  const receiptPart = first.status === "delivered" ? " | 🧾 Chek" : "";
  return {
    batch_id: batch,
    rows,
    text: `🛒 ${batch}\n${items}\n👤 Mijoz: ${first.customer_name || "-"}\n📞 Telefon: ${first.phone}${accountPart}\n🏠 Manzil: ${first.address_text || "-"}${locPart}${distancePart}${deliveryPart}${paymentPart}\n💵 Jami: ${money(total)}\n📌 Holat: ${status}${receiptPart}`
  };
}
function page(title, body, opts = {}) {
  const adminChip = opts.admin ? `<a class="admin-chip" href="/admin" aria-label="Admin panel">🛡️</a>` : `<a class="admin-chip" href="/admin/login" aria-label="Admin kirish">🛡️</a>`;
  return `<!doctype html><html lang="uz"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${esc(title)}</title><style>
:root{--bg:#f2f5fb;--text:#142032;--muted:#607089;--card:#ffffff;--line:#dde6f4;--primary:#2f6fff;--dark:#15233f;--green:#18a34a;--red:#d93b3b;}*{box-sizing:border-box}body{margin:0;font-family:Arial,Helvetica,sans-serif;background:linear-gradient(180deg,#0f1e38 0,#0f1e38 170px,var(--bg) 170px);color:var(--text)}.top{max-width:1100px;margin:0 auto;padding:18px 14px 24px;color:#fff;display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.brand{font-size:34px;font-weight:900}.sub{color:#c5d1ea;margin-top:4px}.wrap{max-width:1100px;margin:0 auto;padding:0 14px 90px}.hero{background:linear-gradient(135deg,#182c54,#23417a);border-radius:28px;color:#fff;padding:22px;box-shadow:0 16px 40px rgba(15,23,42,.22)}.hero h1{margin:0 0 8px;font-size:38px}.hero p{margin:0;color:#d9e3f7;line-height:1.5}.panel,.card,.stat{background:var(--card);border-radius:22px;box-shadow:0 10px 28px rgba(15,23,42,.08)}.panel{padding:18px;margin-top:18px}.cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:18px}@media(max-width:700px){.cards{grid-template-columns:repeat(2,minmax(0,1fr))}.hero h1{font-size:30px}.brand{font-size:28px}}@media(max-width:420px){.cards{grid-template-columns:1fr 1fr;gap:10px}}.card{padding:14px}.book-image{height:220px;background:#fff;border-radius:18px;display:flex;align-items:center;justify-content:center;overflow:hidden}.book-image img{width:100%;height:100%;object-fit:contain}.title{font-size:23px;font-weight:900;margin-top:12px}.muted{color:var(--muted)}.price{font-size:24px;font-weight:900;margin-top:10px}.stock{margin-top:8px;font-weight:700}.stock.ok{color:var(--green)}.stock.no{color:var(--red)}.nav,.actions,.searchbar{display:flex;gap:10px;flex-wrap:wrap}.btn,button{border:0;border-radius:14px;padding:11px 15px;background:var(--primary);color:#fff;text-decoration:none;font-weight:800;cursor:pointer}.btn.dark{background:var(--dark)}.btn.soft{background:#e8f0ff;color:#1741a5}.btn.green{background:var(--green)}.btn.red{background:var(--red)}.form{display:grid;gap:12px}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:700px){.grid2{grid-template-columns:1fr}}input,select,textarea{width:100%;border:1px solid var(--line);border-radius:14px;padding:12px 13px;font-size:16px;background:#fff}textarea{min-height:90px;resize:vertical}table{width:100%;border-collapse:collapse}th,td{padding:10px 8px;border-bottom:1px solid #edf2fb;text-align:left;vertical-align:top;font-size:14px}.stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-top:14px}.stat{padding:16px}.n{font-size:26px;font-weight:900;margin-top:6px}.alert{padding:12px 14px;border-radius:16px;margin-bottom:12px;font-weight:700}.alert.err{background:#fff0f0;color:#b91c1c}.alert.ok{background:#edfdf1;color:#0a7a34}.right{text-align:right}.label{font-size:13px;color:var(--muted);font-weight:700;margin-bottom:4px}.order-summary{background:#f8fbff;border:1px solid #e2ebf8;border-radius:18px;padding:14px}.tag{display:inline-block;background:#eaf1ff;color:#1741a5;border-radius:999px;padding:8px 12px;font-size:14px;font-weight:800}.small{font-size:12px;color:#607089}.admin-chip{display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:16px;background:#e8f0ff;color:#1741a5;text-decoration:none;font-size:24px;font-weight:900;box-shadow:0 10px 28px rgba(15,23,42,.08)}
</style></head><body><div class="top"><div><div class="brand">Kitob Market</div><div class="sub">Bilimga bir qadam yaqinroq</div></div>${adminChip}</div><div class="wrap">${body}</div></body></html>`;
}

function telegramAutoBindScript(bindToken = "", sourceCode = "") {
  const safeToken = escapeJsString(bindToken);
  const safeSource = escapeJsString(sourceCode);
  return `<script src="https://telegram.org/js/telegram-web-app.js"></script><script>
(function(){
  const bindToken = "${safeToken}";
  const sourceCode = "${safeSource}";
  if (!bindToken) return;
  async function checkBind(){
    try{
      const r = await fetch('/telegram/bind/status?token=' + encodeURIComponent(bindToken), { credentials:'include' });
      const j = await r.json();
      if (j && j.verified) {
        const s=document.getElementById('verifyStatus');
        if(s){s.style.display='inline-block';}
        const b=document.getElementById('verifyBtn');
        if(b){b.textContent='Telegram tasdiqlandi';b.classList.add('green');}
        const w=document.getElementById('verifyWrap');
        if(w){w.style.display='none';}
        return true;
      }
    }catch(_e){}
    return false;
  }
  async function autoBind(){
    const tg = window.Telegram && window.Telegram.WebApp;
    if (!tg) return;
    try{ tg.ready(); }catch(_e){}
    const user = tg.initDataUnsafe && tg.initDataUnsafe.user;
    if (!user || !user.id) return;
    try{
      await fetch('/telegram/webapp-auth', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        credentials:'include',
        body: JSON.stringify({
          bindToken,
          sourceCode,
          initData: tg.initData || '',
          id: String(user.id || ''),
          username: user.username ? '@' + String(user.username).replace(/^@+/, '') : '',
          first_name: user.first_name || '',
          last_name: user.last_name || ''
        })
      });
      await checkBind();
    }catch(_e){}
  }
  checkBind();
  autoBind();
  setInterval(checkBind, 3000);
})();
</script>`;
}

function extFromMime(mime = "") { if (mime.includes("png")) return ".png"; if (mime.includes("webp")) return ".webp"; return ".jpg"; }
async function saveImage(file) {
  if (!file) return "";

  if (HAS_CLOUDINARY) {
    try {
      const uploaded = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: CLOUDINARY_FOLDER, resource_type: "image" },
          (err, result) => (err ? reject(err) : resolve(result)),
        );
        stream.end(file.buffer);
      });
      if (uploaded && uploaded.secure_url) {
        return uploaded.secure_url;
      }
    } catch (_e) {
      // Cloudinary ishlamasa, ImgBB va local fallbackga o'tamiz.
    }
  }

  if (IMGBB_API_KEY) {
    try {
      const base64 = file.buffer.toString("base64");
      const resp = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ image: base64 }),
      });
      const data = await resp.json();
      if (resp.ok && data.success && data.data && data.data.url) {
        return data.data.url;
      }
    } catch (_e) {
      // ImgBB ham ishlamasa local fallbackga o'tamiz.
    }
  }

  // Railway kabi ephemeral diskda restartdan keyin local fayllar yo'qolib qolishi mumkin.
  // Shuning uchun oxirgi fallback sifatida rasmni data URL ko'rinishida DBga saqlaymiz.
  const mime = file.mimetype || "image/jpeg";
  const base64 = file.buffer.toString("base64");
  return `data:${mime};base64,${base64}`;
}
async function initDb() {
  await q(`CREATE TABLE IF NOT EXISTS counterparties (id BIGSERIAL PRIMARY KEY,name TEXT NOT NULL,phone TEXT DEFAULT '',note TEXT DEFAULT '',created_at TIMESTAMP NOT NULL DEFAULT NOW())`);
  await q(`CREATE TABLE IF NOT EXISTS books (id BIGSERIAL PRIMARY KEY,title TEXT NOT NULL,author TEXT DEFAULT '',image TEXT DEFAULT '',purchase_price BIGINT NOT NULL DEFAULT 0,markup_percent NUMERIC(10,2) NOT NULL DEFAULT 0,sale_price BIGINT NOT NULL DEFAULT 0,stock_qty INT NOT NULL DEFAULT 0,active BOOLEAN NOT NULL DEFAULT TRUE,created_at TIMESTAMP NOT NULL DEFAULT NOW(),updated_at TIMESTAMP NOT NULL DEFAULT NOW())`);
  await q(`ALTER TABLE books ADD COLUMN IF NOT EXISTS author TEXT DEFAULT ''`); await q(`ALTER TABLE books ADD COLUMN IF NOT EXISTS image TEXT DEFAULT ''`); await q(`ALTER TABLE books ADD COLUMN IF NOT EXISTS purchase_price BIGINT NOT NULL DEFAULT 0`); await q(`ALTER TABLE books ADD COLUMN IF NOT EXISTS markup_percent NUMERIC(10,2) NOT NULL DEFAULT 0`); await q(`ALTER TABLE books ADD COLUMN IF NOT EXISTS sale_price BIGINT NOT NULL DEFAULT 0`); await q(`ALTER TABLE books ADD COLUMN IF NOT EXISTS stock_qty INT NOT NULL DEFAULT 0`); await q(`ALTER TABLE books ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE`); await q(`ALTER TABLE books ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW()`); await q(`ALTER TABLE books ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW()`);
  await q(`DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='books' AND column_name='image_url') THEN UPDATE books SET image = COALESCE(NULLIF(image, ''), image_url) WHERE COALESCE(image, '') = ''; END IF; END $$;`);
  await q(`DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='books' AND column_name='price') THEN UPDATE books SET purchase_price = CASE WHEN COALESCE(purchase_price, 0) = 0 THEN COALESCE(price, 0) ELSE purchase_price END, sale_price = CASE WHEN COALESCE(sale_price, 0) = 0 THEN COALESCE(price, 0) ELSE sale_price END WHERE price IS NOT NULL; END IF; END $$;`);
  await q(`DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='books' AND column_name='price') THEN ALTER TABLE books DROP COLUMN price; END IF; END $$;`);
  await q(`DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='books' AND column_name='image_url') THEN ALTER TABLE books DROP COLUMN image_url; END IF; END $$;`);
  await q(`CREATE TABLE IF NOT EXISTS purchases (id BIGSERIAL PRIMARY KEY,doc_no TEXT UNIQUE,doc_date DATE NOT NULL DEFAULT CURRENT_DATE,counterparty_id BIGINT REFERENCES counterparties(id) ON DELETE SET NULL,note TEXT DEFAULT '',total_sum BIGINT NOT NULL DEFAULT 0,created_at TIMESTAMP NOT NULL DEFAULT NOW())`);
  await q(`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS doc_no TEXT`); await q(`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS doc_date DATE NOT NULL DEFAULT CURRENT_DATE`); await q(`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS counterparty_id BIGINT`); await q(`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS note TEXT DEFAULT ''`); await q(`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS total_sum BIGINT NOT NULL DEFAULT 0`); await q(`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW()`);
  await q(`CREATE TABLE IF NOT EXISTS purchase_lines (id BIGSERIAL PRIMARY KEY,purchase_id BIGINT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,book_id BIGINT NOT NULL REFERENCES books(id) ON DELETE RESTRICT,qty INT NOT NULL DEFAULT 1,purchase_price BIGINT NOT NULL DEFAULT 0,markup_percent NUMERIC(10,2) NOT NULL DEFAULT 0,sale_price BIGINT NOT NULL DEFAULT 0,line_sum BIGINT NOT NULL DEFAULT 0)`);
  await q(`ALTER TABLE purchase_lines ADD COLUMN IF NOT EXISTS qty INT NOT NULL DEFAULT 1`); await q(`ALTER TABLE purchase_lines ADD COLUMN IF NOT EXISTS purchase_price BIGINT NOT NULL DEFAULT 0`); await q(`ALTER TABLE purchase_lines ADD COLUMN IF NOT EXISTS markup_percent NUMERIC(10,2) NOT NULL DEFAULT 0`); await q(`ALTER TABLE purchase_lines ADD COLUMN IF NOT EXISTS sale_price BIGINT NOT NULL DEFAULT 0`); await q(`ALTER TABLE purchase_lines ADD COLUMN IF NOT EXISTS line_sum BIGINT NOT NULL DEFAULT 0`);
  await q(`CREATE TABLE IF NOT EXISTS customer_orders (id BIGSERIAL PRIMARY KEY,book_id BIGINT NOT NULL REFERENCES books(id) ON DELETE RESTRICT,qty INT NOT NULL DEFAULT 1,customer_name TEXT DEFAULT '',phone TEXT NOT NULL,address_text TEXT DEFAULT '',latitude TEXT DEFAULT '',longitude TEXT DEFAULT '',location_url TEXT DEFAULT '',delivery_fee BIGINT NOT NULL DEFAULT 25000,subtotal BIGINT NOT NULL DEFAULT 0,total_sum BIGINT NOT NULL DEFAULT 0,status TEXT NOT NULL DEFAULT 'new',telegram_message_id BIGINT,telegram_chat_id TEXT DEFAULT '',created_at TIMESTAMP NOT NULL DEFAULT NOW())`);
  await q(`ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS latitude TEXT DEFAULT ''`); await q(`ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS longitude TEXT DEFAULT ''`); await q(`ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS location_url TEXT DEFAULT ''`); await q(`ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS telegram_message_id BIGINT`); await q(`ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT DEFAULT ''`);
  await q(`ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS batch_id TEXT DEFAULT ''`);
  await q(`ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS source_code TEXT DEFAULT ''`);
  await q(`ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT ''`);
  await q(`ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS source_name TEXT DEFAULT ''`);
  await q(`ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS customer_telegram TEXT DEFAULT ''`);
  await q(`ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS customer_telegram_username TEXT DEFAULT ''`);
  await q(`ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS payment_type TEXT NOT NULL DEFAULT 'cash'`);
  await q(`ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS payment_provider TEXT NOT NULL DEFAULT 'none'`);
  await q(`ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending'`);
  await q(`ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS payment_proof_image TEXT DEFAULT ''`);
  await q(`ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS distance_km NUMERIC(10,2) NOT NULL DEFAULT 0`);
  await q(`ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS receipt_sent BOOLEAN NOT NULL DEFAULT FALSE`);
  await q(`CREATE TABLE IF NOT EXISTS pending_feedback (chat_id TEXT PRIMARY KEY, order_id BIGINT NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT NOW())`);
  await q(`ALTER TABLE pending_feedback ADD COLUMN IF NOT EXISTS batch_id TEXT DEFAULT ''`);
  await q(`CREATE TABLE IF NOT EXISTS telegram_bindings (token TEXT PRIMARY KEY, chat_id TEXT NOT NULL, username TEXT DEFAULT '', created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW())`);
  await q(`CREATE TABLE IF NOT EXISTS categories (id BIGSERIAL PRIMARY KEY,name TEXT NOT NULL UNIQUE,created_at TIMESTAMP NOT NULL DEFAULT NOW())`);
  await q(`ALTER TABLE books ADD COLUMN IF NOT EXISTS category_id BIGINT REFERENCES categories(id)`);
  await q(`INSERT INTO categories(name) VALUES ('Kitob'),('Konstovar') ON CONFLICT (name) DO NOTHING`);
  await q(`CREATE TABLE IF NOT EXISTS cart_items (id BIGSERIAL PRIMARY KEY,session_id TEXT NOT NULL,book_id BIGINT NOT NULL REFERENCES books(id) ON DELETE CASCADE,qty INT NOT NULL DEFAULT 1,created_at TIMESTAMP NOT NULL DEFAULT NOW(),UNIQUE(session_id, book_id))`);
  await q(`CREATE INDEX IF NOT EXISTS idx_cart_items_session ON cart_items(session_id)`);
  await q(`CREATE TABLE IF NOT EXISTS source_refs (code TEXT PRIMARY KEY, type TEXT NOT NULL, name TEXT NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT NOW())`);
  await q(`DELETE FROM source_refs WHERE type IN ('school','college','center') OR code LIKE 'school_%' OR code LIKE 'college_%' OR code LIKE 'center_%'`);
  await q(`INSERT INTO source_refs(code, type, name)
           SELECT 'object_' || gs::text, 'object', 'Obekt ' || gs::text FROM generate_series(1,30) gs
           ON CONFLICT (code) DO UPDATE SET type=EXCLUDED.type, name=EXCLUDED.name`);
  await q(`CREATE TABLE IF NOT EXISTS counters (name TEXT PRIMARY KEY,last_value BIGINT NOT NULL DEFAULT 0)`);
  await q(`INSERT INTO counters(name,last_value) VALUES ('purchase',0) ON CONFLICT (name) DO NOTHING`);
  await q(`INSERT INTO counters(name,last_value) VALUES ('order',0) ON CONFLICT (name) DO NOTHING`);
}
async function nextPurchaseNo(client) { const counter = await client.query(`UPDATE counters SET last_value=last_value+1 WHERE name='purchase' RETURNING last_value`); return `PR-${String(Number(counter.rows[0].last_value)).padStart(6, "0")}`; }
async function nextOrderBatchId(client) {
  await client.query(`INSERT INTO counters(name,last_value) VALUES ('order',0) ON CONFLICT (name) DO NOTHING`);
  const counter = await client.query(`UPDATE counters SET last_value=last_value+1 WHERE name='order' RETURNING last_value`);
  const value = Number(counter.rows[0]?.last_value || 0);
  return value > 0 ? `Zakaz №${value}` : batchIdFallback();
}
function buildLocationUrl(lat, lng) { return (!lat || !lng) ? "" : `https://maps.google.com/?q=${encodeURIComponent(lat)},${encodeURIComponent(lng)}`; }
async function tg(method, payload) {
  if (!TELEGRAM_BOT_TOKEN) return null;
  try {
    const resp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload)});
    return await resp.json().catch(() => null);
  } catch (_e) {
    return null;
  }
}
function telegramOrderText(order) { return order.text || ""; }
async function sendOrderToGroup(order) { return await sendBatchToGroup(order); }
async function updateGroupOrderMessage(batch) {
  const summary = await getBatchSummary(batch);
  if (!summary) return;
  const first = summary.rows.find(x => x.telegram_message_id && x.telegram_chat_id);
  if (!first) return;
  const keyboard = { inline_keyboard: buildOrderActionButtons(summary.rows[0]) };
  await tg("editMessageText", { chat_id: first.telegram_chat_id, message_id: first.telegram_message_id, text: summary.text, reply_markup: keyboard, disable_web_page_preview: false });
}
async function sendReceiptNotifications(batch) {
  const r = await q(`SELECT id, batch_id, customer_name, customer_telegram, subtotal FROM customer_orders WHERE batch_id=$1 ORDER BY id`, [batch]);
  for (const order of r.rows) {
    const target = normalizeTelegramTarget(order.customer_telegram || "");
    if (!target) continue;
    const batchLabel = String(order.batch_id || '').trim() || `Zakaz #${order.id}`;
    const text = `🧾 Xarid cheki tayyor
${batchLabel}
Jami to'lov: ${money(order.subtotal)}

Talab va takliflar bo'lsa, pastdagi tugmani bosing.`;
    const sent = await tg("sendMessage", {
      chat_id: target,
      text,
      reply_markup: { inline_keyboard: [[{ text: "✍️ Talab va taklif yuborish", callback_data: `feedback:${order.id}` }]] }
    });
    if (sent && sent.ok) {
      await q(`UPDATE customer_orders SET receipt_sent=TRUE WHERE id=$1`, [order.id]);
    }
  }
}
async function sendAcceptedMessage(target) {
  const chatId = normalizeTelegramTarget(target || "");
  if (!chatId) return null;
  return await tg("sendMessage", {
    chat_id: chatId,
    text: `📦 Buyurtmangiz qabul qilindi!

Hurmatli mijoz, buyurtmangiz tizimga qabul qilindi.
Tez orada siz bilan bog'lanamiz.

Rahmat 🙏`
  });
}


app.post("/delivery/calc", async (req, res) => {
  try {
    const location = resolveLocation(req.body.latitude, req.body.longitude, req.body.location_url, req.body.address_text);
    if (!location.lat || !location.lng) return res.status(400).json({ ok: false, message: "Lokatsiya topilmadi" });
    const calc = calculateDeliveryFromLocation(location.lat, location.lng);
    return res.json({ ok: true, distance_km: calc.distanceKm, delivery_fee: calc.deliveryFee, location_url: location.locationUrl });
  } catch (e) {
    return res.status(500).json({ ok: false, message: e.message || "Xatolik" });
  }
});

app.get("/telegram/status/:orderId/:status/:sig", async (req, res) => {
  try {
    const orderId = Number(req.params.orderId);
    const status = String(req.params.status || "");
    const sig = String(req.params.sig || "");
    if (!orderId || !["delivered", "returned"].includes(status)) return res.status(400).send("Noto'g'ri so'rov");
    if (sig !== statusActionSig(orderId, status)) return res.status(403).send("Ruxsat yo'q");
    const r = await q(`SELECT batch_id FROM customer_orders WHERE id=$1`, [orderId]);
    const batch = String(r.rows[0]?.batch_id || "");
    if (!batch) return res.status(404).send("Topilmadi");
    await q(`UPDATE customer_orders SET status=$1 WHERE batch_id=$2`, [status, batch]);
    if (status === "delivered") {
      await q(`UPDATE customer_orders SET receipt_sent=TRUE WHERE batch_id=$1`, [batch]);
      await sendReceiptNotifications(batch);
    }
    await updateGroupOrderMessage(batch);
    res.send(`<html><body style="font-family:Arial;padding:24px"><h2>✅ Holat yangilandi: ${esc(statusLabel(status))}</h2><p>Telegramga qaytishingiz mumkin.</p></body></html>`);
  } catch (_e) {
    res.status(500).send("Xatolik");
  }
});
app.post("/telegram/webhook", async (req, res) => {
  try {
    const update = req.body || {};
    if (update.callback_query && update.callback_query.data) {
      const data = String(update.callback_query.data);
      try { await tg("answerCallbackQuery", { callback_query_id: update.callback_query.id, text: "So'rov qabul qilindi ✅" }); } catch (_e) {}
      const mOrder = data.match(/^o:(\d+):(d|r)$/);
      const m2 = data.match(/^b2:([^:]+):(d|r)$/);
      const mLegacy = data.match(/^batch:(.+):(delivered|returned)$/);
      const mPay = data.match(/^pay:(\d+):(cash|online)$/);
      if (mOrder || m2 || mLegacy || mPay) {
        let batch = "";
        let status = "";
        if (mPay) {
          const orderId = Number(mPay[1]);
          const payKind = mPay[2];
          const row = await q(`SELECT batch_id FROM customer_orders WHERE id=$1`, [orderId]);
          batch = String(row.rows[0]?.batch_id || "");
          if (!batch) return res.json({ ok:true });
          await q(`UPDATE customer_orders SET payment_status=$1 WHERE batch_id=$2`, [payKind === "online" ? "paid" : "confirmed", batch]);
          await updateGroupOrderMessage(batch);
        } else {
          if (mOrder) {
            status = mOrder[2] === "d" ? "delivered" : "returned";
            const row = await q(`SELECT batch_id FROM customer_orders WHERE id=$1`, [Number(mOrder[1])]);
            batch = String(row.rows[0]?.batch_id || "");
          } else if (m2) {
            batch = decodeBatchToken(m2[1]);
            status = m2[2] === "d" ? "delivered" : "returned";
          } else {
            batch = mLegacy[1];
            status = mLegacy[2];
          }
          if (!batch) return res.json({ ok:true });
          await q(`UPDATE customer_orders SET status=$1 WHERE batch_id=$2`, [status, batch]);
          if (status === "delivered") {
            await q(`UPDATE customer_orders SET receipt_sent=TRUE WHERE batch_id=$1`, [batch]);
            await sendReceiptNotifications(batch);
          }
          await updateGroupOrderMessage(batch);
        }
      } else {
        const fb = data.match(/^feedback:(\d+)$/);
        if (fb) {
          const orderId = Number(fb[1]);
          const chatId = String(update.callback_query.from?.id || "");
          if (chatId) {
            const orderRow = await q(`SELECT batch_id FROM customer_orders WHERE id=$1`, [orderId]);
            const batchId = String(orderRow.rows[0]?.batch_id || '').trim();
            await q(`INSERT INTO pending_feedback(chat_id, order_id, batch_id) VALUES ($1,$2,$3) ON CONFLICT (chat_id) DO UPDATE SET order_id=EXCLUDED.order_id, batch_id=EXCLUDED.batch_id, created_at=NOW()`, [chatId, orderId, batchId]);
            await tg("sendMessage", { chat_id: chatId, text: "Iltimos, taklif yoki shikoyatingizni bitta xabar qilib yozing. Biz uni guruhga yuboramiz." });
          }
        }
      }
    }
    if (update.message && update.message.text && update.message.chat && update.message.chat.type === "private") {
      const chatId = String(update.message.chat.id);
      const txt = String(update.message.text || "").trim();
      const username = String(update.message.from?.username ? `@${update.message.from.username}` : "");
      const startVerifyMatch = txt.match(/^\/start\s+verify_([a-f0-9]{24})$/i);
      const startSourceMatch = txt.match(/^\/start\s+([A-Za-z0-9_-]{1,64})$/i);
      if (startVerifyMatch) {
        const token = startVerifyMatch[1];
        await q(`INSERT INTO telegram_bindings(token, chat_id, username) VALUES ($1,$2,$3)
                 ON CONFLICT (token) DO UPDATE SET chat_id=EXCLUDED.chat_id, username=EXCLUDED.username, updated_at=NOW()`,
        [token, chatId, username]);
        await tg("sendMessage", { chat_id: chatId, text: "✅ Shaxsingiz tasdiqlandi. Endi buyurtma berishingiz mumkin." });
      } else if (txt === "/start" || startSourceMatch) {
        const rawSource = startSourceMatch ? startSourceMatch[1] : "";
        const meta = sourceMeta(rawSource);
        const caption = "Assalomu alaykum! Pastdagi tugma orqali kirib buyurtma bering.";
        await tg("sendMessage", { chat_id: chatId, text: caption, reply_markup: { inline_keyboard: [[openWebAppButton(meta.code)]] } });
      }
      const pending = await q(`SELECT order_id, batch_id FROM pending_feedback WHERE chat_id=$1`, [chatId]);
      if (pending.rows.length) {
        const orderId = pending.rows[0].order_id;
        const batchLabel = String(pending.rows[0].batch_id || '').trim() || `Zakaz #${orderId}`;
        const text = txt;
        if (text) {
          await tg("sendMessage", { chat_id: TELEGRAM_GROUP_CHAT_ID, text: `💬 Mijoz fikri (${batchLabel}):\n${text}` });
        }
        await q(`DELETE FROM pending_feedback WHERE chat_id=$1`, [chatId]);
        await tg("sendMessage", { chat_id: chatId, text: "Rahmat! Fikringiz qabul qilindi ✅" });
      }
    }
    res.json({ ok:true });
  } catch (e) { console.error(e); res.json({ ok:true }); }
});
app.get("/telegram/bind/status", async (req, res) => {
  try {
    const token = String(req.query.token || req.signedCookies.tg_bind_token || "").trim();
    if (!token) return res.json({ ok: true, verified: false });
    const r = await q(`SELECT chat_id FROM telegram_bindings WHERE token=$1`, [token]);
    return res.json({ ok: true, verified: Boolean(r.rows.length), chat_id: String(r.rows[0]?.chat_id || "") });
  } catch (_e) {
    return res.json({ ok: true, verified: false });
  }
});
app.post("/telegram/webapp-auth", async (req, res) => {
  try {
    const token = String(req.body.bindToken || req.signedCookies.tg_bind_token || "").trim() || ensureBindToken(req, res);
    const initData = String(req.body.initData || "").trim();
    const telegramId = String(req.body.id || "").trim();
    const username = String(req.body.username || "").trim();
    if (!token || !telegramId) return res.status(400).json({ ok: false, message: "Ma'lumot yetarli emas" });
    if (initData && !verifyTelegramInitData(initData)) return res.status(403).json({ ok: false, message: "Telegram ma'lumotlari tasdiqlanmadi" });
    await q(`INSERT INTO telegram_bindings(token, chat_id, username)
             VALUES ($1,$2,$3)
             ON CONFLICT (token) DO UPDATE SET chat_id=EXCLUDED.chat_id, username=EXCLUDED.username, updated_at=NOW()`,
      [token, telegramId, username]);
    return res.json({ ok: true, verified: true, chat_id: telegramId, username });
  } catch (e) {
    return res.status(500).json({ ok: false, message: e.message || "Xatolik" });
  }
});
app.get("/", async (req, res, next) => { try {
  const sourceCode = getSourceCode(req);
  if (sourceCode) {
    const meta = sourceMeta(sourceCode);
    res.cookie("source_code", meta.code, { httpOnly: true, sameSite: "lax", secure: isSecureRequest(req), maxAge: 1000 * 60 * 60 * 24 * 30 });
  }
  const bindToken = ensureBindToken(req, res);
  cartSessionId(req, res);
  const search = String(req.query.search || "").trim();
  const categoryFilter = String(req.query.category_id || "").trim();
  let selectedCategoryId = 0;
  if (categoryFilter) {
    const selectedCategory = await q(`SELECT id FROM categories WHERE id::text=$1 OR name=$1 LIMIT 1`, [categoryFilter]);
    selectedCategoryId = Number(selectedCategory.rows[0]?.id || 0);
  }
  const params = [];
  let where = `WHERE b.active = TRUE AND b.stock_qty > 0`;
  if (search) { params.push(`%${search}%`); where += ` AND (b.title ILIKE $${params.length} OR b.author ILIKE $${params.length})`; }
  if (selectedCategoryId) { params.push(selectedCategoryId); where += ` AND b.category_id = $${params.length}`; }
  const books = await q(`SELECT b.*, c.name AS category_name FROM books b LEFT JOIN categories c ON c.id=b.category_id ${where} ORDER BY b.id DESC`, params);
  const categories = await q(`SELECT * FROM categories ORDER BY name`);
  const count = await cartCount(req);
  const catOptions = categories.rows.map(c => `<option value="${c.id}" ${selectedCategoryId===Number(c.id) || categoryFilter===String(c.name) ? 'selected' : ''}>${esc(c.name)}</option>`).join("");
  const cards = books.rows.map((b) => `<div class="card" data-category-id="${Number(b.category_id || 0)}">
      <div class="book-image">${b.image ? `<img src="${esc(b.image)}" alt="${esc(b.title)}" />` : "📚"}</div>
      <div class="title">${esc(b.title)}</div>
      <div class="muted">${esc(b.author || "")}</div>
      <div class="small">${esc(b.category_name || "Kategoriya yo'q")}</div>
      <div class="price">${money(b.sale_price)}</div>
      <div class="stock ok">Omborda: ${b.stock_qty} dona</div>
      <div class="actions" style="margin-top:12px">
        <form method="post" action="/cart/add/${b.id}" style="display:inline"><button class="btn soft" type="submit">Savatcha</button></form>
        <a class="btn green" href="/order/${b.id}">Buyurtma berish</a>
      </div>
    </div>`).join("") || `<div class="panel">Qidiruv bo'yicha mahsulot topilmadi</div>`;
  res.send(page("Kitob Market", `<div class="hero"><h1>Kitoblar do'koni</h1><p>Sevimli kitoblaringizni tanlang — narxi va buyurtma qulay tarzda bir joyda</p><form class="searchbar" method="get" action="/" style="margin-top:12px" id="catalogFilterForm"><input type="hidden" name="source" value="${esc(sourceCode || req.cookies.source_code || "")}" /><input type="text" name="search" value="${esc(search)}" placeholder="Kitob nomi yoki muallif bo'yicha qidiring" /><select name="category_id" id="categorySelect"><option value="">Barcha kategoriya</option>${catOptions}</select><button type="submit">Poisk</button><a class="btn soft" href="/cart">Savatcha (${count})</a></form></div><h2 style="margin-top:18px">Mavjud kitoblar</h2><div class="cards">${cards}</div><script>(function(){const form=document.getElementById('catalogFilterForm');const category=document.getElementById('categorySelect');if(!form||!category)return;category.addEventListener('change',function(){form.submit();});})();</script>${telegramAutoBindScript(bindToken, sourceCode || req.cookies.source_code || "")}`, { admin:isAdmin(req) }));
} catch (e) { next(e); } });
app.get("/verify", async (req, res) => {
  const source = String(req.query.source || req.cookies.source_code || "").trim();
  const bindToken = ensureBindToken(req, res);
  const verifyUrl = TELEGRAM_BOT_USERNAME ? `https://t.me/${TELEGRAM_BOT_USERNAME}?start=verify_${bindToken}` : "#";
  res.send(page("Shaxsni tasdiqlash", `<div class="panel" style="max-width:740px;margin:0 auto"><h2>1-qadam: shaxsingizni tasdiqlang</h2><p>Agar sahifa Telegram ichida ochilgan bo'lsa, tasdiqlash avtomatik bo'ladi. Aks holda quyidagi tugma orqali bir marta tasdiqlang.</p><div class="actions"><a class="btn green" id="verifyBtn" target="_blank" href="${esc(verifyUrl)}">Shaxsingizni tasdiqlash</a><span class="tag" id="verifyStatus" style="display:none">✅ Tasdiqlandi</span><a class="btn soft" href="/?source=${esc(source)}&verified=1">Tasdiqlandi, saytga o'tish</a></div><script>setInterval(async()=>{try{const r=await fetch('/telegram/bind/status?token=${esc(bindToken)}');const j=await r.json();if(j&&j.verified){location.href='/?source=${esc(source)}&verified=1';}}catch(_e){}},2500);</script>${telegramAutoBindScript(bindToken, source)}</div>`, { admin:isAdmin(req) }));
});

app.get("/order/:id", async (req, res, next) => { try {
  const r = await q(`SELECT * FROM books WHERE id=$1 AND active=TRUE AND stock_qty > 0`, [Number(req.params.id)]);
  if (!r.rows.length) return res.status(404).send("Topilmadi");
  const b = r.rows[0];
  const sourceCode = getSourceCode(req) || String(req.cookies.source_code || "");
  const count = await cartCount(req);
  const bindToken = ensureBindToken(req, res);
  res.send(page("Buyurtma", `<div class="panel" style="max-width:780px;margin:0 auto"><div class="actions" style="margin-bottom:10px"><a class="btn dark" href="/">← Ortga</a><a class="btn soft" href="/cart">Savatcha (${count})</a></div><div class="card" style="margin-bottom:12px"><div class="grid2"><div class="book-image" style="height:300px">${b.image ? `<img src="${esc(b.image)}" alt="${esc(b.title)}" />` : "📚"}</div><div><div class="title" style="margin-top:0">${esc(b.title)}</div><div class="muted">${esc(b.author || "")}</div><div class="price">${money(b.sale_price)}</div><div class="stock ok">Mavjud: ${b.stock_qty} dona</div></div></div></div><form class="form" method="post" action="/order/${b.id}" enctype="multipart/form-data"><input type="hidden" name="source_code" value="${esc(sourceCode)}" /><input type="hidden" name="telegram_bind_token" value="${esc(bindToken)}" /><input type="hidden" name="delivery_fee" id="deliveryFeeField" value="${DELIVERY_FEE}" /><input type="hidden" name="distance_km" id="distanceKmField" value="0" /><div class="grid2"><input name="customer_name" placeholder="Ismingiz" /><input name="phone" placeholder="Telefon raqam" required /></div><div class="grid2"><input type="number" name="qty" min="1" max="${b.stock_qty}" value="1" id="qtyInput" required /><button type="button" class="btn soft" id="locBtn" onclick="getLocation()">📍 Lokatsiyani yuborish</button></div><input type="hidden" name="latitude" id="latField" /><input type="hidden" name="longitude" id="lngField" /><input type="hidden" name="location_url" id="locationUrlField" /><textarea name="address_text" id="addressText" placeholder="Manzil yoki lokatsiya havolasi"></textarea><div class="small" id="locText">Lokatsiya hali tanlanmadi</div><div class="panel" style="padding:14px"><div class="label">To'lov turi</div><div class="actions"><label><input type="radio" name="payment_type" value="cash" checked /> Naqd</label><label><input type="radio" name="payment_type" value="online" /> Online</label></div><div id="onlinePaymentWrap" style="display:none;margin-top:10px"><div class="grid2"><select name="payment_provider" id="paymentProvider"><option value="payme">Payme</option><option value="click">Click</option></select><input type="file" name="payment_proof" accept="image/*" id="paymentProofInput" /></div><div style="margin-top:10px"><a id="paymentLinkBtn" class="btn" target="_blank" rel="noopener" style="display:none">QR dagi to'lov sahifasini ochish</a></div><div class="small" style="margin-top:8px">Online to'lovni shu tugma orqali qilsangiz bo'ladi, чек skrinshoti ixtiyoriy.</div></div></div><div class="order-summary"><div>1 dona narx: <b>${money(b.sale_price)}</b></div><div>Masofa: <b id="distanceText">Aniqlanmagan</b></div><div>Dostavka: <b id="deliveryText">Lokatsiyani yuboring</b></div><div style="margin-top:8px">Jami: <b id="totalText">${money(Number(b.sale_price))}</b></div></div><div class="actions"><button type="submit" class="btn green">Zakaz yuborish</button><button type="submit" formmethod="post" formaction="/cart/add/${b.id}" class="btn soft">Savatchaga qo'shish</button></div></form></div><script>
const unitPrice=${Number(b.sale_price)};
let currentDeliveryFee=0;
const qtyInput=document.getElementById('qtyInput');
const totalText=document.getElementById('totalText');
const deliveryText=document.getElementById('deliveryText');
const distanceText=document.getElementById('distanceText');
const deliveryFeeField=document.getElementById('deliveryFeeField');
const distanceKmField=document.getElementById('distanceKmField');
const latField=document.getElementById('latField');
const lngField=document.getElementById('lngField');
const locationUrlField=document.getElementById('locationUrlField');
const addressText=document.getElementById('addressText');
const locText=document.getElementById('locText');
const locBtn=document.getElementById('locBtn');
const paymentRadios=document.querySelectorAll('input[name="payment_type"]');
const onlinePaymentWrap=document.getElementById('onlinePaymentWrap');
const paymentProvider=document.getElementById('paymentProvider');
const paymentLinkBtn=document.getElementById('paymentLinkBtn');
const paymentProofInput=document.getElementById('paymentProofInput');
const paymentLinks={payme:${JSON.stringify(esc(paymentProviderLink("payme")))},click:${JSON.stringify(esc(paymentProviderLink("click")))}};
function formatMoney(v){return new Intl.NumberFormat('ru-RU').format(Number(v||0))+" so'm";}
function updateTotal(){const qty=Number(qtyInput.value||1); totalText.textContent=formatMoney((qty*unitPrice)+currentDeliveryFee);}
qtyInput.addEventListener('input',updateTotal);
function updatePaymentUI(){const t=(document.querySelector('input[name="payment_type"]:checked')||{}).value||'cash'; const online=t==='online'; onlinePaymentWrap.style.display=online?'block':'none'; if(paymentProofInput){ paymentProofInput.required=false; } const provider=(paymentProvider&&paymentProvider.value)||'payme'; const link=paymentLinks[provider]||''; if(paymentLinkBtn){ paymentLinkBtn.style.display=online&&link?'inline-flex':'none'; paymentLinkBtn.href=link||'#'; }}
paymentRadios.forEach(x=>x.addEventListener('change',updatePaymentUI)); if(paymentProvider){paymentProvider.addEventListener('change',updatePaymentUI);} updatePaymentUI();
async function recalcDelivery(){ try { const r=await fetch('/delivery/calc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({latitude:latField.value,longitude:lngField.value,location_url:locationUrlField.value,address_text:addressText.value})}); const j=await r.json(); if(j&&j.ok){ currentDeliveryFee=Number(j.delivery_fee||0); deliveryFeeField.value=currentDeliveryFee; distanceKmField.value=Number(j.distance_km||0); deliveryText.textContent=formatMoney(currentDeliveryFee); distanceText.textContent=(Number(j.distance_km||0)).toFixed(1)+' km'; if(j.location_url){locationUrlField.value=j.location_url;} updateTotal(); } } catch(_e){} }
function applyLocation(lat,lng,label){latField.value=lat; lngField.value=lng; locationUrlField.value='https://maps.google.com/?q='+lat+','+lng; locText.textContent=label||('✅ Lokatsiya olindi: '+Number(lat).toFixed(5)+', '+Number(lng).toFixed(5)); locBtn.textContent='✅ Tayyor'; recalcDelivery();}
function requestLocation(options,onError){navigator.geolocation.getCurrentPosition(function(pos){applyLocation(pos.coords.latitude,pos.coords.longitude);},onError,options);}
function getLocation(){if(!navigator.geolocation){locText.textContent="Geolokatsiya yo'q. Telefon lokatsiya ruxsatini yoqing yoki manzilga aniq Google Maps link yozing";return;} locBtn.disabled=true; locBtn.textContent='⏳ Lokatsiya olinmoqda...'; requestLocation({enableHighAccuracy:true,timeout:30000,maximumAge:0},function(err){locBtn.disabled=false; locBtn.textContent='📍 Lokatsiyani yuborish'; const reason=err&&err.message?err.message:'Ruxsat berilmagan'; locText.textContent='❌ Aniq lokatsiya olinmadi ('+reason+'). Iltimos telefon lokatsiyasiga ruxsat bering yoki manzilga aniq Google Maps link kiriting.';});}
addressText.addEventListener('change',recalcDelivery);
updateTotal();
</script>`, { admin:isAdmin(req) }));
} catch (e) { next(e); } });

app.post("/order/:id", upload.single("payment_proof"), async (req, res, next) => { const client = await pool.connect(); try {
  const id=Number(req.params.id);
  const qty=Math.max(1, Number(req.body.qty||1));
  const paymentType = normalizePaymentType(req.body.payment_type);
  const paymentProvider = normalizePaymentProvider(req.body.payment_provider, paymentType);
  await client.query("BEGIN");
  const r=await client.query(`SELECT * FROM books WHERE id=$1 AND active=TRUE FOR UPDATE`, [id]); if (!r.rows.length) throw new Error("Kitob topilmadi");
  const b=r.rows[0]; if (b.stock_qty<qty) throw new Error("Omborda yetarli mahsulot yo'q");
  const location = resolveLocation(req.body.latitude, req.body.longitude, req.body.location_url, req.body.address_text);
  if (!location.lat || !location.lng) throw new Error("Avval lokatsiyani aniqlang");
  const calc = calculateDeliveryFromLocation(location.lat, location.lng);
  const deliveryFee = Number(calc.deliveryFee || 0);
  const distanceKm = Number(calc.distanceKm || 0);
  const subtotal=Number(b.sale_price)*qty; const total=subtotal+deliveryFee;
  const meta = sourceMeta(req.body.source_code || req.cookies.source_code || "");
  const batch = await nextOrderBatchId(client);
  const bindToken = String(req.body.telegram_bind_token || req.signedCookies.tg_bind_token || "");
  const bind = bindToken ? await client.query(`SELECT chat_id, username FROM telegram_bindings WHERE token=$1`, [bindToken]) : { rows: [] };
  const customerTelegram = String(bind.rows[0]?.chat_id || "");
  const customerTelegramUsername = String(bind.rows[0]?.username || "");
  let paymentProofImage = "";
  if (paymentType === "online") {
    if (req.file) paymentProofImage = await saveImage(req.file);
  }
  await client.query(`INSERT INTO customer_orders(book_id, qty, customer_name, phone, address_text, latitude, longitude, location_url, delivery_fee, subtotal, total_sum, batch_id, source_code, source_type, source_name, customer_telegram, customer_telegram_username, payment_type, payment_provider, payment_status, payment_proof_image, distance_km) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`, [id, qty, String(req.body.customer_name||""), String(req.body.phone||""), String(req.body.address_text||""), location.lat, location.lng, location.locationUrl, deliveryFee, subtotal, total, batch, meta.code, meta.type, meta.name, customerTelegram, customerTelegramUsername, paymentType, paymentProvider, 'pending', paymentProofImage, distanceKm]);
  await client.query(`UPDATE books SET stock_qty = stock_qty - $1, updated_at=NOW() WHERE id=$2`, [qty, id]);
  await client.query("COMMIT");
  const summary = await getBatchSummary(batch);
  const tgResult=summary ? await sendOrderToGroup(summary) : null;
  if (tgResult && tgResult.ok && tgResult.result) { await q(`UPDATE customer_orders SET telegram_message_id=$1, telegram_chat_id=$2 WHERE batch_id=$3`, [tgResult.result.message_id, String(tgResult.result.chat.id), batch]); }
  await sendAcceptedMessage(customerTelegram);
  const onlinePayLink = paymentType === "online" ? buildPaymentCheckoutLink(paymentProvider, total, batch) : "";
  res.send(page("Buyurtma qabul qilindi", `<div class="panel" style="max-width:720px;margin:0 auto"><div class="alert ok">Buyurtmangiz qabul qilindi</div><h2>${esc(b.title)}</h2><div class="grid2"><div>Kitoblar summasi</div><div class="right">${money(subtotal)}</div></div><div class="grid2"><div>Dostavka</div><div class="right">${money(deliveryFee)}</div></div><div class="grid2"><div>Masofa</div><div class="right">${distanceKm.toFixed(1)} km</div></div><div class="grid2"><div>Jami</div><div class="right"><b>${money(total)}</b></div></div><div class="grid2"><div>To'lov turi</div><div class="right">${esc(paymentTypeLabel(paymentType))}${paymentType === 'online' ? ' / ' + esc(paymentProviderLabel(paymentProvider)) : ''}</div></div>${onlinePayLink ? `<div class="actions" style="margin-top:12px"><a class="btn green" target="_blank" rel="noopener" href="${esc(onlinePayLink)}">QR dagi to'lov sahifasini ochish</a></div><div class="small">Bitta telefon bilan ham shu tugma orqali to'lov qilishingiz mumkin.</div>` : ""}<div class="actions" style="margin-top:12px"><a class="btn" href="/">Bosh sahifa</a><a class="btn soft" href="/cart">Savatcha</a></div></div>`, { admin:isAdmin(req) }));
} catch (e) { await client.query("ROLLBACK"); next(e); } finally { client.release(); } });

app.post("/cart/add/:id", async (req, res, next) => { try {
  const sid = cartSessionId(req, res);
  const bookId = Number(req.params.id);
  const requestedQty = Math.max(1, Number(req.body.qty || 1));
  const book = await q(`SELECT id, stock_qty FROM books WHERE id=$1 AND active=TRUE`, [bookId]);
  if (!book.rows.length) throw new Error("Mahsulot topilmadi");
  const availableQty = Number(book.rows[0].stock_qty || 0);
  if (availableQty <= 0) throw new Error("Mahsulot omborda qolmagan");
  const qty = Math.min(requestedQty, availableQty);
  await q(`INSERT INTO cart_items(session_id, book_id, qty) VALUES ($1,$2,$3)
           ON CONFLICT(session_id, book_id) DO UPDATE SET qty = LEAST(cart_items.qty + EXCLUDED.qty, (SELECT stock_qty FROM books WHERE id=$2))`, [sid, bookId, qty]);
  if ((req.headers.referer || "").includes(`/order/${bookId}`)) return res.redirect("/cart");
  res.redirect("back");
} catch (e) { next(e); } });

app.get("/cart", async (req, res, next) => { try {
  cartSessionId(req, res);
  const items = await getCartItems(req);
  const sourceCode = String(req.cookies.source_code || "");
  const subtotal = items.reduce((a, x) => a + Number(x.sale_price || 0) * Number(x.qty || 0), 0);
  const total = subtotal;
  const body = items.length ? items.map(cartItemHtml).join("") : `<div class="panel">Savatcha bo'sh</div>`;
  const bindToken = ensureBindToken(req, res);
  res.send(page("Savatcha", `<div class="panel" style="max-width:900px;margin:0 auto"><div class="actions" style="margin-bottom:12px"><a class="btn dark" href="/">← Davom etish</a></div><h2>Savatcha</h2>${body}${items.length ? `<form class="form" method="post" action="/checkout" style="margin-top:16px" enctype="multipart/form-data"><input type="hidden" name="source_code" value="${esc(sourceCode)}" /><input type="hidden" name="telegram_bind_token" value="${esc(bindToken)}" /><input type="hidden" name="delivery_fee" id="cartDeliveryFeeField" value="${DELIVERY_FEE}" /><input type="hidden" name="distance_km" id="cartDistanceKmField" value="0" /><div class="grid2"><input name="customer_name" placeholder="Ismingiz" /><input name="phone" placeholder="Telefon raqam" required /></div><div class="grid2"><button type="button" class="btn soft" id="cartLocBtn" onclick="getCartLocation()">📍 Lokatsiyani yuborish</button><div class="small" id="cartLocText">Lokatsiya hali tanlanmadi</div></div><input type="hidden" name="latitude" id="cartLatField" /><input type="hidden" name="longitude" id="cartLngField" /><input type="hidden" name="location_url" id="cartLocationUrlField" /><textarea name="address_text" id="cartAddressText" placeholder="Manzil yoki lokatsiya havolasi"></textarea><div class="panel" style="padding:14px"><div class="label">To'lov turi</div><div class="actions"><label><input type="radio" name="payment_type" value="cash" checked /> Naqd</label><label><input type="radio" name="payment_type" value="online" /> Online</label></div><div id="cartOnlinePaymentWrap" style="display:none;margin-top:10px"><div class="grid2"><select name="payment_provider" id="cartPaymentProvider"><option value="payme">Payme</option><option value="click">Click</option></select><input type="file" name="payment_proof" accept="image/*" id="cartPaymentProofInput" /></div><div style="margin-top:10px"><a id="cartPaymentLinkBtn" class="btn" target="_blank" rel="noopener" style="display:none">QR dagi to'lov sahifasini ochish</a></div><div class="small" style="margin-top:8px">Online to'lovni shu tugma orqali qilsangiz bo'ladi, чек skrinshoti ixtiyoriy.</div></div></div><div class="order-summary"><div>Mahsulotlar: <b>${money(subtotal)}</b></div><div>Masofa: <b id="cartDistanceText">Aniqlanmagan</b></div><div>Dostavka: <b id="cartDeliveryText">Lokatsiyani yuboring</b></div><div style="margin-top:8px">Jami: <b id="cartTotalText">${money(total)}</b></div></div><button class="btn green" type="submit">Bitta zakaz qilish</button></form><script>
const cartSubtotal=${subtotal};
let cartDeliveryFee=0;
const cartTotalText=document.getElementById('cartTotalText');
const cartDeliveryText=document.getElementById('cartDeliveryText');
const cartDistanceText=document.getElementById('cartDistanceText');
const cartDeliveryFeeField=document.getElementById('cartDeliveryFeeField');
const cartDistanceKmField=document.getElementById('cartDistanceKmField');
const cartLatField=document.getElementById('cartLatField');
const cartLngField=document.getElementById('cartLngField');
const cartLocationUrlField=document.getElementById('cartLocationUrlField');
const cartAddressText=document.getElementById('cartAddressText');
function formatMoney(v){return new Intl.NumberFormat('ru-RU').format(Number(v||0))+" so'm";}
function updateCartTotal(){cartTotalText.textContent=formatMoney(cartSubtotal + cartDeliveryFee);}
const cartPaymentProvider=document.getElementById('cartPaymentProvider');
const cartPaymentLinkBtn=document.getElementById('cartPaymentLinkBtn');
const cartPaymentLinks={payme:${JSON.stringify(esc(paymentProviderLink("payme")))},click:${JSON.stringify(esc(paymentProviderLink("click")))}};
function setCartPaymentUI(){const t=(document.querySelector('input[name="payment_type"]:checked')||{}).value||'cash'; const online=t==='online'; document.getElementById('cartOnlinePaymentWrap').style.display=online?'block':'none'; const file=document.getElementById('cartPaymentProofInput'); if(file){file.required=false;} const provider=(cartPaymentProvider&&cartPaymentProvider.value)||'payme'; const link=cartPaymentLinks[provider]||''; if(cartPaymentLinkBtn){cartPaymentLinkBtn.style.display=online&&link?'inline-flex':'none'; cartPaymentLinkBtn.href=link||'#';}}
document.querySelectorAll('input[name="payment_type"]').forEach(x=>x.addEventListener('change',setCartPaymentUI)); if(cartPaymentProvider){cartPaymentProvider.addEventListener('change',setCartPaymentUI);} setCartPaymentUI();
async function recalcCartDelivery(){ try { const r=await fetch('/delivery/calc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({latitude:cartLatField.value,longitude:cartLngField.value,location_url:cartLocationUrlField.value,address_text:cartAddressText.value})}); const j=await r.json(); if(j&&j.ok){ cartDeliveryFee=Number(j.delivery_fee||0); cartDeliveryFeeField.value=cartDeliveryFee; cartDistanceKmField.value=Number(j.distance_km||0); cartDeliveryText.textContent=formatMoney(cartDeliveryFee); cartDistanceText.textContent=(Number(j.distance_km||0)).toFixed(1)+' km'; if(j.location_url){cartLocationUrlField.value=j.location_url;} updateCartTotal(); } } catch(_e){} }
function setCartLocation(lat,lng,label){cartLatField.value=lat;cartLngField.value=lng;cartLocationUrlField.value='https://maps.google.com/?q='+lat+','+lng;document.getElementById('cartLocText').textContent=label||'✅ Lokatsiya olindi';document.getElementById('cartLocBtn').textContent='✅ Tayyor';recalcCartDelivery();}
function getCartLocation(){const btn=document.getElementById('cartLocBtn');const text=document.getElementById('cartLocText');if(!navigator.geolocation){text.textContent="Geolokatsiya yo'q. Telefon lokatsiya ruxsatini yoqing yoki manzilga aniq Google Maps link yozing";return;}btn.disabled=true;btn.textContent='⏳ Lokatsiya olinmoqda...';navigator.geolocation.getCurrentPosition(function(pos){setCartLocation(pos.coords.latitude,pos.coords.longitude);},function(err){btn.disabled=false;btn.textContent='📍 Lokatsiyani yuborish';const reason=err&&err.message?err.message:'Ruxsat berilmagan';text.textContent='❌ Aniq lokatsiya olinmadi ('+reason+'). Iltimos lokatsiyaga ruxsat bering yoki manzilga aniq Google Maps link kiriting.';},{enableHighAccuracy:true,timeout:30000,maximumAge:0});}
cartAddressText.addEventListener('change',recalcCartDelivery); updateCartTotal();
</script>` : ""}</div>`, { admin:isAdmin(req) }));
} catch (e) { next(e); } });

app.post("/cart/update/:id", async (req, res, next) => { try {
  const sid = cartSessionId(req, res);
  const bookId = Number(req.params.id);
  const requestedQty = Math.max(1, Number(req.body.qty || 1));
  const book = await q(`SELECT stock_qty FROM books WHERE id=$1 AND active=TRUE`, [bookId]);
  if (!book.rows.length || Number(book.rows[0].stock_qty || 0) <= 0) {
    await q(`DELETE FROM cart_items WHERE session_id=$1 AND book_id=$2`, [sid, bookId]);
    return res.redirect("/cart");
  }
  const qty = Math.min(requestedQty, Number(book.rows[0].stock_qty || 0));
  await q(`UPDATE cart_items SET qty=$1 WHERE session_id=$2 AND book_id=$3`, [qty, sid, bookId]);
  res.redirect("/cart");
} catch (e) { next(e); } });

app.post("/cart/remove/:id", async (req, res, next) => { try {
  const sid = cartSessionId(req, res);
  await q(`DELETE FROM cart_items WHERE session_id=$1 AND book_id=$2`, [sid, Number(req.params.id)]);
  res.redirect("/cart");
} catch (e) { next(e); } });

app.post("/checkout", upload.single("payment_proof"), async (req, res, next) => { const client = await pool.connect(); try {
  const sid = String(req.signedCookies.cart_sid || ""); if (!sid) throw new Error("Savatcha topilmadi");
  const items = await client.query(`SELECT c.book_id, c.qty, b.title, b.sale_price, b.stock_qty FROM cart_items c JOIN books b ON b.id=c.book_id WHERE c.session_id=$1 AND b.active=TRUE ORDER BY c.id`, [sid]);
  if (!items.rows.length) throw new Error("Savatcha bo'sh");
  const paymentType = normalizePaymentType(req.body.payment_type);
  const paymentProvider = normalizePaymentProvider(req.body.payment_provider, paymentType);
  const location = resolveLocation(req.body.latitude, req.body.longitude, req.body.location_url, req.body.address_text);
  if (!location.lat || !location.lng) throw new Error("Avval lokatsiyani aniqlang");
  const calc = calculateDeliveryFromLocation(location.lat, location.lng);
  const deliveryFee = Number(calc.deliveryFee || 0);
  const distanceKm = Number(calc.distanceKm || 0);
  let paymentProofImage = "";
  if (paymentType === "online") {
    if (req.file) paymentProofImage = await saveImage(req.file);
  }
  await client.query("BEGIN");
  const batch = await nextOrderBatchId(client);
  const meta = sourceMeta(req.body.source_code || req.cookies.source_code || "");
  const bindToken = String(req.body.telegram_bind_token || req.signedCookies.tg_bind_token || "");
  const bind = bindToken ? await client.query(`SELECT chat_id, username FROM telegram_bindings WHERE token=$1`, [bindToken]) : { rows: [] };
  const customerTelegram = String(bind.rows[0]?.chat_id || "");
  const customerTelegramUsername = String(bind.rows[0]?.username || "");
  let total = 0;
  for (let i=0;i<items.rows.length;i++) {
    const item = items.rows[i];
    const locked = await client.query(`SELECT stock_qty FROM books WHERE id=$1 FOR UPDATE`, [item.book_id]);
    if (!locked.rows.length || Number(locked.rows[0].stock_qty) < Number(item.qty)) throw new Error(`${item.title} uchun qoldiq yetarli emas`);
    const subtotal = Number(item.sale_price) * Number(item.qty);
    const delivery = i === 0 ? deliveryFee : 0;
    const lineTotal = subtotal + delivery;
    total += lineTotal;
    await client.query(`INSERT INTO customer_orders(book_id, qty, customer_name, phone, address_text, latitude, longitude, location_url, delivery_fee, subtotal, total_sum, batch_id, source_code, source_type, source_name, customer_telegram, customer_telegram_username, payment_type, payment_provider, payment_status, payment_proof_image, distance_km)
                        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`, [item.book_id, item.qty, String(req.body.customer_name||""), String(req.body.phone||""), String(req.body.address_text||""), location.lat, location.lng, location.locationUrl, delivery, subtotal, lineTotal, batch, meta.code, meta.type, meta.name, customerTelegram, customerTelegramUsername, paymentType, paymentProvider, 'pending', paymentProofImage, distanceKm]);
    await client.query(`UPDATE books SET stock_qty = stock_qty - $1, updated_at=NOW() WHERE id=$2`, [item.qty, item.book_id]);
  }
  await client.query(`DELETE FROM cart_items WHERE session_id=$1`, [sid]);
  await client.query("COMMIT");
  const summary = await getBatchSummary(batch);
  const tgResult = summary ? await sendOrderToGroup(summary) : null;
  if (tgResult && tgResult.ok && tgResult.result) await q(`UPDATE customer_orders SET telegram_message_id=$1, telegram_chat_id=$2 WHERE batch_id=$3`, [tgResult.result.message_id, String(tgResult.result.chat.id), batch]);
  await sendAcceptedMessage(customerTelegram);
  const onlinePayLink = paymentType === "online" ? buildPaymentCheckoutLink(paymentProvider, total, batch) : "";
  res.send(page("Zakaz qabul qilindi", `<div class="panel" style="max-width:720px;margin:0 auto"><div class="alert ok">Savatchadagi buyurtma qabul qilindi</div><div class="grid2"><div>Dostavka</div><div class="right">${money(deliveryFee)}</div></div><div class="grid2"><div>Masofa</div><div class="right">${distanceKm.toFixed(1)} km</div></div><div class="grid2"><div>Jami</div><div class="right"><b>${money(total)}</b></div></div><div class="grid2"><div>To'lov turi</div><div class="right">${esc(paymentTypeLabel(paymentType))}${paymentType === 'online' ? ' / ' + esc(paymentProviderLabel(paymentProvider)) : ''}</div></div>${onlinePayLink ? `<div class="actions" style="margin-top:12px"><a class="btn green" target="_blank" rel="noopener" href="${esc(onlinePayLink)}">QR dagi to'lov sahifasini ochish</a></div><div class="small">Bitta telefon bilan ham shu tugma orqali to'lov qilishingiz mumkin.</div>` : ""}<div class="actions" style="margin-top:12px"><a class="btn" href="/">Bosh sahifa</a></div></div>`, { admin:isAdmin(req) }));
} catch (e) { await client.query("ROLLBACK"); next(e); } finally { client.release(); } });



app.get("/admin/login", (req, res) => res.send(page("Admin login", `<div class="panel" style="max-width:520px;margin:0 auto"><h2>Admin kirish</h2><form class="form" method="post" action="/admin/login"><input type="password" name="pin" placeholder="PIN" required /><button type="submit">Kirish</button></form></div>`)));
app.post("/admin/login", (req, res) => { if (String(req.body.pin||"") !== ADMIN_PIN) return res.send(page("Admin login", `<div class="panel" style="max-width:520px;margin:0 auto"><div class="alert err">PIN noto'g'ri</div><a class="btn" href="/admin/login">Qayta urinish</a></div>`)); res.cookie("admin", signedAdminValue(), { signed:true, httpOnly:true, sameSite:"lax", secure:isSecureRequest(req), maxAge:1000*60*60*12 }); res.redirect("/admin"); });
app.get("/admin/logout", (_req, res) => { res.clearCookie("admin"); res.redirect("/"); });
app.get("/admin", requireAdmin, async (_req, res, next) => { try { const stats=await q(`SELECT (SELECT COUNT(*) FROM books) AS books_count,(SELECT COUNT(*) FROM counterparties) AS counterparties_count,(SELECT COUNT(*) FROM purchases) AS purchases_count,(SELECT COUNT(*) FROM customer_orders) AS orders_count,(SELECT COALESCE(SUM(total_sum),0) FROM purchases) AS purchases_sum,(SELECT COALESCE(SUM(total_sum),0) FROM customer_orders) AS orders_sum`); const s=stats.rows[0]; res.send(page("Admin", `<div class="panel"><div class="nav"><a class="btn dark" href="/admin/books">Kitoblar</a><a class="btn dark" href="/admin/counterparties">Kontragentlar</a><a class="btn dark" href="/admin/purchases/new">Prihod qilish</a><a class="btn dark" href="/admin/purchases">Prihodlar</a><a class="btn dark" href="/admin/orders">Zakazlar</a><a class="btn dark" href="/admin/categories">Kategoriyalar</a><a class="btn dark" href="/admin/sources">QR manbalar</a><a class="btn dark" href="/admin/reports">Hisobot</a><a class="btn red" href="/admin/logout">Chiqish</a></div><h2 style="margin-top:14px">Boshqaruv paneli</h2><div class="stat-grid"><div class="stat"><div class="muted">Kitoblar</div><div class="n">${s.books_count}</div></div><div class="stat"><div class="muted">Kontragentlar</div><div class="n">${s.counterparties_count}</div></div><div class="stat"><div class="muted">Prihodlar</div><div class="n">${s.purchases_count}</div></div><div class="stat"><div class="muted">Zakazlar</div><div class="n">${s.orders_count}</div></div><div class="stat"><div class="muted">Jami prihod</div><div class="n">${money(s.purchases_sum)}</div></div><div class="stat"><div class="muted">Jami zakaz</div><div class="n">${money(s.orders_sum)}</div></div></div></div>`, { admin:true })); } catch(e){ next(e);} });
app.get("/admin/books", requireAdmin, async (_req,res,next)=>{ try { const r=await q(`SELECT b.*, c.name AS category_name FROM books b LEFT JOIN categories c ON c.id=b.category_id ORDER BY b.id DESC`); const rows=r.rows.map((b)=>`<tr><td>${b.id}</td><td>${esc(b.title)}</td><td>${esc(b.category_name || '-')}</td><td>${money(b.purchase_price)}</td><td>${b.markup_percent}%</td><td>${money(b.sale_price)}</td><td>${b.stock_qty}</td></tr>`).join(""); res.send(page("Kitoblar", `<div class="panel"><div class="nav"><a class="btn dark" href="/admin">← Admin</a></div><h2>Kitoblar</h2><table><tr><th>ID</th><th>Nomi</th><th>Kategoriya</th><th>Olingan narx</th><th>Pereocenka</th><th>Sotuv narxi</th><th>Qoldiq</th></tr>${rows || `<tr><td colspan="7">Ma'lumot yo'q</td></tr>`}</table></div>`, { admin:true })); } catch(e){ next(e);} });
app.get("/admin/counterparties", requireAdmin, async (_req,res,next)=>{ try { const r=await q(`SELECT * FROM counterparties ORDER BY id DESC`); const rows=r.rows.map((c)=>`<tr><td>${c.id}</td><td>${esc(c.name)}</td><td>${esc(c.phone)}</td><td>${esc(c.note)}</td></tr>`).join(""); res.send(page("Kontragentlar", `<div class="panel"><div class="nav"><a class="btn" href="/admin/counterparties/new">+ Yangi kontragent</a><a class="btn dark" href="/admin">← Admin</a></div><h2>Kontragentlar</h2><table><tr><th>ID</th><th>Nomi</th><th>Telefon</th><th>Izoh</th></tr>${rows || `<tr><td colspan="4">Kontragent yo'q</td></tr>`}</table></div>`, { admin:true })); } catch(e){ next(e);} });
app.get("/admin/counterparties/new", requireAdmin, (_req,res)=> res.send(page("Yangi kontragent", `<div class="panel" style="max-width:760px;margin:0 auto"><h2>Yangi kontragent</h2><form class="form" method="post" action="/admin/counterparties/new"><input name="name" placeholder="Kontragent nomi" required /><input name="phone" placeholder="Telefon" /><textarea name="note" placeholder="Izoh"></textarea><button class="btn green" type="submit">Saqlash</button></form></div>`, { admin:true })));
app.post("/admin/counterparties/new", requireAdmin, async (req,res,next)=>{ try { await q(`INSERT INTO counterparties(name, phone, note) VALUES ($1,$2,$3)`, [String(req.body.name||""), String(req.body.phone||""), String(req.body.note||"")]); res.redirect("/admin/counterparties"); } catch(e){ next(e);} });
app.get("/admin/purchases/new", requireAdmin, async (_req,res,next)=>{ try { const cps=(await q(`SELECT id,name FROM counterparties ORDER BY name`)).rows; const books=(await q(`SELECT id,title FROM books ORDER BY title`)).rows; const categories=(await q(`SELECT id,name FROM categories ORDER BY name`)).rows; const cpOptions=cps.map((c)=>`<option value="${c.id}">${esc(c.name)}</option>`).join(""); const bookOptions=books.map((b)=>`<option value="${b.id}">${esc(b.title)}</option>`).join(""); const catOptions=categories.map((c)=>`<option value="${c.id}">${esc(c.name)}</option>`).join(""); res.send(page("Prihod qilish", `<div class="panel" style="max-width:900px;margin:0 auto"><div class="nav"><a class="btn dark" href="/admin">← Admin</a><a class="btn soft" href="/admin/counterparties/new">Avval kontragent qo'shish</a><a class="btn soft" href="/admin/categories">Kategoriyalar</a></div><h2>Prihod qilish</h2><form class="form" method="post" action="/admin/purchases/new" enctype="multipart/form-data"><div class="grid2"><select name="counterparty_id" required><option value="">Kontragent tanlang</option>${cpOptions}</select><input type="date" name="doc_date" value="${new Date().toISOString().slice(0,10)}" required /></div><div class="grid2"><select name="category_id"><option value="">Kategoriya tanlang</option>${catOptions}</select><select name="existing_book_id"><option value="">Mavjud mahsulotni tanlang (ixtiyoriy)</option>${bookOptions}</select></div><div class="grid2"><input name="title" placeholder="Yoki yangi mahsulot nomi" /><input name="author" placeholder="Muallif / Tavsif" /></div><div class="grid2"><input type="file" name="image" accept="image/*" /><input type="number" name="qty" min="1" placeholder="Nechta olingan" required /></div><div class="grid2"><input type="number" name="purchase_price" min="0" placeholder="Nech pulga olingan (1 dona)" required /><input type="number" step="0.01" name="markup_percent" min="0" placeholder="Pereocenka foizi" required /></div><textarea name="note" placeholder="Izoh"></textarea><button type="submit" class="btn green">Saqlash</button></form></div>`, { admin:true })); } catch(e){ next(e);} });
app.post("/admin/purchases/new", requireAdmin, upload.single("image"), async (req,res,next)=>{ const client=await pool.connect(); try { const qty=Number(req.body.qty||0); const purchasePrice=Number(req.body.purchase_price||0); const markupPercent=Number(req.body.markup_percent||0); if(!Number.isFinite(qty)||qty<=0) throw new Error("Soni noto'g'ri"); if(!Number.isFinite(purchasePrice)||purchasePrice<0) throw new Error("Olingan narx noto'g'ri"); if(!Number.isFinite(markupPercent)||markupPercent<0) throw new Error("Pereocenka foizi noto'g'ri"); await client.query("BEGIN"); let bookId=Number(req.body.existing_book_id||0); const imagePath=await saveImage(req.file); const salePrice=Math.round(purchasePrice*(1+markupPercent/100)); const lineSum=qty*purchasePrice; if(!bookId){ const title=String(req.body.title||"").trim(); if(!title) throw new Error("Yangi kitob nomini kiriting yoki mavjud kitobni tanlang"); const inserted=await client.query(`INSERT INTO books(title, author, image, purchase_price, markup_percent, sale_price, stock_qty, active, category_id) VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,$8) RETURNING id`, [title, String(req.body.author||""), imagePath, purchasePrice, markupPercent, salePrice, qty, Number(req.body.category_id||0) || null]); bookId=inserted.rows[0].id; } else { const current=await client.query(`SELECT * FROM books WHERE id=$1 FOR UPDATE`, [bookId]); if(!current.rows.length) throw new Error("Kitob topilmadi"); await client.query(`UPDATE books SET author = CASE WHEN $1 <> '' THEN $1 ELSE author END, image = CASE WHEN $2 <> '' THEN $2 ELSE image END, purchase_price = $3, markup_percent = $4, sale_price = $5, stock_qty = stock_qty + $6, category_id = COALESCE($8, category_id), updated_at = NOW() WHERE id = $7`, [String(req.body.author||""), imagePath, purchasePrice, markupPercent, salePrice, qty, bookId, Number(req.body.category_id||0) || null]); } const docNo=await nextPurchaseNo(client); const purchase=await client.query(`INSERT INTO purchases(doc_no, doc_date, counterparty_id, note, total_sum) VALUES ($1,$2,$3,$4,$5) RETURNING id`, [docNo, req.body.doc_date, req.body.counterparty_id, String(req.body.note||""), lineSum]); await client.query(`INSERT INTO purchase_lines(purchase_id, book_id, qty, purchase_price, markup_percent, sale_price, line_sum) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [purchase.rows[0].id, bookId, qty, purchasePrice, markupPercent, salePrice, lineSum]); await client.query("COMMIT"); res.redirect(`/admin/purchases/${purchase.rows[0].id}`); } catch(e){ await client.query("ROLLBACK"); next(e);} finally { client.release(); } });
app.get("/admin/purchases", requireAdmin, async (_req,res,next)=>{ try { const r=await q(`SELECT p.*, COALESCE(c.name,'-') AS counterparty_name FROM purchases p LEFT JOIN counterparties c ON c.id=p.counterparty_id ORDER BY p.id DESC`); const rows=r.rows.map((p)=>`<tr><td>${esc(p.doc_no)}</td><td>${esc(String(p.doc_date))}</td><td>${esc(p.counterparty_name)}</td><td>${money(p.total_sum)}</td><td><a class="btn soft" href="/admin/purchases/${p.id}">Ko'rish</a></td></tr>`).join(""); res.send(page("Prihodlar", `<div class="panel"><div class="nav"><a class="btn" href="/admin/purchases/new">+ Prihod qilish</a><a class="btn dark" href="/admin">← Admin</a></div><h2>Prihodlar</h2><table><tr><th>№</th><th>Sana</th><th>Kontragent</th><th>Jami</th><th></th></tr>${rows || `<tr><td colspan="5">Prihod yo'q</td></tr>`}</table></div>`, { admin:true })); } catch(e){ next(e);} });
app.get("/admin/purchases/:id", requireAdmin, async (req,res,next)=>{ try { const id=Number(req.params.id); const h=await q(`SELECT p.*, COALESCE(c.name,'-') AS counterparty_name FROM purchases p LEFT JOIN counterparties c ON c.id=p.counterparty_id WHERE p.id=$1`, [id]); if(!h.rows.length) return res.status(404).send("Topilmadi"); const p=h.rows[0]; const lines=await q(`SELECT pl.*, b.title FROM purchase_lines pl JOIN books b ON b.id=pl.book_id WHERE pl.purchase_id=$1`, [id]); const rows=lines.rows.map((l)=>`<tr><td>${esc(l.title)}</td><td>${l.qty}</td><td>${money(l.purchase_price)}</td><td>${l.markup_percent}%</td><td>${money(l.sale_price)}</td><td>${money(l.line_sum)}</td></tr>`).join(""); res.send(page("Prihod", `<div class="panel"><div class="nav"><a class="btn dark" href="/admin/purchases">← Prihodlar</a><a class="btn" href="/admin/purchases/${id}/pdf">PDF</a></div><h2>Prihod ${esc(p.doc_no)}</h2><div class="grid2"><div class="card"><b>Sana</b><br>${esc(String(p.doc_date))}</div><div class="card"><b>Kontragent</b><br>${esc(p.counterparty_name)}</div></div><table style="margin-top:12px"><tr><th>Kitob</th><th>Soni</th><th>Olingan narx</th><th>Pereocenka</th><th>Sotuv narxi</th><th>Summa</th></tr>${rows}</table><div class="right" style="margin-top:12px;font-size:20px;font-weight:900">Jami: ${money(p.total_sum)}</div></div>`, { admin:true })); } catch(e){ next(e);} });
app.get("/admin/purchases/:id/pdf", requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const h = await q(`SELECT p.*, COALESCE(c.name,'-') AS counterparty_name FROM purchases p LEFT JOIN counterparties c ON c.id=p.counterparty_id WHERE p.id=$1`, [id]);
    if (!h.rows.length) return res.status(404).send("Topilmadi");
    const p = h.rows[0];
    const lines = await q(`SELECT pl.*, b.title FROM purchase_lines pl JOIN books b ON b.id=pl.book_id WHERE pl.purchase_id=$1`, [id]);

    const orgName = process.env.ORG_NAME || "Kitob Market";
    const warehouseName = process.env.WAREHOUSE_NAME || "Asosiy ombor";

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${p.doc_no}.pdf"`);

    const doc = new PDFDocument({ margin:36, size: "A4" });
    doc.pipe(res);
    const regularFont = pickPdfFontPath("DejaVuSans.ttf");
    const boldFont = pickPdfFontPath("DejaVuSans-Bold.ttf");
    if (regularFont) doc.registerFont("ui", regularFont);
    if (boldFont) doc.registerFont("ui-bold", boldFont);
    const fontRegular = regularFont ? "ui" : "Helvetica";
    const fontBold = boldFont ? "ui-bold" : "Helvetica-Bold";

    const pageWidth = doc.page.width;
    const left = 36;
    const right = pageWidth - 36;

    doc.font(fontBold).fontSize(20).fillColor("#0f1e38").text(`Prihod nakladnoy No ${p.doc_no}`, left, 34, { align: "left" });
    doc.font(fontRegular).fontSize(12).fillColor("#334155");
    doc.text(`Sana: ${dateUz(p.doc_date)}`, left, 62);
    doc.text(`Tashkilot: ${orgName}`, left, 80);
    doc.text(`Ombor: ${warehouseName}`, left, 98);
    doc.text(`Kontragent: ${p.counterparty_name}`, left, 116);
    doc.moveTo(left, 138).lineTo(right, 138).strokeColor("#cbd5e1").lineWidth(1).stroke();

    const tableTop = 150;
    const rowH = 26;
    const cols = [
      { key: "idx", title: "No", width: 32, align: "center" },
      { key: "title", title: "Nomi", width: 300, align: "left" },
      { key: "qty", title: "Soni", width: 80, align: "right" },
      { key: "price", title: "Narxi", width: 111, align: "right" },
    ];

    const fmt = (n) => Number(n || 0).toLocaleString("ru-RU");
    const xBy = [];
    let currentX = left;
    cols.forEach((c) => {
      xBy.push(currentX);
      currentX += c.width;
    });

    const drawRow = (y, row, isHeader = false) => {
      doc.rect(left, y, right - left, rowH).fillAndStroke(isHeader ? "#e8eefc" : "#ffffff", "#cbd5e1");
      cols.forEach((c, i) => {
        const x = xBy[i];
        if (i > 0) doc.moveTo(x, y).lineTo(x, y + rowH).strokeColor("#cbd5e1").lineWidth(1).stroke();
        const text = row[c.key];
        doc.font(isHeader ? fontBold : fontRegular).fontSize(10).fillColor("#0f172a").text(
          String(text),
          x + 5,
          y + 8,
          { width: c.width - 10, align: c.align || "left", lineBreak: false, ellipsis: true }
        );
      });
    };

    drawRow(tableTop, Object.fromEntries(cols.map((c) => [c.key, c.title])), true);

    let y = tableTop + rowH;
    lines.rows.forEach((l, i) => {
      const row = {
        idx: i + 1,
        title: l.title,
        qty: fmt(l.qty),
        price: fmt(l.purchase_price),
      };
      drawRow(y, row, false);
      y += rowH;
    });

    const totalsY = y + 14;
    doc.font(fontRegular).fontSize(11).fillColor("#0f172a");
    doc.text(`Pozitsiyalar soni: ${lines.rows.length}`, left, totalsY);
    doc.font(fontBold).fontSize(13).fillColor("#0f1e38").text(`Jami: ${fmt(p.total_sum)} so'm`, left, totalsY, { align: "right" });

    const signY = totalsY + 46;
    doc.font(fontRegular).fontSize(11).fillColor("#334155");
    doc.text("Topshirdi: ____________________", left, signY);
    doc.text("Qabul qildi: ____________________", left + 290, signY);

    doc.end();
  } catch (e) {
    next(e);
  }
});
app.get("/admin/orders", requireAdmin, async (_req,res,next)=>{ try { const r=await q(`SELECT o.*, b.title FROM customer_orders o JOIN books b ON b.id=o.book_id ORDER BY o.id DESC`); const rows=r.rows.map((o)=>`<tr><td>#${o.id}</td><td>${esc(o.batch_id || '-')}</td><td>${esc(o.title)}</td><td>${o.qty}</td><td>${esc(o.customer_name || "-")}</td><td>${esc(o.phone)}</td><td>${esc(o.source_name || '-')}</td><td>${money(o.total_sum)}</td><td>${esc(statusLabel(o.status))}</td><td><a class="btn soft" href="/admin/orders/${o.id}/receipt">Chek</a></td></tr>`).join(""); res.send(page("Zakazlar", `<div class="panel"><div class="nav"><a class="btn dark" href="/admin">← Admin</a></div><h2>Zakazlar</h2><table><tr><th>ID</th><th>Batch</th><th>Kitob</th><th>Soni</th><th>Mijoz</th><th>Telefon</th><th>Manba</th><th>Jami</th><th>Status</th><th></th></tr>${rows || `<tr><td colspan="10">Zakaz yo'q</td></tr>`}</table></div>`, { admin:true })); } catch(e){ next(e);} });
app.get("/admin/orders/:id/receipt", requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const r = await q(`SELECT o.*, b.title, b.author, b.sale_price FROM customer_orders o JOIN books b ON b.id=o.book_id WHERE o.id=$1`, [id]);
    if (!r.rows.length) return res.status(404).send("Topilmadi");
    const o = r.rows[0];
    const regularFont = pickPdfFontPath("DejaVuSans.ttf");
    const boldFont = pickPdfFontPath("DejaVuSans-Bold.ttf");
    const doc = new PDFDocument({ margin: 36, size: "A5" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="CHECK-${o.id}.pdf"`);
    doc.pipe(res);
    if (regularFont) doc.registerFont("ui", regularFont);
    if (boldFont) doc.registerFont("ui-bold", boldFont);
    const fontRegular = regularFont ? "ui" : "Helvetica";
    const fontBold = boldFont ? "ui-bold" : "Helvetica-Bold";
    const fmt = (n) => Number(n || 0).toLocaleString("ru-RU");
    const subtotal = Number(o.subtotal || (Number(o.qty || 0) * Number(o.sale_price || 0)));
    const left = 36;
    const right = doc.page.width - 36;
    doc.font(fontBold).fontSize(20).fillColor("#0f1e38").text("Xarid cheki", left, 28, { align: "center", width: right - left });
    doc.font(fontRegular).fontSize(11).fillColor("#0f172a");
    doc.text(`Sana: ${dateUz(o.created_at || new Date())}`, left, 72);
    doc.text(`Chek No: ${o.id}`, left, 90);
    doc.text(`Mijoz: ${o.customer_name || "-"}`, left, 108);
    const top = 136;
    const cols = [
      { key: "title", title: "Nomi", x: left, w: 190, align: "left" },
      { key: "qty", title: "Soni", x: left + 190, w: 60, align: "right" },
      { key: "price", title: "Narxi", x: left + 250, w: right - (left + 250), align: "right" }
    ];
    doc.rect(left, top, right - left, 26).fillAndStroke("#edf2ff", "#cbd5e1");
    cols.forEach((c) => doc.font(fontBold).fontSize(11).fillColor("#0f172a").text(c.title, c.x + 6, top + 8, { width: c.w - 12, align: c.align }));
    doc.rect(left, top + 26, right - left, 34).fillAndStroke("#ffffff", "#cbd5e1");
    doc.font(fontRegular).fontSize(11).fillColor("#0f172a");
    doc.text(String(o.title || "-"), cols[0].x + 6, top + 38, { width: cols[0].w - 12, align: "left", ellipsis: true });
    doc.text(fmt(o.qty), cols[1].x + 6, top + 38, { width: cols[1].w - 12, align: "right" });
    doc.text(`${fmt(o.sale_price)} so'm`, cols[2].x + 6, top + 38, { width: cols[2].w - 12, align: "right" });
    const totalY = top + 84;
    doc.moveTo(left, totalY).lineTo(right, totalY).strokeColor("#cbd5e1").stroke();
    doc.font(fontBold).fontSize(16).fillColor("#0f1e38").text(`Jami to'lov: ${fmt(subtotal)} so'm`, left, totalY + 10, { width: right - left, align: "right" });
    doc.font(fontRegular).fontSize(9).fillColor("#64748b").text("Eslatma: ushbu chekda доставка puli ko'rsatilmaydi.", left, totalY + 34, { width: right - left, align: "right" });
    doc.end();
  } catch (e) {
    next(e);
  }
});
app.get("/admin/reports", requireAdmin, async (_req,res,next)=>{ try {
  const stock=await q(`SELECT title, stock_qty, sale_price, purchase_price FROM books ORDER BY title`);
  const rows=stock.rows.map((b)=>`<tr><td>${esc(b.title)}</td><td>${b.stock_qty}</td><td>${money(b.purchase_price)}</td><td>${money(b.sale_price)}</td><td>${money(Number(b.stock_qty) * Number(b.sale_price || 0))}</td></tr>`).join("");
  const sourceStats = await q(`SELECT s.name AS source_name, s.code AS source_code, COUNT(DISTINCT o.batch_id) AS orders_count, COALESCE(SUM(o.total_sum),0) AS total_sum, COALESCE(STRING_AGG(DISTINCT NULLIF(o.customer_name,''), ', '), '-') AS customers FROM source_refs s LEFT JOIN customer_orders o ON o.source_code=s.code GROUP BY s.name, s.code ORDER BY s.code`);
  const sourceRows = sourceStats.rows.map((s)=>`<tr><td>${esc(s.source_name || s.source_code)}</td><td>${esc(s.source_code)}</td><td>${s.orders_count}</td><td>${money(s.total_sum)}</td><td>${esc(s.customers || "-")}</td><td><a class="btn soft" href="/admin/sources/${encodeURIComponent(s.source_code)}">Batafsil</a></td></tr>`).join("");
  res.send(page("Hisobot", `<div class="panel"><div class="nav"><a class="btn dark" href="/admin">← Admin</a><a class="btn soft" href="/admin/sources">QR obyektlar</a></div><h2>Ostatka va hisobot</h2><table><tr><th>Kitob</th><th>Qoldiq</th><th>Olingan narx</th><th>Sotuv narxi</th><th>Qoldiq summasi</th></tr>${rows || `<tr><td colspan="5">Ma'lumot yo'q</td></tr>`}</table><h2 style="margin-top:18px">QR obyektlar bo'yicha analytics</h2><table><tr><th>Obekt</th><th>Kod</th><th>Zakazlar</th><th>Jami</th><th>Mijozlar</th><th></th></tr>${sourceRows || `<tr><td colspan="6">Ma'lumot yo'q</td></tr>`}</table></div>`, { admin:true }));
} catch(e){ next(e);} });

app.get("/admin/categories", requireAdmin, async (_req,res,next)=>{ try {
  const r = await q(`SELECT * FROM categories ORDER BY name`);
  const rows = r.rows.map(c => `<tr><td>${c.id}</td><td>${esc(c.name)}</td></tr>`).join("");
  res.send(page("Kategoriyalar", `<div class="panel"><div class="nav"><a class="btn dark" href="/admin">← Admin</a></div><h2>Kategoriyalar</h2><form class="form" method="post" action="/admin/categories" style="max-width:520px"><input name="name" placeholder="Kategoriya nomi" required /><button class="btn green" type="submit">Saqlash</button></form><table style="margin-top:16px"><tr><th>ID</th><th>Nomi</th></tr>${rows || `<tr><td colspan="2">Kategoriya yo'q</td></tr>`}</table></div>`, { admin:true }));
} catch(e){ next(e);} });

app.post("/admin/categories", requireAdmin, async (req,res,next)=>{ try {
  const name = String(req.body.name || "").trim();
  if (!name) throw new Error("Kategoriya nomini kiriting");
  await q(`INSERT INTO categories(name) VALUES ($1) ON CONFLICT (name) DO NOTHING`, [name]);
  res.redirect("/admin/categories");
} catch(e){ next(e);} });

app.get("/admin/sources", requireAdmin, async (_req,res,next)=>{ try {
  const r = await q(`SELECT s.*, COUNT(DISTINCT o.batch_id) AS orders_count, COALESCE(SUM(o.total_sum),0) AS total_sum FROM source_refs s LEFT JOIN customer_orders o ON o.source_code=s.code GROUP BY s.code, s.type, s.name, s.created_at ORDER BY s.code`);
  const rows = r.rows.map(s => `<tr><td>${esc(s.name)}</td><td>${esc(s.code)}</td><td>${s.orders_count}</td><td>${money(s.total_sum)}</td><td><code>https://t.me/${esc(TELEGRAM_BOT_USERNAME)}?start=${esc(s.code)}</code></td><td><a class="btn soft" href="/admin/sources/${encodeURIComponent(s.code)}">Batafsil</a></td></tr>`).join("");
  res.send(page("QR obyektlar", `<div class="panel"><div class="nav"><a class="btn dark" href="/admin">← Admin</a><a class="btn soft" href="/admin/reports">Hisobot</a></div><h2>QR obyektlar</h2><p class="muted">Eski QR manbalar olib tashlandi. Endi 30 ta kuzatiladigan obyekt ishlatiladi.</p><table><tr><th>Nomi</th><th>Kod</th><th>Zakazlar</th><th>Jami</th><th>Bot link</th><th></th></tr>${rows}</table></div>`, { admin:true }));
} catch(e){ next(e);} });

app.get("/admin/sources/:code", requireAdmin, async (req,res,next)=>{ try {
  const code = String(req.params.code || "");
  const source = await q(`SELECT * FROM source_refs WHERE code=$1`, [code]);
  if(!source.rows.length) return res.status(404).send("Topilmadi");
  const s = source.rows[0];
  const summary = await q(`SELECT COUNT(DISTINCT batch_id) AS orders_count, COALESCE(SUM(total_sum),0) AS total_sum, COALESCE(STRING_AGG(DISTINCT NULLIF(customer_name,''), ', '), '-') AS customers FROM customer_orders WHERE source_code=$1`, [code]);
  const orders = await q(`SELECT o.batch_id, o.customer_name, o.phone, o.status, MIN(o.created_at) AS created_at, SUM(o.total_sum) AS total_sum, STRING_AGG(DISTINCT b.title, ', ') AS books FROM customer_orders o JOIN books b ON b.id=o.book_id WHERE o.source_code=$1 GROUP BY o.batch_id, o.customer_name, o.phone, o.status ORDER BY MIN(o.created_at) DESC`, [code]);
  const info = summary.rows[0];
  const orderRows = orders.rows.map(o => `<tr><td>${esc(o.batch_id || '-')}</td><td>${esc(o.customer_name || '-')}</td><td>${esc(o.phone || '-')}</td><td>${esc(o.books || '-')}</td><td>${money(o.total_sum)}</td><td>${esc(statusLabel(o.status))}</td><td>${dateUz(o.created_at)}</td></tr>`).join("");
  res.send(page(`${esc(s.name)} hisobot`, `<div class="panel"><div class="nav"><a class="btn dark" href="/admin/sources">← QR obyektlar</a></div><h2>${esc(s.name)}</h2><div class="stat-grid"><div class="stat"><div class="muted">Zakazlar</div><div class="n">${info.orders_count}</div></div><div class="stat"><div class="muted">Jami tushum</div><div class="n">${money(info.total_sum)}</div></div></div><div class="panel" style="margin-top:14px"><div><b>Kod:</b> ${esc(s.code)}</div><div style="margin-top:8px"><b>Bot link:</b> <code>https://t.me/${esc(TELEGRAM_BOT_USERNAME)}?start=${esc(s.code)}</code></div><div style="margin-top:8px"><b>Mijozlar:</b> ${esc(info.customers || '-')}</div></div><table style="margin-top:14px"><tr><th>Batch</th><th>Mijoz</th><th>Telefon</th><th>Kitoblar</th><th>Jami</th><th>Status</th><th>Sana</th></tr>${orderRows || `<tr><td colspan="7">Zakaz yo'q</td></tr>`}</table></div>`, { admin:true }));
} catch(e){ next(e);} });

app.use((err, req, res, _next) => { res.status(500).send(page("Xatolik", `<div class="panel" style="max-width:760px;margin:0 auto"><div class="alert err">${esc(err && err.message ? err.message : "Noma'lum xatolik")}</div><a class="btn dark" href="javascript:history.back()">← Ortga</a></div>`, { admin:isAdmin(req) })); });
(async () => { try { await initDb(); app.listen(PORT, () => console.log(`Server listening on ${PORT}`)); } catch (e) { console.error(e); process.exit(1); } })();
