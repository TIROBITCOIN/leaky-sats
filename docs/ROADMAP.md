# Roadmap

## Phase 1: 제품 정의

- 제품 방향을 "비트코이너를 위한 모바일 우선 PWA 가계부"로 고정
- README 작성
- PRODUCT_SPEC 작성
- TECH_DECISIONS 작성
- MVP 범위와 제외 범위 고정

## Phase 2: 거래 데이터 안정화

- 거래 추가/수정/삭제 안정화
- 거래 localStorage 영속화
- Undo 안정화
- 카테고리 관리 안정화
- 새로고침 후 데이터 유지

## Phase 3: 통계/자산 계산 안정화

- 월별 수입/지출 계산
- 카테고리별 지출 계산
- BTC 구매/판매 기반 보유 sats 계산
- 평균단가/평가액/손익 계산 (Phase 13에서 자산 탭 노출은 제거, 계산 유틸 자체는 유지)
- 통계/자산 탭 정리

### Phase 3 계산 정책

- 모든 통계 계산은 저장된 거래 목록(`txns`)을 기준으로 한다.
- BTC 수량은 수기 거래의 원화 금액과 해당 거래의 `btcAt` 기준으로 추정한다.
- `btc_buy`는 `abs(amount) / btcAt * 100_000_000` sats만큼 보유량을 늘린다.
- `btc_sell`은 `abs(amount) / btcAt * 100_000_000` sats만큼 보유량을 줄인다.
- 평균단가/평가손익 계산 유틸(`calculateBitcoinPortfolio`)은 여전히 존재하지만, Phase 13부터 자산
  탭은 HODL 관점에 맞춰 이 값을 화면에 보여주지 않는다 — 자산 탭의 현재 보유량/가치는 거래 추정치가
  아니라 `heldBtc`(설정에서 입력한 값 + BTC 판매 확정 차감)를 기준으로 한다.
- 세무 목적의 FIFO, 실현손익, 거래소 원장 정산은 아직 지원하지 않는다.
- 은행/거래소 자동 연동은 여전히 MVP 제외 범위다.

## Phase 4: PWA화

- PWA manifest
- service worker
- 앱 아이콘
- 모바일 설치 안내
- 오프라인 기본 동작
- 모바일 터치 UX 정리

### Phase 4 PWA 정책

- 이 프로젝트는 앱스토어 앱이 아니라 모바일 브라우저에서 설치 가능한 PWA다.
- 첫 접속 후 service worker가 앱 shell을 캐시한다.
- 오프라인에서도 localStorage 거래 데이터는 유지된다.
- 외부 BTC/FX 시세 API는 service worker가 강하게 캐싱하지 않는다.
- 시세 API 실패 또는 오프라인 상태는 앱의 fallback/stale UI로 표현한다.
- Android Chrome은 `beforeinstallprompt` 기반 설치 안내를 사용한다.
- iOS Safari는 공유 메뉴의 "홈 화면에 추가" 안내를 제공한다.

## Phase 5: 배포/백업/복원

- Netlify/Vercel 배포 설정
- SPA fallback 설정
- 실기기 검증 체크리스트
- 실제 모바일 URL 테스트
- QR 접속 테스트 안내
- 배포 README 정리
- 백업/복원 UX
- localStorage-only 데이터 유실 리스크 완화

### Phase 5 완료 범위

- Netlify/Vercel 배포 설정
- SPA fallback 설정
- 실기기 검증 체크리스트
- QR 접속 테스트 안내
- 백업/복원 UX
- localStorage-only 데이터 유실 리스크 완화

## Phase 6: 프라이버시, 앱 잠금, 브랜딩 개선

- 본문/금액/거래내역 가독성 개선
- 숫자 tabular-nums 적용
- PWA 홈 화면 아이콘과 apple-touch-icon 보강
- 4~6자리 PIN 기반 로컬 앱 잠금
- PIN salt/hash 저장
- 잠금 화면과 설정 화면 추가
- localStorage 프라이버시 모델과 보안 한계 문서화

### Phase 6 보안 정책

- 앱 잠금은 서버 로그인이 아니라 같은 기기에서 화면 노출을 줄이는 로컬 잠금이다.
- PIN은 평문으로 저장하지 않는다.
- 앱 잠금 설정은 백업 대상에서 제외한다.
- 고급 공격자, DevTools, localStorage 직접 조작, 기기 탈취, 백업 파일 유출까지 완벽하게 막지는 못한다.
- 비트코인 시드, 개인키, 거래소 API 키, 은행 정보는 앱에 저장하지 않는다.

## Phase 7 후보

- localStorage 데이터 암호화
- 클라우드 동기화 검토
- 배포 후 버그 수정
- UI polish
- 접근성 개선
- 가격 stale 상태 UX 개선
