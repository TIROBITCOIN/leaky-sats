# Deployment

My Ledger는 서버 없는 Vite 정적 웹앱/PWA입니다. 배포 대상은 `dist` 디렉터리이며, SPA 라우팅을 위해 모든 경로를 `index.html`로 fallback해야 합니다.

## 고정 URL과 개별 배포 URL

사용자에게 공유하거나 QR 코드로 만들 URL은 고정 production domain을 사용합니다.

- 사용자 공유용 고정 URL: `https://ledger-for-bitcoiners.vercel.app`

Vercel은 배포마다 랜덤한 개별 deployment URL도 만듭니다. 예를 들면
`https://ledger-for-bitcoiners-lql334i1e-willbegoodnurse-archs-projects.vercel.app`
같은 주소입니다. 이 URL은 특정 배포를 테스트하거나 확인할 때는 유용하지만, 새 배포마다
바뀔 수 있으므로 사용자 공유 링크나 QR 코드에는 쓰지 않습니다.

QR 코드를 만들 때는 항상 아래 고정 URL을 넣습니다.

```text
https://ledger-for-bitcoiners.vercel.app
```

릴리즈 후에는 개별 deployment URL이 아니라 위 고정 URL에 접속해서 최신 production 배포가
보이는지 확인합니다.

## 공통 설정

- Build command: `npm run build`
- Publish/output directory: `dist`
- HTTPS 필요: PWA 설치, service worker, 일부 브라우저 기능은 HTTPS에서 정상 동작합니다.
- SPA fallback 필요: `/stats`, `/assets`, `/settings` 같은 경로에서 새로고침해도 404가 나면 안 됩니다.

## Netlify 배포

1. Netlify에 접속합니다.
2. Add new site를 선택합니다.
3. Import from GitHub를 선택합니다.
4. `willbegoodnurse-arch/ledger-for-bitcoiners`를 선택합니다.
5. Build command에 `npm run build`를 입력합니다.
6. Publish directory에 `dist`를 입력합니다.
7. Deploy를 실행합니다.
8. 배포 URL로 접속합니다.
9. 모바일 브라우저에서 홈 화면 추가를 확인합니다.

`netlify.toml`에는 `npm run build`, `dist`, SPA fallback redirect가 포함되어 있습니다.

## Vercel 배포

1. Vercel에 접속합니다.
2. Add New Project를 선택합니다.
3. GitHub repo를 import합니다.
4. Framework preset은 Vite를 선택합니다.
5. Build command는 `npm run build`입니다.
6. Output directory는 `dist`입니다.
7. Deploy를 실행합니다.

`vercel.json`에는 `npm run build`, `dist`, SPA rewrite fallback이 포함되어 있습니다.

배포 후 `/manifest.webmanifest`, `/sw.js`, `/icons/icon-192.svg`가 직접 열리는지 확인합니다.

## PWA 배포 후 확인 체크리스트

- 배포 URL이 HTTPS인지 확인
- DevTools > Application > Manifest 확인
- DevTools > Application > Service Workers 확인
- `/manifest.webmanifest` 응답 확인
- `/sw.js` 응답 확인
- `/settings` 같은 내부 경로 새로고침 시 404가 아닌지 확인
- 모바일 브라우저에서 홈 화면 추가 가능 여부 확인
- 오프라인 모드에서 새로고침 후 앱 shell이 뜨는지 확인
- localStorage 거래 데이터가 유지되는지 확인

## 모바일 테스트

- 실제 Android Chrome에서 배포 URL 접속
- 실제 iOS Safari에서 배포 URL 접속
- 화면 하단 탭, 거래 입력, 설정, 백업/복원 버튼 터치 영역 확인
- 홈 화면 추가 후 standalone 모드로 열리는지 확인

## QR 코드

- 배포 URL을 확정한 뒤 QR 코드를 생성합니다.
- QR은 앱 내부 기능으로 만들지 않습니다.
- 네이버 QR, QR Code Generator, Canva, 브라우저 QR 공유 기능을 사용할 수 있습니다.
- QR을 바꾸지 않으려면 배포 URL을 고정해야 합니다.
- Netlify site name 또는 Vercel project domain을 고정하면 URL 유지가 쉽습니다.

## 배포 URL 변경 주의

PWA는 service worker와 캐시를 origin 기준으로 관리합니다. 배포 URL을 바꾸면 기존 설치 앱과 캐시가 새 URL로 자동 이동하지 않습니다.

## Service Worker 캐시 갱신

새 버전을 배포하면 브라우저가 service worker 업데이트를 감지합니다. 캐시가 남아 있으면 사용자가 새로고침을 한 번 더 해야 최신 shell을 볼 수 있습니다.

## 백업/복원 주의

이 앱은 localStorage-only MVP입니다. 앱 삭제, 브라우저 데이터 삭제, 기기 변경, 브라우저 변경 시 데이터가 사라질 수 있습니다.

- 설정 화면에서 정기적으로 백업 파일을 다운로드하세요.
- 백업 JSON에는 거래/카테고리 데이터가 들어갈 수 있으므로 개인 기기에 안전하게 보관하세요.
- My Ledger는 비트코인 시드, 개인키, 거래소 API 키, 은행 인증 정보를 저장하거나 백업하지 않습니다.
- 복원은 현재 브라우저의 거래/카테고리 데이터를 덮어쓰므로 복원 전 확인이 필요합니다.
