function createWebController(ctx) {
  return {
    register(app) {
  const {
    validate,
    upload,
    pool,
    q,
    resolveLocation,
    calculateDeliveryFromLocation,
    createTelegramService,
    tg,
    decodeBatchToken,
    sourceMeta,
    openWebAppButton,
    normalizeTelegramTarget,
    statusLabel,
    updateGroupOrderMessage,
    sendReceiptNotifications,
    verifyTelegramInitData,
    ensureBindToken,
    TELEGRAM_GROUP_CHAT_ID,
    createTelegramController,
    statusActionSig,
    createTelegramRouter,
    apiRouter,
    getSourceCode,
    isSecureRequest,
    secureCookieOptions,
    cartSessionId,
    cartCount,
    esc,
    page,
    isAdmin,
    telegramAutoBindScript,
    money,
    paymentProviderLink,
    normalizePaymentType,
    normalizePaymentProvider,
    saveImage,
    nextOrderBatchId,
    sendAcceptedMessage,
    getBatchSummary,
    telegramOrderText,
    sendOrderToGroup,
    sourceBadge,
    cartItemHtml,
    getCartItems,
    DELIVERY_FEE,
  } = ctx;

app.post("/delivery/calc", validate((body) => { const hasCoords = String(body.latitude || "").trim() && String(body.longitude || "").trim(); const hasText = String(body.location_url || "").trim() || String(body.address_text || "").trim(); return (hasCoords || hasText) ? null : "Lokatsiya yoki manzil kiriting"; }), async (req, res) => {
  try {
    const location = resolveLocation(req.body.latitude, req.body.longitude, req.body.location_url, req.body.address_text);
    if (!location.lat || !location.lng) return res.status(400).json({ ok: false, message: "Lokatsiya topilmadi" });
    const calc = calculateDeliveryFromLocation(location.lat, location.lng);
    return res.json({ ok: true, distance_km: calc.distanceKm, delivery_fee: calc.deliveryFee, location_url: location.locationUrl });
  } catch (e) {
    return res.status(500).json({ ok: false, message: e.message || "Xatolik" });
  }
});


app.get("/", async (req, res, next) => { try {
  const sourceCode = getSourceCode(req);
  if (sourceCode) {
    const meta = sourceMeta(sourceCode);
    res.cookie("source_code", meta.code, secureCookieOptions(req, 1000 * 60 * 60 * 24 * 30));
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

app.post("/order/:id", upload.single("payment_proof"), validate((body) => { if (Number(body.qty || 0) < 1) return "Soni 1 dan katta bo'lishi kerak"; if (String(body.phone || "").trim().length < 3) return "Telefon raqam kiriting"; return null; }), async (req, res, next) => { const client = await pool.connect(); try {
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

app.post("/cart/update/:id", validate((body) => Number(body.qty || 0) >= 1 ? null : "Soni 1 dan katta bo'lishi kerak"), async (req, res, next) => { try {
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

app.post("/checkout", upload.single("payment_proof"), validate((body) => String(body.phone || "").trim().length >= 3 ? null : "Telefon raqam kiriting"), async (req, res, next) => { const client = await pool.connect(); try {
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





    },
  };
}

module.exports = { createWebController };
