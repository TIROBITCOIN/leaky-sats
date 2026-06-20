# My Ledger

**비트코이너를 위한 모바일 우선 PWA 가계부**

My Ledger는 한국 비트코이너가 원화 수입과 지출을 기록하고, 해당 금액을 현재 BTC 가격 기준의 BTC/sats 단위로 다시 보게 만드는 모바일 우선 웹앱/PWA 프로젝트입니다.

## 해결하려는 문제

일반 가계부는 원화 기준의 지출만 보여줍니다. My Ledger는 커피값, 생활비, 투자 금액을 sats 단위로 환산해 사용자가 소비와 비트코인 적립을 함께 인식하도록 돕습니다.

업비트 KRW-BTC, 바이낸스 BTCUSDT, USD/KRW 환율, 김프 계산을 통해 한국 사용자에게 맞는 비트코인 가격 맥락을 제공합니다.

## 주요 사용자

- 한국 비트코이너
- 정기적으로 비트코인을 매수하는 DCA 사용자
- 은행 자동 연동 없이 수기로 가계부를 쓰고 싶은 사람
- 원화 소비를 sats 기준으로 다시 보고 싶은 사람

## 현재 플랫폼

- Vite
- React
- TypeScript
- React Router
- localStorage
- 모바일 우선 웹앱/PWA

이 프로젝트는 현재 React Native 모바일 앱으로 전환하지 않습니다. Phase 4 기준의 제품 방향은 **Vite + React + TypeScript + localStorage 기반 모바일 우선 PWA MVP**입니다.

## 현재 MVP 범위

- 거래 입력
- 거래 목록
- 수입/지출 요약
- BTC/sats 환산
- 가격 위젯
- 카테고리 관리
- 통계
- 자산 탭
- PWA 설치
- 기본 오프라인 앱 shell

## MVP 제외 범위

- 서버
- 로그인
- 은행 API 연동
- 거래소 계정 자동 연동
- 알트코인
- 앱스토어 출시
- React Native 전환
- 대규모 UI 리디자인
- 상태관리 라이브러리 추가

## 로컬 실행 방법

```bash
npm install
npm run dev
npm run build
```

## PWA 설치 방법

이 앱은 앱스토어 앱이 아니라 모바일 브라우저에서 설치 가능한 PWA입니다.

- Android Chrome: 앱 접속 후 브라우저 메뉴 또는 화면의 설치 안내에서 설치합니다.
- iOS Safari: 공유 버튼을 누른 뒤 “홈 화면에 추가”를 선택합니다.
- 데스크톱 Chrome/Edge: 주소창 설치 아이콘이 보이면 설치할 수 있습니다.

## 오프라인 동작 범위

- 첫 접속 후 service worker가 앱 shell을 캐시합니다.
- 오프라인에서도 localStorage에 저장된 거래 데이터는 유지됩니다.
- 시세 API는 온라인 상태에서만 갱신됩니다.
- 오프라인 또는 시세 실패 시 가격 위젯은 기존 fallback/stale 상태를 사용합니다.
- 외부 Upbit/Binance/FX API 응답은 service worker가 강하게 캐싱하지 않습니다.

## 검증

```bash
npm run build
npm run verify:persist
npm run verify:calc
npm run verify:pwa
```

PWA 수동 확인은 production build 기준으로 진행합니다.

```bash
npm run build
npm run preview
```

브라우저 DevTools의 Application 탭에서 Manifest와 Service Worker를 확인하고, 오프라인 모드에서 새로고침해 앱 shell이 뜨는지 확인합니다.

## 배포 방향

정적 웹앱으로 빌드해 Netlify 또는 Vercel에 배포하는 것을 우선합니다. 서버가 필요한 기능은 MVP 이후 동기화, 로그인, 백업 요구가 명확해질 때 검토합니다.

## 향후 페이즈

- Phase 1: 제품 정의
- Phase 2: 가계부 핵심 기능 안정화
- Phase 3: 통계/자산 계산 정리
- Phase 4: PWA화
- Phase 5: 배포/검증

자세한 범위는 [ROADMAP.md](docs/ROADMAP.md), 제품 정의는 [PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md), 기술 결정은 [TECH_DECISIONS.md](docs/TECH_DECISIONS.md)를 기준으로 합니다.
