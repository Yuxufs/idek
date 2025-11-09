// server.js — Replit-ready single-file Node + Express app
// Paste this file into a new Replit Node project (filename: server.js)
// Replit run command: node server.js

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Simple in-memory stock. Admin can set this via /admin?key=YOURKEY or via admin UI
let currentStock = 1; // initial stock
const ADMIN_KEY = process.env.ADMIN_KEY || 'secret'; // set in Replit secrets for safety

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Helper: mask card number (keep first 6 and last 4 if long enough)
function maskCardNumber(number) {
  const s = String(number).replace(/\D/g, '');
  if (s.length <= 4) return '****';
  if (s.length <= 10) return '****' + s.slice(-4);
  return s.slice(0, 6) + s.slice(6, -4).replace(/./g, '*') + s.slice(-4);
}

// Basic Luhn check (client & server)
function luhnCheck(num) {
  const s = String(num).replace(/\D/g, '');
  let sum = 0;
  let shouldDouble = false;
  for (let i = s.length - 1; i >= 0; i--) {
    let digit = parseInt(s[i], 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

// API: get stock
app.get('/api/stock', (req, res) => {
  res.json({ stock: currentStock });
});

// API: simulated purchase (no payment) - expects { qty }
app.post('/api/purchase', (req, res) => {
  const qty = Math.max(1, Number(req.body.qty || 1));
  if (currentStock <= 0) return res.status(400).json({ ok: false, message: 'Out of stock' });
  if (qty > currentStock) return res.status(400).json({ ok: false, message: 'Not enough stock' });
  currentStock -= qty;
  console.log('[SIM PURCHASE] qty=', qty, 'remaining=', currentStock);
  return res.json({ ok: true, stock: currentStock });
});

// API: simulated checkout (DOES NOT PROCESS PAYMENT). Accepts card form fields but does not store full numbers.
app.post('/api/checkout', (req, res) => {
  const { name, cardNumber, expiry, cvc, qty } = req.body || {};
  const quantity = Math.max(1, Number(qty || 1));

  if (currentStock <= 0) return res.status(400).json({ ok: false, message: 'Out of stock' });
  if (quantity > currentStock) return res.status(400).json({ ok: false, message: 'Not enough stock' });

  // Validate minimal fields
  if (!name || !cardNumber || !expiry || !cvc) return res.status(400).json({ ok: false, message: 'Missing fields' });

  // Basic format checks
  const cardDigits = String(cardNumber).replace(/\D/g, '');
  if (cardDigits.length < 12 || cardDigits.length > 19 || !luhnCheck(cardDigits)) {
    return res.status(400).json({ ok: false, message: 'Card number failed basic validation (Luhn) — use test card numbers only' });
  }

  // cvc basic check
  const cvcDigits = String(cvc).replace(/\D/g, '');
  if (cvcDigits.length < 3 || cvcDigits.length > 4) return res.status(400).json({ ok: false, message: 'Invalid CVC' });

  // expiry mm/yy or mm/yyyy
  if (!/^\s*\d{1,2}\s*\/\s*\d{2,4}\s*$/.test(String(expiry))) return res.status(400).json({ ok: false, message: 'Invalid expiry format' });

  // At this point, we simulate success. **We DO NOT store the raw card number or CVC.**
  const masked = maskCardNumber(cardNumber);

  // Important: log only masked card info and name (name is not secret), DO NOT persist anywhere.
  console.log('[SIM CHECKOUT]', { name, card: masked, expiry, qty: quantity, time: new Date().toISOString() });

  // Decrement stock as if purchase succeeded
  currentStock -= quantity;

  // Respond with success and only return non-sensitive info
  return res.json({ ok: true, message: 'Checkout simulated (no real payment). Use test cards only.', stock: currentStock });
});

// Admin page (very simple auth by query key). Do NOT use in production.
app.get('/admin', (req, res) => {
  const key = req.query.key || '';
  if (key !== ADMIN_KEY) {
    return res.status(401).send('<h3>Unauthorized</h3><p>Provide ?key=YOURKEY</p>');
  }

  res.send(`<!doctype html>
  <html>
  <head><meta charset="utf-8"><title>Admin — Set Stock</title></head>
  <body style="font-family:system-ui,Arial;line-height:1.5;padding:20px;">
    <h2>Admin Panel</h2>
    <p>Current stock: <strong id="stock">${currentStock}</strong></p>
    <label>Set stock: <input id="newstock" type="number" min="0" value="${currentStock}" /></label>
    <button id="set">Set</button>
    <button id="reset">Reset to 1</button>

    <script>
      document.getElementById('set').onclick = async () => {
        const v = Number(document.getElementById('newstock').value || 0);
        const r = await fetch('/api/admin/set-stock', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ key:'${ADMIN_KEY}', stock: v }) });
        const j = await r.json();
        document.getElementById('stock').innerText = j.stock;
        alert('Updated');
      }
      document.getElementById('reset').onclick = async () => {
        const r = await fetch('/api/admin/set-stock', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ key:'${ADMIN_KEY}', stock: 1 }) });
        const j = await r.json();
        document.getElementById('stock').innerText = j.stock;
        alert('Reset');
      }
    </script>
  </body>
  </html>`);
});

// Admin API to set stock
app.post('/api/admin/set-stock', (req, res) => {
  const { key, stock } = req.body || {};
  if (key !== ADMIN_KEY) return res.status(401).json({ ok: false, message: 'bad key' });
  const n = Math.max(0, Math.floor(Number(stock) || 0));
  currentStock = n;
  console.log('[ADMIN] stock set to', currentStock);
  res.json({ ok: true, stock: currentStock });
});

// Front page — simple HTML with #stock-count and Buy button that posts to /api/purchase
app.get('/', (req, res) => {
  res.send(`<!doctype html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Poke Test Drop</title>
    <style>
      body{font-family:system-ui,Arial;margin:0;padding:24px;background:#f7fbff}
      .card{max-width:760px;margin:24px auto;background:white;padding:20px;border-radius:12px;box-shadow:0 6px 20px rgba(20,30,60,0.08)}
      .stock{font-size:28px;font-weight:700}
      button{padding:8px 12px;border-radius:8px;border:0;background:#2563eb;color:white}
      .btn-muted{background:#e5e7eb;color:#111}
      input[type=number]{width:72px;padding:6px;border-radius:6px;border:1px solid #ddd}
      pre{background:#f3f4f6;padding:8px;border-radius:6px}
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Pikachu Shiny Drop — Test Item</h1>
      <p>This page exposes <code id="stock-count">${currentStock}</code> as the stock counter for your sniper bot to scrape.</p>
      <div style="display:flex;gap:12px;align-items:center;margin-top:12px;">
        <label>Qty <input id="qty" type="number" min="1" value="1" /></label>
        <button id="buy">Buy (simulate)</button>
        <button id="checkout" class="btn-muted">Go to Checkout</button>
        <button id="copy">Copy URL</button>
      </div>
      <p style="margin-top:12px;color:#555">Tip: point your bot at <code>/api/stock</code> or parse the DOM element <code>#stock-count</code>.</p>
      <hr />
      <h3>Example API check</h3>
      <pre id="apiout">GET /api/stock -> { stock: ${currentStock} }</pre>
    </div>

    <script>
      async function updateStockUI(){
        const r = await fetch('/api/stock');
        const j = await r.json();
        document.getElementById('stock-count').innerText = j.stock;
        document.getElementById('apiout').innerText = 'GET /api/stock -> ' + JSON.stringify(j);
      }
      document.getElementById('buy').onclick = async () => {
        const qty = Number(document.getElementById('qty').value || 1);
        const r = await fetch('/api/purchase',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({ qty })});
        const j = await r.json();
        if (!j.ok) return alert('Error: '+(j.message||JSON.stringify(j)));
        updateStockUI();
        alert('Simulated purchase OK');
      };
      document.getElementById('checkout').onclick = () => window.location.href = '/checkout';
      document.getElementById('copy').onclick = async () => { await navigator.clipboard.writeText(window.location.href); alert('URL copied'); };

      // Poll stock every 3s so bots watching page can see live changes
      setInterval(updateStockUI, 3000);
    </script>
  </body>
  </html>`);
});

// Checkout page — contains form fields that bots must fill. We include client-side Luhn but no real submission to payment providers.
app.get('/checkout', (req, res) => {
  res.send(`<!doctype html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Checkout - Test</title>
    <style>body{font-family:system-ui,Arial;padding:20px;background:#fff} .wrap{max-width:640px;margin:0 auto} label{display:block;margin:10px 0} input{padding:8px;border-radius:6px;border:1px solid #ccc;width:100%} button{padding:10px 14px;border-radius:8px;border:0;background:#10b981;color:white}</style>
  </head>
  <body>
    <div class="wrap">
      <h2>Checkout (Test only)</h2>
      <p style="color:#b91c1c">Important: Do <strong>not</strong> enter real card details. Use test card numbers such as 4242 4242 4242 4242.</p>
      <form id="checkoutForm">
        <label>Full name <input name="name" required /></label>
        <label>Card number <input name="cardNumber" id="cardNumber" required placeholder="4242 4242 4242 4242" /></label>
        <label>Expiry (MM/YY) <input name="expiry" required placeholder="08/27" /></label>
        <label>CVC <input name="cvc" required placeholder="123" /></label>
        <label>Qty <input name="qty" id="qty" type="number" min="1" value="1" /></label>
        <button type="submit">Simulate payment</button>
      </form>
      <div id="result" style="margin-top:12px;color:#064e3b"></div>
    </div>

    <script>
      function luhnCheck(num){
        const s = String(num).replace(/\D/g,'');
        let sum=0, dbl=false;
        for(let i=s.length-1;i>=0;i--){let d=+s[i]; if(dbl){d*=2; if(d>9)d-=9;} sum+=d; dbl=!dbl;}
        return sum%10===0;
      }
      document.getElementById('checkoutForm').onsubmit = async (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        const payload = Object.fromEntries(f.entries());
        const card = String(payload.cardNumber||'').replace(/\s+/g,'');
        if(!luhnCheck(card)){ alert('Card number failed basic Luhn check. Use a test card like 4242 4242 4242 4242.'); return; }
        // POST to server which will mask and discard card data
        const res = await fetch('/api/checkout',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
        const j = await res.json();
        if(!j.ok){ document.getElementById('result').innerText = 'Error: ' + (j.message||JSON.stringify(j)); return; }
        document.getElementById('result').innerText = j.message + ' Remaining stock: ' + j.stock;
      };
    </script>
  </body>
  </html>`);
});

// Start server
app.listen(PORT, () => console.log(`Server running on port ${PORT} — admin key: ${ADMIN_KEY} — open http://localhost:${PORT}`));
