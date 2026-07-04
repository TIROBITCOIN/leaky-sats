import type { Currency } from "../../types";

export default function CurrencyToggle({
  value,
  onChange,
}: {
  value: Currency;
  onChange: (c: Currency) => void;
}) {
  return (
    <div className="ldg-toggle" role="tablist">
      <button
        className={`ldg-toggle-btn ${value === "KRW" ? "active krw" : ""}`}
        onClick={() => onChange("KRW")}
        role="tab"
        aria-selected={value === "KRW"}
      >
        <span className="ldg-toggle-glyph">원</span> KRW
      </button>
      <button
        className={`ldg-toggle-btn ${value === "BTC" ? "active btc" : ""}`}
        onClick={() => onChange("BTC")}
        role="tab"
        aria-selected={value === "BTC"}
      >
        <span className="ldg-toggle-glyph">₿</span> Bitcoin
      </button>
    </div>
  );
}
