import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  APP_LOCK_AUTO_LOCK_MS,
  isAppLockEnabled,
  isAppLockSupported,
  verifyAppLockPin,
} from "../../lib/appLock";

export default function AppLockGate({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(() => isAppLockEnabled());
  const [unlocked, setUnlocked] = useState(() => !isAppLockEnabled());
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [failCount, setFailCount] = useState(0);
  const hiddenAtRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const lockNow = useCallback(() => {
    if (!isAppLockEnabled()) {
      setEnabled(false);
      setUnlocked(true);
      return;
    }
    setEnabled(true);
    setUnlocked(false);
    setPin("");
    setError("");
  }, []);

  useEffect(() => {
    const onLockNow = () => lockNow();
    window.addEventListener("myledger-lock-now", onLockNow);
    return () => window.removeEventListener("myledger-lock-now", onLockNow);
  }, [lockNow]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
        return;
      }

      const hiddenAt = hiddenAtRef.current;
      hiddenAtRef.current = null;
      if (hiddenAt && Date.now() - hiddenAt >= APP_LOCK_AUTO_LOCK_MS) {
        lockNow();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [lockNow]);

  useEffect(() => {
    if (enabled && !unlocked) inputRef.current?.focus();
  }, [enabled, unlocked]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!isAppLockSupported()) {
      setError("이 브라우저에서는 앱 잠금을 사용할 수 없습니다.");
      return;
    }

    const ok = await verifyAppLockPin(pin);
    if (!ok) {
      setFailCount((count) => count + 1);
      setError("PIN이 올바르지 않습니다.");
      setPin("");
      inputRef.current?.focus();
      return;
    }

    setUnlocked(true);
    setError("");
    setFailCount(0);
    setPin("");
  };

  if (!enabled || unlocked) return <>{children}</>;

  return (
    <div className="ldg-lock-screen" role="dialog" aria-modal="true" aria-labelledby="app-lock-title">
      <form className="ldg-lock-card" onSubmit={handleSubmit}>
        <div className="ldg-lock-mark">₿</div>
        <h1 id="app-lock-title" className="ldg-lock-title">
          My Ledger
        </h1>
        <p className="ldg-lock-sub">이 기기에서 설정한 PIN을 입력하세요.</p>
        <input
          ref={inputRef}
          className="ldg-lock-input"
          value={pin}
          onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="current-password"
          type="password"
          maxLength={6}
          placeholder="PIN"
          aria-label="앱 잠금 PIN"
        />
        {error ? <div className="ldg-lock-error">{error}</div> : null}
        {failCount > 0 ? <div className="ldg-lock-note">실패 {failCount}회</div> : null}
        <button className="ldg-submit-btn" type="submit">
          잠금 해제
        </button>
        <p className="ldg-lock-note">
          이 비밀번호는 이 기기에서만 작동합니다. 잊어버리면 브라우저 데이터를 초기화해야 할 수 있습니다.
        </p>
      </form>
    </div>
  );
}
