const express = require("express");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const PDFDocument = require("pdfkit");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { v2: cloudinary } = require("cloudinary");
const { basicRateLimit } = require("./middlewares/rateLimit");
const { validate } = require("./middlewares/validate");
const { createTelegramService } = require("./services/telegramService");
const { createTelegramController } = require("./controllers/telegramController");
const { createTelegramRouter } = require("./routes/telegram");
const apiRouter = require("./routes/api");
const { registerWebRoutes } = require("./routes/web");
const { createWebController } = require("./controllers/webController");
const { pool, q } = require("./config/db");
const { isSecureRequest: utilIsSecureRequest, secureCookieOptions, signedAdminValue: makeSignedAdminValue, isAdmin: checkAdmin } = require("./utils/security");

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
app.use(basicRateLimit());
app.use("/uploads", express.static(UPLOAD_DIR));

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
function signedAdminValue() { return makeSignedAdminValue(ADMIN_PIN, SESSION_SECRET); }
function isAdmin(req) { return checkAdmin(req, ADMIN_PIN, SESSION_SECRET); }
function requireAdmin(req, res, next) { if (!isAdmin(req)) return res.redirect("/admin/login"); next(); }
function isSecureRequest(req) { return utilIsSecureRequest(req); }
function ensureBindToken(req, res) {
  const existing = String(req.signedCookies.tg_bind_token || "").trim();
  if (existing) return existing;
  const token = crypto.randomBytes(12).toString("hex");
  res.cookie("tg_bind_token", token, { signed: true, ...secureCookieOptions(req, 1000 * 60 * 60 * 24 * 30) });
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
    res.cookie("cart_sid", sid, { signed: true, ...secureCookieOptions(req, 1000 * 60 * 60 * 24 * 30) });
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


const telegramService = createTelegramService({ tg, decodeBatchToken, sourceMeta, openWebAppButton, normalizeTelegramTarget, statusLabel, updateGroupOrderMessage, sendReceiptNotifications, verifyTelegramInitData, ensureBindToken, TELEGRAM_GROUP_CHAT_ID });
const telegramController = createTelegramController(telegramService, { statusActionSig });
app.use("/telegram", createTelegramRouter(telegramController));
app.use("/api", apiRouter);

const webController = createWebController({ validate, upload, pool, q, resolveLocation, calculateDeliveryFromLocation, createTelegramService, tg, decodeBatchToken, sourceMeta, openWebAppButton, normalizeTelegramTarget, statusLabel, updateGroupOrderMessage, sendReceiptNotifications, verifyTelegramInitData, ensureBindToken, TELEGRAM_GROUP_CHAT_ID, createTelegramController, statusActionSig, createTelegramRouter, apiRouter, getSourceCode, isSecureRequest, secureCookieOptions, cartSessionId, cartCount, esc, page, isAdmin, telegramAutoBindScript, money, paymentProviderLink, normalizePaymentType, normalizePaymentProvider, saveImage, nextOrderBatchId, sendAcceptedMessage, getBatchSummary, telegramOrderText, sendOrderToGroup, sourceBadge, cartItemHtml, getCartItems, DELIVERY_FEE });
registerWebRoutes(app, webController);

app.get("/admin/login", (req, res) => res.send(page("Admin login", `<div class="panel" style="max-width:520px;margin:0 auto"><h2>Admin kirish</h2><form class="form" method="post" action="/admin/login"><input type="password" name="pin" placeholder="PIN" required /><button type="submit">Kirish</button></form></div>`)));
app.post("/admin/login", (req, res) => { if (String(req.body.pin||"") !== ADMIN_PIN) return res.send(page("Admin login", `<div class="panel" style="max-width:520px;margin:0 auto"><div class="alert err">PIN noto'g'ri</div><a class="btn" href="/admin/login">Qayta urinish</a></div>`)); res.cookie("admin", signedAdminValue(), { signed:true, ...secureCookieOptions(req, 1000*60*60*12) }); res.redirect("/admin"); });
app.get("/admin/logout", (_req, res) => { res.clearCookie("admin"); res.redirect("/"); });

async function adminOrderBatch(orderId) {
  const r = await q(`SELECT batch_id FROM customer_orders WHERE id=$1`, [orderId]);
  return String(r.rows[0]?.batch_id || "").trim();
}

app.get("/admin", requireAdmin, async (_req, res, next) => {
  try {
    const stats = await q(`SELECT COUNT(DISTINCT batch_id) AS orders_count, COALESCE(SUM(total_sum),0) AS orders_sum FROM customer_orders`);
    const s = stats.rows[0] || {};
    res.send(page("Admin", `<div class="panel"><div class="nav"><a class="btn dark" href="/admin/orders">Zakazlar</a><a class="btn dark" href="/admin/sources">QR manbalar</a><a class="btn dark" href="/admin/reports">Manba hisobotlari</a><a class="btn red" href="/admin/logout">Chiqish</a></div><h2 style="margin-top:14px">Yengil operatsion panel</h2><div class="stat-grid"><div class="stat"><div class="muted">Jami zakazlar</div><div class="n">${s.orders_count}</div></div><div class="stat"><div class="muted">Jami tushum</div><div class="n">${money(s.orders_sum)}</div></div></div></div>`, { admin:true }));
  } catch (e) {
    next(e);
  }
});

app.get("/admin/orders", requireAdmin, async (_req,res,next)=>{
  try {
    const r=await q(`SELECT o.*, b.title FROM customer_orders o JOIN books b ON b.id=o.book_id ORDER BY o.id DESC`);
    const rows=r.rows.map((o)=>`<tr><td>#${o.id}</td><td>${esc(o.batch_id || '-')}</td><td>${esc(o.title)}</td><td>${o.qty}</td><td>${esc(o.customer_name || "-")}</td><td>${esc(o.phone)}</td><td>${esc(o.source_name || '-')}</td><td>${money(o.total_sum)}</td><td>${esc(statusLabel(o.status))}</td><td>${esc(paymentStatusLabel(o.payment_status))}</td><td><a class="btn soft" href="/admin/orders/${o.id}">Ko'rish</a></td></tr>`).join("");
    res.send(page("Zakazlar", `<div class="panel"><div class="nav"><a class="btn dark" href="/admin">← Admin</a></div><h2>Zakazlar</h2><table><tr><th>ID</th><th>Batch</th><th>Kitob</th><th>Soni</th><th>Mijoz</th><th>Telefon</th><th>Manba</th><th>Jami</th><th>Status</th><th>To'lov</th><th></th></tr>${rows || `<tr><td colspan="11">Zakaz yo'q</td></tr>`}</table></div>`, { admin:true }));
  } catch(e){
    next(e);
  }
});

app.get("/admin/orders/:id", requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const r = await q(`SELECT o.*, b.title, b.author FROM customer_orders o JOIN books b ON b.id=o.book_id WHERE o.id=$1`, [id]);
    if (!r.rows.length) return res.status(404).send("Topilmadi");
    const o = r.rows[0];
    const actions = [];
    if (String(o.payment_status || "") !== "paid" && String(o.payment_status || "") !== "confirmed") {
      actions.push(`<form method="post" action="/admin/orders/${o.id}/confirm"><button class="btn green" type="submit">To'lovni tasdiqlash</button></form>`);
    }
    if (String(o.status || "") !== "delivered") {
      actions.push(`<form method="post" action="/admin/orders/${o.id}/deliver"><button class="btn" type="submit">Yetkazildi</button></form>`);
    }
    if (String(o.status || "") !== "returned") {
      actions.push(`<form method="post" action="/admin/orders/${o.id}/return"><button class="btn red" type="submit">Vozvrat</button></form>`);
    }
    actions.push(`<a class="btn soft" href="/admin/orders/${o.id}/receipt">Chek (PDF)</a>`);

    res.send(page(`Zakaz #${o.id}`, `<div class="panel"><div class="nav"><a class="btn dark" href="/admin/orders">← Zakazlar</a></div><h2>Zakaz #${o.id}</h2><div class="grid2"><div class="card"><b>Batch</b><br>${esc(o.batch_id || '-')}</div><div class="card"><b>Sana</b><br>${dateUz(o.created_at)}</div></div><div class="grid2"><div class="card"><b>Mijoz</b><br>${esc(o.customer_name || '-')}<br>${esc(o.phone || '-')}</div><div class="card"><b>Manba</b><br>${esc(o.source_name || '-')}<br><code>${esc(o.source_code || '-')}</code></div></div><div class="grid2"><div class="card"><b>Kitob</b><br>${esc(o.title || '-')} (${o.qty} dona)</div><div class="card"><b>Jami</b><br>${money(o.total_sum)}</div></div><div class="grid2"><div class="card"><b>Holat</b><br>${esc(statusLabel(o.status))}</div><div class="card"><b>To'lov</b><br>${esc(paymentTypeLabel(o.payment_type))} / ${esc(paymentProviderLabel(o.payment_provider))}<br>${esc(paymentStatusLabel(o.payment_status))}</div></div>${o.payment_proof_image ? `<div class="panel"><b>Online chek:</b><br><a href="${esc(o.payment_proof_image)}" target="_blank" rel="noopener">${esc(o.payment_proof_image)}</a></div>` : ''}<div class="actions" style="margin-top:12px">${actions.join("")}</div></div>`, { admin: true }));
  } catch (e) {
    next(e);
  }
});

app.post("/admin/orders/:id/confirm", requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const order = await q(`SELECT payment_type FROM customer_orders WHERE id=$1`, [id]);
    if (!order.rows.length) return res.status(404).send("Topilmadi");
    const batch = await adminOrderBatch(id);
    if (!batch) return res.status(404).send("Topilmadi");
    const paymentStatus = String(order.rows[0].payment_type || "") === "online" ? "paid" : "confirmed";
    await q(`UPDATE customer_orders SET payment_status=$1 WHERE batch_id=$2`, [paymentStatus, batch]);
    await updateGroupOrderMessage(batch);
    res.redirect(`/admin/orders/${id}`);
  } catch (e) {
    next(e);
  }
});

