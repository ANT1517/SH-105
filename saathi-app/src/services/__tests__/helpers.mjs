// Shared test helpers: a fake fetch that records calls and answers from a routing table.

export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/**
 * Installs a fake global fetch. `routes` maps "METHOD /path" (path without query) to a body, a [body, status]
 * pair, a function (url, init) => Response, or an Error to throw (network failure).
 * Returns { calls, restore }.
 */
export function installFetch(routes) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const u = new URL(url);
    const method = (init.method || 'GET').toUpperCase();
    const key = `${method} ${u.pathname}`;
    calls.push({ key, url: String(url), origin: u.origin, method, query: Object.fromEntries(u.searchParams), body: typeof init.body === 'string' ? JSON.parse(init.body) : init.body });
    if (!(key in routes)) throw new Error(`unexpected request in test: ${key}`);
    const route = routes[key];
    if (route instanceof Error) throw route;
    if (typeof route === 'function') return route(url, init);
    if (Array.isArray(route)) return jsonResponse(route[0], route[1]);
    return jsonResponse(route);
  };
  return { calls, restore: () => { globalThis.fetch = original; } };
}

export function withEnv(vars, fn) {
  const saved = {};
  for (const k of Object.keys(vars)) {
    saved[k] = process.env[k];
    if (vars[k] === undefined) delete process.env[k]; else process.env[k] = vars[k];
  }
  const restore = () => { for (const k of Object.keys(saved)) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } };
  try {
    const out = fn();
    if (out && typeof out.then === 'function') return out.finally(restore);
    restore();
    return out;
  } catch (e) { restore(); throw e; }
}

// A realistic Person B response for meera_001 (captured shape from the live API).
export const LIVE_STATE = {
  user_id: 'meera_001',
  pots: { cash: 2000, bank: 5000, shg: 2500, chit_committed: 4000, post_office: 5000 },
  total_balance: 18500,
  business: { activity: 'pickle sales + tailoring', last_entry: { revenue: 1000, cost: 600, profit: 400 } },
  goal: { name: 'Education', target: 20000, saved: 8000 },
  recent_transactions: [],
  updated_at: '2026-09-18T22:53:47.234Z',
};

export const RECORDED_RESPONSE = {
  status: 'success',
  transaction: { tx_type: 'income', amount: 800, category: 'tailoring', target_pot: 'business' },
  pot_affected: 'business',
  updated_financial_state: { ...LIVE_STATE, pots: { ...LIVE_STATE.pots, business: 800 } },
};
