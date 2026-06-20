import { useEffect, useMemo, useState } from "react";

const DISMISS_KEY = "myledger.installPrompt.dismissed.v1";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function isIosSafari() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(ua) && /safari/.test(ua) && !/crios|fxios|edgios/.test(ua);
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

function getDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function setDismissedFlag() {
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // Ignore storage failures; the prompt can still be dismissed in memory.
  }
}

export default function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(getDismissed);
  const [installed, setInstalled] = useState(() => typeof window !== "undefined" && isStandalone());
  const iosSafari = useMemo(isIosSafari, []);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
      setDismissedFlag();
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (dismissed || installed || (!installEvent && !iosSafari)) return null;

  const dismiss = () => {
    setDismissedFlag();
    setDismissed(true);
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") dismiss();
    setInstallEvent(null);
  };

  return (
    <div className="ldg-install-prompt">
      <div>
        <strong>홈 화면에 추가</strong>
        <span>{iosSafari ? "공유 버튼을 누른 뒤 홈 화면에 추가를 선택하세요." : "설치하면 앱처럼 바로 열 수 있어요."}</span>
      </div>
      <div className="ldg-install-actions">
        {installEvent && (
          <button type="button" onClick={install}>
            설치
          </button>
        )}
        <button type="button" onClick={dismiss} aria-label="설치 안내 닫기">
          닫기
        </button>
      </div>
    </div>
  );
}
