# Security And Privacy

## localStorage-first privacy model

My Ledger는 서버 DB가 없는 localStorage-first PWA입니다. 배포 URL은 공개될 수 있지만, 사용자의 거래 데이터는 각자의 브라우저 localStorage에 저장됩니다.

다른 사람이 자신의 기기에서 같은 URL에 접속해도 이 기기의 거래 내역은 보이지 않습니다. 반대로 같은 기기와 같은 브라우저를 다른 사람이 열면 거래 내역을 볼 수 있으므로 앱 잠금 기능을 사용합니다.

## Local App Lock

앱 잠금은 4~6자리 PIN으로 앱 화면을 막는 로컬 기능입니다.

- PIN은 평문으로 저장하지 않습니다.
- Web Crypto API로 salt + PBKDF2 hash를 저장합니다.
- 기본 자동 잠금 시간은 5분입니다.
- 브라우저를 완전히 닫고 다시 열면 다시 잠금 화면을 표시합니다.
- PIN 변경/해제에는 기존 PIN 확인이 필요합니다.

이 기능은 서버 인증이 아닙니다. 캐주얼한 같은 기기 접근을 막기 위한 장치이며, DevTools로 localStorage를 조작할 수 있는 고급 공격자, 기기 탈취, 악성 확장 프로그램, 백업 파일 유출까지 완벽하게 막지는 못합니다.

## PIN recovery

PIN을 잊었을 때 서버 복구는 불가능합니다. 복구 방법은 브라우저 localStorage 초기화뿐이며, 백업이 없으면 거래 데이터가 사라질 수 있습니다.

## Backup policy

백업 파일에는 `src/lib/backup.ts`의 `BACKUP_KEYS`에 정의된 다음 localStorage 데이터가 포함됩니다.

- `myledger.txns.v1`: 거래 내역
- `myledger.categories.v1`: 카테고리 설정
- `myledger.heldBtc.v1`: 보유 BTC 수량
- `myledger.displayUnit.v1`: BTC/sats 표시 단위
- `myledger.currency.v1`: KRW/BTC 기본 통화
- `myledger.refreshInterval.v1`: 시세 자동 갱신 주기
- `myledger.btcSellRecords.v1`: BTC 판매 확정 기록
- `myledger.settlementDay.v1`: 정산 기준일
- `myledger.recurringRules.v1`: 매월 반복 항목 규칙
- `myledger.recurringMaterialized.v1`: 정산월별 반복 항목 추가/건너뛰기 상태

다음 기기별·일시적 상태는 백업하지 않습니다.

- `myledger.pendingUndo.v1`: 삭제 취소 대기 상태
- `myledger.appLock.v1`: PIN 기반 앱 잠금 설정
- `myledger.installPrompt.dismissed.v1`: 설치 안내 닫기 상태
- `myledger.preRestoreBackup.v1`: 복원 직전에 현재 데이터를 보관하는 로컬 안전백업

- PIN/앱 잠금 설정은 기기별 로컬 잠금으로 보고 백업하지 않습니다.
- 복원 전 안전백업은 다음 복원 시 교체되며, 다운로드 백업 파일 안에는 포함되지 않습니다.

백업 JSON 파일에는 거래와 카테고리뿐 아니라 보유 BTC 수량과 BTC 판매 이력도 포함됩니다. 일반 거래 내역만 있는 파일보다 민감할 수 있으므로 개인 기기에 안전하게 보관하고 외부에 공유하지 마세요.

## Never store secrets

이 앱은 비트코인 지갑이 아닙니다. 아래 정보는 절대 앱에 저장하지 마세요.

- 비트코인 시드 문구
- 개인키
- 거래소 API 키
- 은행 계정 인증 정보
- 주민등록번호 등 민감한 신원 정보

더 강한 보안이 필요하면 향후 localStorage 암호화, 서버 인증, 기기 보안 정책, 클라우드 동기화 설계를 별도 Phase로 검토해야 합니다.
