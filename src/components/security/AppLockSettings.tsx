import { useEffect, useState, type FormEvent } from "react";
import {
  APP_LOCK_AUTO_LOCK_MS,
  changeAppLockPin,
  disableAppLock,
  isAppLockEnabled,
  isAppLockSupported,
  isPinFormatValid,
  setupAppLock,
} from "../../lib/appLock";

export default function AppLockSettings() {
  const [enabled, setEnabled] = useState(false);
  const [setupPin, setSetupPin] = useState("");
  const [setupConfirm, setSetupConfirm] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [nextPin, setNextPin] = useState("");
  const [nextConfirm, setNextConfirm] = useState("");
  const [message, setMessage] = useState("");
  const supported = isAppLockSupported();

  useEffect(() => {
    setEnabled(isAppLockEnabled());
  }, []);

  const normalizePin = (value: string) => value.replace(/\D/g, "").slice(0, 6);

  const handleSetup = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    if (!supported) {
      setMessage("이 브라우저에서는 Web Crypto 기반 앱 잠금을 사용할 수 없습니다.");
      return;
    }
    if (!isPinFormatValid(setupPin) || setupPin !== setupConfirm) {
      setMessage("숫자 4~6자리 PIN을 두 번 동일하게 입력하세요.");
      return;
    }
    try {
      await setupAppLock(setupPin);
      setEnabled(true);
      setSetupPin("");
      setSetupConfirm("");
      setMessage("앱 잠금을 켰습니다. 다음 실행부터 PIN이 필요합니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "앱 잠금 설정에 실패했습니다.");
    }
  };

  const handleChange = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    if (!isPinFormatValid(nextPin) || nextPin !== nextConfirm) {
      setMessage("새 PIN은 숫자 4~6자리이며 확인값과 같아야 합니다.");
      return;
    }
    try {
      await changeAppLockPin(currentPin, nextPin);
      setCurrentPin("");
      setNextPin("");
      setNextConfirm("");
      setMessage("PIN을 변경했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "PIN 변경에 실패했습니다.");
    }
  };

  const handleDisable = async () => {
    setMessage("");
    try {
      await disableAppLock(currentPin);
      setEnabled(false);
      setCurrentPin("");
      setNextPin("");
      setNextConfirm("");
      setMessage("앱 잠금을 껐습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "앱 잠금 해제에 실패했습니다.");
    }
  };

  const lockNow = () => {
    window.dispatchEvent(new Event("myledger-lock-now"));
  };

  return (
    <div className="ldg-card">
      <div className="ldg-label" style={{ marginBottom: 10 }}>
        앱 잠금
      </div>
      <div className="ldg-setting-desc" style={{ marginBottom: 12 }}>
        서버 로그인 없이 이 기기에서만 쓰는 로컬 PIN 잠금입니다. 자동 잠금 시간은{" "}
        {Math.round(APP_LOCK_AUTO_LOCK_MS / 60000)}분입니다.
      </div>

      {!enabled ? (
        <form className="ldg-security-form" onSubmit={handleSetup}>
          <input
            className="ldg-input"
            value={setupPin}
            onChange={(event) => setSetupPin(normalizePin(event.target.value))}
            inputMode="numeric"
            type="password"
            maxLength={6}
            placeholder="새 PIN 4~6자리"
          />
          <input
            className="ldg-input"
            value={setupConfirm}
            onChange={(event) => setSetupConfirm(normalizePin(event.target.value))}
            inputMode="numeric"
            type="password"
            maxLength={6}
            placeholder="새 PIN 확인"
          />
          <button className="ldg-submit-btn" type="submit">
            앱 잠금 켜기
          </button>
        </form>
      ) : (
        <form className="ldg-security-form" onSubmit={handleChange}>
          <input
            className="ldg-input"
            value={currentPin}
            onChange={(event) => setCurrentPin(normalizePin(event.target.value))}
            inputMode="numeric"
            type="password"
            maxLength={6}
            placeholder="현재 PIN"
          />
          <input
            className="ldg-input"
            value={nextPin}
            onChange={(event) => setNextPin(normalizePin(event.target.value))}
            inputMode="numeric"
            type="password"
            maxLength={6}
            placeholder="새 PIN 4~6자리"
          />
          <input
            className="ldg-input"
            value={nextConfirm}
            onChange={(event) => setNextConfirm(normalizePin(event.target.value))}
            inputMode="numeric"
            type="password"
            maxLength={6}
            placeholder="새 PIN 확인"
          />
          <div className="ldg-security-actions">
            <button className="ldg-submit-btn" type="submit">
              PIN 변경
            </button>
            <button className="ldg-secondary-btn" type="button" onClick={handleDisable}>
              앱 잠금 끄기
            </button>
          </div>
          <button className="ldg-secondary-btn" type="button" onClick={lockNow}>
            지금 잠그기
          </button>
        </form>
      )}

      {message ? <div className="ldg-security-status">{message}</div> : null}
    </div>
  );
}
