import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/layout.css";

const DISMISS_KEY = "myledger.onboarding.dismissed.v1";
const SESSION_KEY = "myledger.onboarding.closedThisSession.v1";

function isDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function isClosedThisSession(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function isOnboardingVisible(): boolean {
  return !isDismissed() && !isClosedThisSession();
}

export default function OnboardingPrompt({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate();
  const [dontShowAgain, setDontShowAgain] = useState(false);

  if (!isOnboardingVisible()) return null;

  const handleClose = () => {
    try {
      if (dontShowAgain) {
        localStorage.setItem(DISMISS_KEY, "1");
      } else {
        sessionStorage.setItem(SESSION_KEY, "1");
      }
    } catch {
      // ignore storage errors
    }
    onDone();
  };

  const handleDetail = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
    onDone();
    navigate("/help");
  };

  return (
    <div className="ldg-modal-backdrop">
      <div className="ldg-modal-content">
        <div className="ldg-modal-title">사용방법</div>

        <ol className="ldg-onboarding-steps">
          <li>설정 탭에서 보유 BTC를 수동 입력하거나 지갑 동기화를 설정하세요.</li>
          <li>지갑 동기화는 내 노드의 self-hosted mempool API 주소가 필요합니다.</li>
          <li>정산 기준일을 설정하세요.</li>
          <li>수입과 지출을 입력하세요.</li>
          <li>매월 반복되는 항목은 반복 항목으로 등록하세요.</li>
          <li>데이터 보호를 위해 백업을 다운로드하세요.</li>
        </ol>

        <label className="ldg-modal-checkbox">
          <input
            type="checkbox"
            checked={dontShowAgain}
            onChange={(e) => setDontShowAgain(e.target.checked)}
          />
          <span>다시 보지 않기</span>
        </label>

        <div className="ldg-modal-actions">
          <button type="button" className="ldg-submit-btn secondary" onClick={handleClose}>
            닫기
          </button>
          <button type="button" className="ldg-submit-btn" onClick={handleDetail}>
            자세히 보기
          </button>
        </div>
      </div>
    </div>
  );
}
