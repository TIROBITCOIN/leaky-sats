# My Ledger 제품 정의 및 기능 명세

이 문서는 기존 디자인/기능 아이디어를 Phase 1 기준으로 정리한 요약 명세입니다. 더 자세한 제품 명세는 `docs/PRODUCT_SPEC.md`, 기술 결정은 `docs/TECH_DECISIONS.md`, 개발 순서는 `docs/ROADMAP.md`를 기준으로 합니다.

## 제품 정의

My Ledger는 **비트코이너를 위한 모바일 우선 PWA 가계부**입니다.

한국 비트코이너가 원화 수입/지출을 기록하고, 해당 금액을 현재 BTC 가격 기준으로 BTC 또는 sats 단위로 환산해 소비 감각을 바꾸는 웹앱입니다. 업비트 KRW-BTC, 바이낸스 BTCUSDT, USD/KRW 환율, 김프 계산을 통해 한국 사용자에게 맞는 비트코인 가격 맥락을 제공합니다.

## 현재 플랫폼

- Vite + React + TypeScript
- 모바일 우선 웹앱/PWA
- localStorage 기반 클라이언트 저장
- 서버 없음
- 로그인 없음
- 은행/거래소 계정 자동 연동 없음

현재 MVP는 React Native 앱이 아닙니다. React Native 전환은 추후 네이티브 기능, 앱스토어 배포, 장기 운영 필요가 검증된 뒤 별도 Phase에서 검토합니다.

## MVP 범위

- 홈/대시보드
- 거래 입력
- 거래 목록
- 수입/지출 요약
- BTC/sats 환산
- 업비트/바이낸스/환율 기반 가격 위젯
- 카테고리 관리
- 통계
- 자산/포트폴리오 탭
- JSON 백업 내보내기

## MVP 제외 범위

- 서버
- 로그인
- 은행 API
- 거래소 계정 자동 연동
- 알트코인
- 앱스토어 출시
- React Native 전환
- 대규모 UI 리디자인

## 화면 구성

1. 홈/대시보드: 잔액, 수입/지출, 최근 거래, 가격 위젯을 보여줍니다.
2. 거래 입력: 금액, 카테고리, 제목, 메모, 날짜를 수기로 입력합니다.
3. 거래 목록: 기록된 거래를 확인하고 수정/삭제합니다.
4. 통계: 월별 수입/지출과 카테고리별 지출을 확인합니다.
5. 자산(HODL): 보유 BTC의 현재 가치(Total Balance)와 적립 추이를 보여줍니다.
6. 설정: 표시 통화, 시세 갱신 주기, 카테고리, 백업을 관리합니다.

## 저장 방식

1차 MVP는 localStorage를 사용합니다.

- `myledger.txns.v1`
- `myledger.categories.v1`
- `myledger.settings.v1`
- `myledger.pendingUndo.v1`

## 가격 및 환산 원칙

- 원화 금액은 현재 BTC 가격 기준으로 BTC/sats로 환산해 보여줍니다.
- 거래 기록에는 입력 시점 가격도 함께 저장할 수 있습니다.
- 사용자는 현재 시세 기준의 소비 감각을 보는 것이 핵심입니다.
- 김프는 `Upbit KRW-BTC`와 `Binance BTCUSDT * USD/KRW`를 비교해 계산합니다.
