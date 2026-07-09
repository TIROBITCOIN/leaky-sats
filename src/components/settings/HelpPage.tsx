import { Link } from "react-router-dom";
import "../../styles/ledger.css";
import { APP_META } from "../../constants/appMeta";

const HELP_SECTIONS = [
  {
    title: "이 앱은 무엇인가",
    body: [
      "원화 수입과 지출을 기록하고, 현재 BTC 시세 기준으로 비트코인과 sats 관점에서도 볼 수 있는 가계부입니다.",
      "은행이나 거래소와 자동으로 연결되는 앱이 아니며, 실제 비트코인을 사고팔지 않습니다.",
    ],
  },
  {
    title: "데이터는 어디에 저장되나",
    body: [
      "입력한 거래와 설정은 기본적으로 이 기기의 브라우저 localStorage에 저장됩니다.",
      "서버 계정, 로그인, 클라우드 동기화가 아니기 때문에 브라우저 데이터 삭제, 앱 삭제, 기기 변경 시 데이터가 사라질 수 있습니다.",
    ],
  },
  {
    title: "백업은 왜 필요한가",
    body: [
      "데이터를 지키려면 설정 화면에서 정기적으로 백업 파일을 다운로드해야 합니다.",
      "암호화 백업을 사용할 수 있지만, 비밀번호를 잊으면 복원이 어렵거나 불가능합니다.",
      "백업 파일은 본인이 안전한 곳에 보관해야 합니다.",
    ],
  },
  {
    title: "거래 입력 방법",
    body: [
      "수입은 더해지는 흐름, 지출은 빠져나가는 흐름으로 계산됩니다.",
      "거래에는 날짜, 금액, 카테고리, 메모를 입력할 수 있습니다.",
      "입력한 거래는 나중에 수정하거나 삭제할 수 있고, 삭제 직후에는 Undo로 되돌릴 수 있습니다.",
    ],
  },
  {
    title: "카테고리 설명",
    body: [
      "수입 카테고리는 들어온 돈, 지출 카테고리는 쓴 돈을 기록할 때 씁니다.",
      "DCA / BTC 매수, BTC 판매 같은 투자 카테고리는 생활비 정산 계산에서 일반 수입/지출과 다르게 취급될 수 있습니다.",
    ],
  },
  {
    title: "정산달 설명",
    body: [
      "설정한 정산 기준일에 따라 앱에서 말하는 이번 달 범위가 달라질 수 있습니다.",
      "예를 들어 기준일이 17일이면 6월 17일부터 7월 16일까지가 하나의 정산기간이 될 수 있습니다.",
    ],
  },
  {
    title: "판매해야 하는 비트코인 카드",
    body: [
      "수입보다 지출이 많을 때 부족한 금액을 현재 BTC 시세 기준으로 환산해 보여주는 카드입니다.",
      "실제 거래소 매도 명령을 내리는 기능이 아닙니다.",
      "판매 확정 시 받은 원화와 보낸 비트코인을 실측으로 기록합니다. 통계 카드에 실효 평균 매도가와 시세 대비 괴리가 표시됩니다.",
    ],
  },
  {
    title: "지갑 동기화 (와치온리)",
    body: [
      "설정에서 자가호스팅 mempool API와 xpub/주소를 등록하면 온체인 잔고로 보유 BTC를 맞출 수 있습니다.",
      "지갑 추가 시 '카메라로 QR 스캔'으로 와치온리 xpub QR을 불러올 수 있습니다. (HTTPS 필요, 권한 허용)",
      "개인키·시드는 저장하지 않습니다. xpub이 유출되면 자금 탈취는 어렵지만 거래 내역 프라이버시는 깨질 수 있습니다.",
      "백업 파일에 와치온리 정보가 포함될 수 있으니 안전하게 보관하세요.",
      "미확정(mempool) 잔고는 '확정 대기' 뱃지로 표시됩니다.",
    ],
  },
  {
    title: "반복 항목",
    body: [
      "월세, 보험료, 구독료, 고정수입처럼 매월 반복되는 항목을 등록할 수 있습니다.",
      "매월 금액이 달라질 수 있으므로 자동 확정이 아니라 이번 달 금액을 확인한 뒤 거래로 추가하는 방식입니다.",
    ],
  },
  {
    title: "시세와 김프 표시",
    body: [
      "앱은 BTC/KRW, BTC/USD, USD/KRW 같은 외부 시세를 사용합니다.",
      "시세 일부가 지연되면 김프 계산이 보류될 수 있습니다.",
      "시세 지연은 앱 고장이 아니라 외부 가격 데이터 일부가 늦게 들어오는 상태일 수 있습니다.",
    ],
  },
  {
    title: "자주 하는 실수",
    body: [
      "백업 없이 브라우저 데이터를 삭제하는 것",
      "임시 Vercel deployment URL로 QR 코드를 만드는 것",
      "암호화 백업 비밀번호를 잊는 것",
      "정산 기준일을 바꾼 뒤 기존 달 범위를 착각하는 것",
      "BTC 판매 카드가 실제 거래소 매도 기능이라고 오해하는 것",
      "와치온리 xpub이 들어 있는 백업 파일을 공유·유출하는 것",
    ],
  },
];

export default function HelpPage() {
  return (
    <div className="ldg-screen">
      <div className="ldg-content">
        <div className="ldg-page-title">도움말 / 사용법</div>
        <div className="ldg-page-sub">
          처음 쓰는 사람이 헷갈리기 쉬운 부분만 짧게 정리했습니다.
        </div>

        <div className="ldg-card ldg-help-important">
          <div className="ldg-setting-label">먼저 기억할 것</div>
          <ul className="ldg-help-list">
            <li>이 앱은 거래소 앱이 아닙니다.</li>
            <li>실제 비트코인을 사고팔지 않습니다.</li>
            <li>데이터는 내 브라우저에 저장됩니다.</li>
            <li>백업하지 않으면 데이터가 사라질 수 있습니다.</li>
            <li>암호화 백업 비밀번호를 잊으면 복원이 어렵습니다.</li>
          </ul>
        </div>

        {HELP_SECTIONS.map((section, index) => (
          <section className="ldg-card ldg-help-section" key={section.title}>
            <div className="ldg-setting-label">
              {index + 1}. {section.title}
            </div>
            <div className="ldg-help-copy">
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </section>
        ))}

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
