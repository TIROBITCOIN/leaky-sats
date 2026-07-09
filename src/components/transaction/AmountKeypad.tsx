import { useEffect } from "react";
import { createPortal } from "react-dom";
import { formatKrwInput, parseDigits } from "../../lib/format";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "back", "0", "done"] as const;

interface Props {
  open: boolean;
  value: string;
  onChange: (next: string) => void;
  onClose: () => void;
}

/**
 * iPhone 네이티브 숫자 키패드 대신 하단 고정 커스텀 키패드.
 * readOnly 금액 필드와 함께 써서 시스템 키보드가 화면을 가리지 않게 한다.
 */
export default function AmountKeypad({ open, value, onChange, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    document.body.classList.add("ldg-amount-keypad-open");
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.classList.remove("ldg-amount-keypad-open");
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const digits = parseDigits(value);

  const press = (key: (typeof KEYS)[number]) => {
    if (key === "done") {
      onClose();
      return;
    }
    if (key === "back") {
      onChange(formatKrwInput(digits.slice(0, -1)));
      return;
    }
    // 과도한 자릿수 방지 (억원 단위 이상 가계부 입력은 비현실적)
    if (digits.length >= 12) return;
    const next = digits === "0" ? key : digits + key;
    onChange(formatKrwInput(next));
  };

  return createPortal(
    <div className="ldg-amount-keypad-root" role="group" aria-label="금액 키패드">
      <button type="button" className="ldg-amount-keypad-scrim" aria-label="키패드 닫기" onClick={onClose} />
      <div className="ldg-amount-keypad">
        <div className="ldg-amount-keypad-grid">
          {KEYS.map((key) => {
            if (key === "back") {
              return (
                <button
                  key={key}
                  type="button"
                  className="ldg-amount-key ldg-amount-key-action"
                  aria-label="지우기"
                  onClick={() => press(key)}
                >
                  ⌫
                </button>
              );
            }
            if (key === "done") {
              return (
                <button
                  key={key}
                  type="button"
                  className="ldg-amount-key ldg-amount-key-done"
                  onClick={() => press(key)}
                >
                  완료
                </button>
              );
            }
            return (
              <button
                key={key}
                type="button"
                className="ldg-amount-key"
                onClick={() => press(key)}
              >
                {key}
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
