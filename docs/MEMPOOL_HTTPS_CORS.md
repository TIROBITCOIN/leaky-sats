# 근본 해결: HTTPS + CORS (자가호스팅 mempool)

My Ledger 지갑 동기화는 브라우저에서 **직접** 사용자 mempool(Esplora API)을 호출합니다.  
서버에 xpub를 맡기지 않으려면, **사용자 쪽 노드**가 브라우저 규칙을 만족해야 합니다.

## 브라우저가 요구하는 것

| 요구 | 실패 시 | 해결 |
|---|---|---|
| **HTTPS 페이지 → HTTPS API** (또는 localhost) | Mixed Content | Tailscale `https://….ts.net` 등 |
| 응답에 **CORS 허용 헤더** | `Failed to fetch` / CORS | 프록시·리버스프록시에 헤더 추가 |

`http://110.x.x.x:3006` 이나 `IP:50001`(Electrum TCP) 은 PWA에서 **근본 해결이 아닙니다.**  
(Electrum TCP는 네이티브 지갑용; 웹은 HTTP(S) API만 가능.)

## 권장 구성 (Umbrel + Tailscale)

저장소에 준비된 프록시:

→ [`deploy/mempool-cors-proxy/`](../deploy/mempool-cors-proxy/README.md)

요약:

1. Umbrel에서 Mempool 앱 실행 (보통 `localhost:3006`)  
2. `deploy/mempool-cors-proxy` 로 Caddy 기동 → `:8787` 에 CORS 추가  
3. `tailscale serve --bg --https=443 http://127.0.0.1:8787`  
4. My Ledger URL: `https://<magicdns>/api`  
5. 연결 테스트 → 블록 높이

## 이미 `https://….ts.net/api` 인데 앱만 실패할 때

주소창에서 tip height가 보이면 **HTTPS·경로 OK**, **CORS만 부족**한 상태입니다.  
Umbrel 기본 게이트웨이는 보통 CORS를 안 붙입니다 → 위 프록시를 앞에 두거나, 기존 리버스 프록시에 아래 헤더를 추가하세요.

```
Access-Control-Allow-Origin: https://leaky-sats.vercel.app
Access-Control-Allow-Methods: GET, HEAD, OPTIONS
```

`OPTIONS` preflight 는 `204` + 동일 헤더.

## My Ledger에 넣을 URL 예

```text
https://umbrel-elecrum.tailcb1ed9.ts.net/api
```

검증:

```text
https://umbrel-elecrum.tailcb1ed9.ts.net/api/blocks/tip/height
```

숫자만 나오면 base URL 이 맞습니다.

## 앱 쪽 동작 (참고)

- 요청 타임아웃: 20초 (Tailscale 지연 완화)  
- 연결 테스트 실패 시 Mixed Content / CORS / 타임아웃을 구분해 안내  
- 퍼블릭 mempool.space 기본 사용 없음 (주소 프라이버시)
