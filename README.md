# My Ledger

**비트코이너를 위한 모바일 우선 PWA 가계부**

My Ledger는 한국 비트코이너가 원화 수입/지출을 기록하고, 해당 금액을 현재 BTC 가격 기준의 BTC/sats 단위로 다시 보게 만드는 모바일 우선 웹앱/PWA입니다.

## 해결하려는 문제

일반 가계부는 원화 기준 지출만 보여줍니다. My Ledger는 커피값, 생활비, BTC 매수 금액을 sats 단위로 환산해 사용자가 소비와 비트코인 적립을 함께 인식하도록 돕습니다.

업비트 KRW-BTC, 바이낸스 BTCUSDT, USD/KRW 환율, 김프 계산을 통해 한국 사용자에게 맞는 비트코인 가격 맥락을 제공합니다.

## 현재 플랫폼

- Vite
- React
- TypeScript
- React Router
- localStorage
- 모바일 우선 PWA

현재 MVP는 React Native 앱이 아니라 **Vite + React + TypeScript + localStorage 기반 모바일 우선 PWA**입니다.

## 현재 MVP 범위

- 거래 입력, 수정, 삭제, Undo
- 거래 목록과 새로고침 후 데이터 유지
- 수입/지출/잔액 요약
- BTC/sats 환산
- 가격 위젯
- 카테고리 관리
- 통계
- 자산/포트폴리오 계산
- PWA 설치와 기본 오프라인 앱 shell
- 로컬 앱 잠금

## MVP 제외 범위

- 서버
- 로그인/회원가입
- 은행 API 연동
- 거래소 계정 자동 연동
- 알트코인
- 앱스토어 출시
- React Native 전환
- 클라우드 동기화
- 시드/개인키/거래소 API 키 저장

## 로컬 실행

```bash
npm install
npm run dev
npm run build
```

## PWA 설치

이 앱은 앱스토어 앱이 아니라 모바일 브라우저에서 설치 가능한 PWA입니다.

- Android Chrome: 브라우저 메뉴 또는 앱 안의 설치 안내에서 설치합니다.
- iOS Safari: 공유 버튼을 누른 뒤 "홈 화면에 추가"를 선택합니다.
- Desktop Chrome/Edge: 주소창 설치 아이콘이 보이면 설치할 수 있습니다.

## 오프라인 동작

- 첫 접속 후 service worker가 앱 shell을 캐시합니다.
- 오프라인에서도 localStorage에 저장된 거래 데이터는 유지됩니다.
- 시세 API는 온라인 상태에서만 갱신됩니다.
- 외부 Upbit/Binance/FX API 응답은 service worker가 강하게 캐싱하지 않습니다.

## 로컬 앱 잠금

설정 화면에서 4~6자리 PIN 기반 로컬 앱 잠금을 켤 수 있습니다.

- PIN은 평문으로 저장하지 않고 Web Crypto 기반 salt/hash로 저장합니다.
- 잠금은 같은 기기에서 앱 화면을 바로 보는 것을 막기 위한 캐주얼 보호 장치입니다.
- 서버 인증, 계정 복구, 완전한 localStorage 암호화가 아닙니다.
- PIN을 잊으면 브라우저 데이터 초기화가 필요할 수 있으며, 백업이 없으면 데이터가 사라질 수 있습니다.

자세한 내용은 [SECURITY.md](docs/SECURITY.md)를 기준으로 합니다.

## 데이터 보관 주의

이 앱은 localStorage-first PWA입니다. 앱 삭제, 브라우저 데이터 삭제, 기기 변경 시 데이터가 사라질 수 있습니다. 백업 기능이 있는 브랜치에서는 정기적으로 백업 JSON을 내려받아 개인 기기에 안전하게 보관해야 합니다.

백업 파일에는 개인 금융 기록이 들어갈 수 있습니다. 비트코인 시드, 개인키, 거래소 API 키, 은행 정보는 절대 앱에 저장하지 마세요.

## 검증

```bash
npm run build
npm run verify:persist
npm run verify:calc
npm run verify:pwa
npm run verify:security
npm run verify:branding
```

PWA 수동 확인은 production build 기준으로 진행합니다.

```bash
npm run build
npm run preview
```

브라우저 DevTools의 Application 탭에서 Manifest와 Service Worker를 확인하고, 오프라인 모드에서 새로고침해 앱 shell이 뜨는지 확인합니다.

## 배포 방향

정적 웹앱으로 빌드해 Netlify 또는 Vercel에 배포하는 것을 우선합니다. 서버가 필요한 기능은 MVP 이후 동기화, 로그인, 백업 요구가 명확해질 때만 검토합니다.

## 향후 페이즈

- Phase 1: 제품 정의
- Phase 2: 거래 데이터 안정화
- Phase 3: 통계/자산 계산 안정화
- Phase 4: PWA화
- Phase 5: 배포/백업/복원
- Phase 6: 프라이버시, 앱 잠금, 가독성, 아이콘 개선
- Phase 7 후보: localStorage 암호화, 클라우드 동기화 검토, 접근성 개선

자세한 범위는 [ROADMAP.md](docs/ROADMAP.md), 제품 정의는 [PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md), 기술 결정은 [TECH_DECISIONS.md](docs/TECH_DECISIONS.md)를 기준으로 합니다.
