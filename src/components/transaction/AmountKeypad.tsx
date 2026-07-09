import { useCallback, useEffect } from "react";
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
 * 금액 표시는 <input>이 아닌 button과 짝을 이뤄 시스템 키보드를 원천 차단한다.
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
    // iOS PWA: 배경 스크롤 잠금
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.classList.remove("ldg-amount-keypad-open");
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  const press = useCallback(
    (key: (typeof KEYS)[number]) => {
      if (key === "done") {
        onClose();
        return;
      }
      const digits = parseDigits(value);
      if (key === "back") {
        onChange(formatKrwInput(digits.slice(0, -1)));
        return;
      }
      // 과도한 자릿수 방지 (억원 단위 이상 가계부 입력은 비현실적)
      if (digits.length >= 12) return;
      const next = digits === "0" ? key : digits + key;
      onChange(formatKrwInput(next));
    },
    [value, onChange, onClose]
  );

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="ldg-amount-keypad-root" role="dialog" aria-modal="true" aria-label="금액 키패드">
      <button type="button" className="ldg-amount-keypad-scrim" aria-label="키패드 닫기" onClick={onClose} />
      <div className="ldg-amount-keypad">
        <div className="ldg-amount-keypad-hint">금액을 입력하세요</div>
        <div className="ldg-amount-keypad-grid">
          {KEYS.map((key) => {
            if (key === "back") {
              return (
                <button
                  key={key}
                  type="button"
                  className="ldg-amount-key ldg-amount-key-action"
                  aria-label="지우기"
                  onPointerDown={(event) => {
                    // iOS에서 click 지연/유실을 줄이기 위해 pointer로 즉시 처리
                    event.preventDefault();
                    press(key);
                  }}
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
                  onPointerDown={(event) => {
                    event.preventDefault();
                    press(key);
                  }}
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
                onPointerDown={(event) => {
                  event.preventDefault();
                  press(key);
                }}
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
