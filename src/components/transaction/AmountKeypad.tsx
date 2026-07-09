import { useCallback, useEffect, useMemo, type MouseEvent, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import { formatKrwInput, parseDigits } from "../../lib/format";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "back", "0", "done"] as const;

interface Props {
  open: boolean;
  value: string;
  onChange: (next: string) => void;
  onClose: () => void;
}

function getPortalRoot(): HTMLElement {
  // app-frame 안에 붙여 탭바와 같은 스택 컨텍스트에서 탭바를 덮는다.
  // body에 붙이면 모바일에서 하단 탭으로 클릭이 새는 경우가 있다.
  return (
    (document.querySelector(".app-frame") as HTMLElement | null) ??
    document.body
  );
}

/**
 * 하단 고정 커스텀 숫자 키패드.
 * iOS: pointerdown+preventDefault 는 아래 탭바(NavLink)로 클릭이 통과해
 * 설정 화면으로 이동하는 버그가 있으므로, click + stopPropagation 만 사용한다.
 */
export default function AmountKeypad({ open, value, onChange, onClose }: Props) {
  const portalRoot = useMemo(() => (typeof document !== "undefined" ? getPortalRoot() : null), [open]);

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
      if (digits.length >= 12) return;
      const next = digits === "0" ? key : digits + key;
      onChange(formatKrwInput(next));
    },
    [value, onChange, onClose]
  );

  /** 탭바/하위 링크로 이벤트가 새지 않도록 전부 차단 */
  const trap = useCallback((event: SyntheticEvent) => {
    event.stopPropagation();
  }, []);

  const onKeyClick = useCallback(
    (key: (typeof KEYS)[number]) => (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      press(key);
    },
    [press]
  );

  if (!open || !portalRoot) return null;

  return createPortal(
    <div
      className="ldg-amount-keypad-root"
      role="dialog"
      aria-modal="true"
      aria-label="금액 키패드"
      onClick={trap}
      onPointerDown={trap}
      onMouseDown={trap}
      onTouchStart={trap}
    >
      <button
        type="button"
        className="ldg-amount-keypad-scrim"
        aria-label="키패드 닫기"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }}
      />
      <div
        className="ldg-amount-keypad"
        onClick={trap}
        onPointerDown={trap}
        onMouseDown={trap}
        onTouchStart={trap}
      >
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
                  onClick={onKeyClick(key)}
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
                  onClick={onKeyClick(key)}
                >
                  완료
                </button>
              );
            }
            return (
              <button key={key} type="button" className="ldg-amount-key" onClick={onKeyClick(key)}>
                {key}
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    portalRoot
  );
}
