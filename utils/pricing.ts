// What OutNYC's outside services cost. Checked October 2026 — prices change,
// so confirm on the pages below before relying on them.

// Google Places "Nearby Search Enterprise" (OutNYC asks for rating, price level
// and opening hours, which puts every search in this tier).
// https://developers.google.com/maps/billing-and-pricing/pricing
export const GOOGLE = {
  perSearch: 35 / 1000, // $35 per 1,000 searches
  freePerMonth: 1000, // first 1,000 searches each month are free
  ourDailyCap: 30, // OutNYC's own limit (google_usage)
};

// Gemini 2.5 Flash, paid tier. OutNYC uses the free tier today, so the real cost is $0;
// this is "what it would cost if we paid".
// https://ai.google.dev/gemini-api/docs/pricing
export const GEMINI = {
  perInputToken: 0.3 / 1_000_000, // $0.30 per 1M tokens in
  perOutputToken: 2.5 / 1_000_000, // $2.50 per 1M tokens out
  charsPerToken: 4, // rough rule of thumb for English text
};

// 0 → "$0.00", $0.0012 → "$0.0012", $3.5 → "$3.50"
export function money(dollars: number) {
  if (dollars === 0) return "$0.00";
  if (dollars < 0.01) return `$${dollars.toPrecision(2)}`;
  return `$${dollars.toFixed(2)}`;
}
