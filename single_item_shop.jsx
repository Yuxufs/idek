// SingleItemShop.jsx
// Single-file React component (default export) you can drop into a React app (create-react-app, Vite, Next page, etc.)
// Purpose: a minimal single-digital-item storefront (easy to host) for testing a sniper bot.
// Features:
// - Shows one digital item with an on-page stock counter (#stock-count) that bots commonly scrape.
// - "Buy" button that decrements stock (simulated purchase).
// - Admin quick controls (click the gear or visit with ?admin=1) to change stock amount.
// - Persists stock in localStorage so you can change it and the page keeps state.
// - Exposes simple client-side "purchase" flow that a bot can mimic by POSTing to a server you add later.

import React, { useEffect, useState } from "react";

export default function SingleItemShop() {
  const STORAGE_KEY = "single-item-stock-v1";
  const DEFAULT_STOCK = 1; // change default here if you want

  const [stock, setStock] = useState(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      return v !== null ? Number(v) : DEFAULT_STOCK;
    } catch (e) {
      return DEFAULT_STOCK;
    }
  });
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState("");
  const [showAdmin, setShowAdmin] = useState(() => new URLSearchParams(window.location.search).has("admin"));

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(stock));
  }, [stock]);

  // Useful: this makes the stock count available in a JSON-like endpoint if you append ?json=1 to the URL.
  // Example: https://your-site.com/?json=1 — the page still returns HTML, but bots that accept HTML can read the DOM;
  // some simpler bots may check the text inside #stock-count.

  const buy = (qty = 1) => {
    if (stock <= 0) {
      setMessage("Out of stock — purchase failed.");
      return false;
    }
    if (qty > stock) {
      setMessage(`Not enough stock (requested ${qty}, available ${stock}).`);
      return false;
    }
    // Simulate purchase
    setStock(prev => prev - qty);
    setMessage(`Success! Purchased ${qty} unit${qty > 1 ? "s" : ""}.`);
    // log to console for bots watching logs
    console.log("[SingleItemShop] PURCHASE simulated", { qty, remaining: stock - qty, time: new Date().toISOString() });
    return true;
  };

  const setStockAdmin = newStock => {
    const n = Number(newStock);
    if (!Number.isFinite(n) || n < 0) return;
    setStock(Math.floor(n));
    setMessage(`Stock set to ${Math.floor(n)}.`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
      <div className="max-w-lg w-full bg-white shadow-2xl rounded-2xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-extrabold">Pikachu Shiny Drop — Digital Item</h1>
            <p className="text-sm text-gray-500 mt-1">Test listing for your Pokémon sniper bot. One digital item in stock by default.</p>
          </div>
          <button
            aria-label="toggle-admin"
            title="Admin"
            onClick={() => setShowAdmin(s => !s)}
            className="p-2 rounded-full hover:bg-gray-100"
          >
            ⚙️
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div className="col-span-1">
            <div className="w-full h-40 bg-yellow-100 rounded-lg flex items-center justify-center text-6xl">⚡</div>
          </div>
          <div className="md:col-span-2">
            <div className="flex items-center gap-4">
              <div className="text-lg font-semibold">Pikachu — Shiny Test Drop</div>
              <div className="ml-auto">
                <span className="text-xs text-gray-500">Stock</span>
                <div id="stock-count" className={`mt-1 text-2xl font-bold ${stock > 0 ? "text-green-600" : "text-red-500"}`}>
                  {stock}
                </div>
              </div>
            </div>

            <p className="text-sm text-gray-600 mt-3">This is a digital .zip that contains a proof-of-concept shiny Pikachu image. Use this page to test detection and purchase flows of your sniper bot.</p>

            <div className="mt-4 flex items-center gap-3">
              <label className="flex items-center gap-2">
                <span className="text-sm">Qty</span>
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={e => setQuantity(Math.max(1, Number(e.target.value || 1)))}
                  className="w-20 p-2 border rounded-md"
                />
              </label>

              <button
                onClick={() => buy(quantity)}
                disabled={stock <= 0}
                className={`px-4 py-2 rounded-lg font-semibold shadow ${stock > 0 ? "bg-indigo-600 text-white hover:bg-indigo-700" : "bg-gray-200 text-gray-500 cursor-not-allowed"}`}
              >
                Buy now
              </button>

              <button
                onClick={() => { navigator.clipboard?.writeText(window.location.href); setMessage("Page URL copied — paste to your bot."); }}
                className="px-3 py-2 border rounded-lg text-sm"
              >
                Copy URL
              </button>
            </div>

            {message && <div className="mt-3 text-sm text-gray-700">{message}</div>}

            <div className="mt-4 text-xs text-gray-400">
              Tip: most sniper bots look for a DOM element or JSON endpoint. Point your bot to this page and watch the element <code>#stock-count</code>. You can also query the page HTML and parse that element.
            </div>
          </div>
        </div>

        {showAdmin && (
          <div className="mt-6 border-t pt-4">
            <h3 className="font-semibold">Admin — change stock</h3>
            <p className="text-xs text-gray-500">This is a simple on-page admin. For public testing, host this site and share the URL with your bot.</p>
            <div className="mt-3 flex items-center gap-2">
              <input type="number" min={0} defaultValue={stock} className="p-2 border rounded-md w-32" id="admin-stock-input" />
              <button
                onClick={() => {
                  const val = Number((document.getElementById("admin-stock-input") as HTMLInputElement).value || 0);
                  setStockAdmin(val);
                }}
                className="px-3 py-2 bg-green-600 text-white rounded-md"
              >
                Set stock
              </button>
              <button
                onClick={() => { localStorage.removeItem(STORAGE_KEY); setStock(DEFAULT_STOCK); setMessage("Reset to default stock."); }}
                className="px-3 py-2 border rounded-md"
              >
                Reset
              </button>
            </div>

            <div className="mt-3 text-xs text-gray-600">
              Advanced: to simulate a real store API, host a tiny server (example below) that returns a JSON {"stock": X} — your bot can poll that.
            </div>

            <pre className="mt-3 p-3 bg-gray-50 rounded text-xs overflow-auto">{`# Example (Express) endpoint:
// GET /api/stock -> { "stock": 3 }
app.get('/api/stock', (req, res) => res.json({ stock: currentStock }))

# Example bot check: GET /api/stock and buy by POST /api/purchase`}</pre>
          </div>
        )}

        <footer className="mt-6 text-xs text-gray-400">Single-item test shop — designed for testing sniper bots. No real payment integrated.</footer>
      </div>
    </div>
  );
}
