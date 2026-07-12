import { Link } from "react-router-dom";
import "../../styles/ledger.css";
import { APP_META } from "../../constants/appMeta";

export default function HelpPage() {
  return (
    <div className="ldg-screen">
      <div className="ldg-content">
        <div className="ldg-page-title">도움말</div>

        <div className="ldg-card ldg-help-important">
          <div className="ldg-setting-label">꼭 기억할 것</div>
          <ul className="ldg-help-list">
            <li>이 앱은 가계부입니다. 실제 비트코인을 사고팔지 않습니다.</li>
            <li>데이터는 이 기기 브라우저에만 저장됩니다. 백업 없이 삭제하면 복구할 수 없습니다.</li>
            <li>암호화 백업 비밀번호를 잊으면 복원할 수 없습니다.</li>
          </ul>
        </div>

        <section className="ldg-card ldg-help-section">
          <div className="ldg-setting-label">사용법</div>
          <ol className="ldg-onboarding-steps">
            <li>설정에서 보유 BTC 입력 또는 공개키(xpub) 등록</li>
            <li>정산 기준일 설정</li>
            <li>수입/지출 입력, 반복 항목 등록</li>
            <li>정기적으로 백업</li>
          </ol>
        </section>

        <section className="ldg-card ldg-help-section">
          <div className="ldg-setting-label">참고</div>
          <ul className="ldg-help-list">
            <li>정산기간: 기준일부터 다음 달 전날까지가 한 달입니다.</li>
            <li>"판매해야 하는 비트코인" 카드는 부족액을 시세로 환산해 보여줄 뿐, 실제 매도 기능이 아닙니다.</li>
            <li>시세가 지연되면 김프 계산이 잠시 보류될 수 있습니다. 앱 고장이 아닙니다.</li>
          </ul>
        </section>

        <Link className="ldg-submit-btn secondary ldg-help-back" to="/settings">
          설정으로 돌아가기
        </Link>

        <div className="ldg-help-footer">
          이 앱은 {APP_META.ownerName}이 만든 Bitcoin-first 개인 가계부입니다.<br />
          Original source:{" "}
          <a href={APP_META.repositoryUrl} target="_blank" rel="noopener noreferrer" className="ldg-link">
            {APP_META.repositoryUrl}
          </a><br />
          {APP_META.copyright}
        </div>
      </div>
    </div>
  );
}
