# Roadmap

## Phase 1: 제품 정의

- 제품 정의
- README
- PRODUCT_SPEC
- TECH_DECISIONS
- MVP 범위 고정

## Phase 2: 가계부 핵심 기능 안정화

- 거래 추가/수정/삭제 안정화
- 거래 localStorage 영속화
- Undo 안정화
- 카테고리 관리 안정화
- 새로고침 후 데이터 유지

## Phase 3: 통계/자산 계산 정리

- 월별 수입/지출 계산
- 카테고리별 지출 계산
- BTC 매수/매도 기반 보유 sats 계산
- 평균단가/평가액/손익 계산
- 통계/자산 탭 정리

### Phase 3 계산 정책

- 모든 통계와 자산 계산은 저장된 거래 목록(`txns`)을 기준으로 한다.
- BTC 수량은 수기 거래의 원화 금액과 해당 거래의 `btcAt` 기준으로 추정한다.
- `btc_buy`는 `abs(amount) / btcAt * 100_000_000` sats만큼 보유량을 늘린다.
- `btc_sell`은 `abs(amount) / btcAt * 100_000_000` sats만큼 보유량을 줄인다.
- 평균단가는 MVP 기준 단순 가중 평균(`총 매수금액 / 총 매수 BTC 수량`)을 사용한다.
- 평가손익은 현재 평가액에서 순투입금(`총 매수금액 - 총 매도금액`)을 뺀 값이다.
- 세무 목적의 FIFO, 실현손익, 거래소 원장 정산은 아직 지원하지 않는다.
- 은행/거래소 자동 연동은 여전히 MVP 제외 범위다.

## Phase 4: PWA화

- PWA manifest
- service worker
- 앱 아이콘
- 모바일 설치 안내
- 오프라인 기본 동작
- 모바일 터치 UX 정리

## Phase 5: 배포/검증

- Netlify/Vercel 배포
- 실제 모바일 테스트
- README 배포 가이드
- 백업/복원
- 회귀 테스트 체크리스트