app.post("/admin/orders/:id/deliver", requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const batch = await adminOrderBatch(id);
    if (!batch) return res.status(404).send("Topilmadi");
    await q(`UPDATE customer_orders SET status='delivered' WHERE batch_id=$1`, [batch]);
    await q(`UPDATE customer_orders SET receipt_sent=TRUE WHERE batch_id=$1`, [batch]);
    await sendReceiptNotifications(batch);
    await updateGroupOrderMessage(batch);
    res.redirect(`/admin/orders/${id}`);
  } catch (e) {
    next(e);
  }
});

app.post("/admin/orders/:id/return", requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const batch = await adminOrderBatch(id);
    if (!batch) return res.status(404).send("Topilmadi");
    await q(`UPDATE customer_orders SET status='returned' WHERE batch_id=$1`, [batch]);
    await updateGroupOrderMessage(batch);
    res.redirect(`/admin/orders/${id}`);
  } catch (e) {
    next(e);
  }
});

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
  const sourceStats = await q(`SELECT s.name AS source_name, s.code AS source_code, COUNT(DISTINCT o.batch_id) AS orders_count, COALESCE(SUM(o.total_sum),0) AS total_sum, COALESCE(STRING_AGG(DISTINCT NULLIF(o.customer_name,''), ', '), '-') AS customers FROM source_refs s LEFT JOIN customer_orders o ON o.source_code=s.code GROUP BY s.name, s.code ORDER BY s.code`);
  const sourceRows = sourceStats.rows.map((s)=>`<tr><td>${esc(s.source_name || s.source_code)}</td><td>${esc(s.source_code)}</td><td>${s.orders_count}</td><td>${money(s.total_sum)}</td><td>${esc(s.customers || "-")}</td><td><a class="btn soft" href="/admin/sources/${encodeURIComponent(s.source_code)}">Batafsil</a></td></tr>`).join("");
  res.send(page("Manba hisobotlari", `<div class="panel"><div class="nav"><a class="btn dark" href="/admin">← Admin</a><a class="btn soft" href="/admin/sources">QR obyektlar</a></div><h2>QR/source analytics</h2><table><tr><th>Obekt</th><th>Kod</th><th>Zakazlar</th><th>Jami</th><th>Mijozlar</th><th></th></tr>${sourceRows || `<tr><td colspan="6">Ma'lumot yo'q</td></tr>`}</table></div>`, { admin:true }));
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

async function initAndStart() {
  await initDb();
  return app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
}

module.exports = { app, initDb, initAndStart, q };
