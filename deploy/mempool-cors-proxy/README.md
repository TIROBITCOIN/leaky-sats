# mempool CORS 프록시 (근본 해결)

My Ledger는 **HTTPS PWA**라서 브라우저가 직접:

1. **`http://` mempool** 을 치면 → **Mixed Content** 차단  
2. **다른 출처**에서 `fetch` 하면 → **CORS** 차단  

둘 다 풀려면 mempool 앞에 **HTTPS + CORS 헤더**가 있어야 합니다.  
이 폴더는 그 앞단(Caddy)을 로컬에서 돌리기 위한 최소 구성입니다.

```
[My Ledger https://leaky-sats.vercel.app]
        │  fetch (HTTPS, CORS OK)
        ▼
[Tailscale MagicDNS HTTPS]
  https://umbrel-xxx.ts.net  →  Serve →  127.0.0.1:8787
        │
        ▼
[이 Caddy 프록시 :8787]  ← Access-Control-Allow-Origin 추가
        │
        ▼
[Umbrel mempool :3006]   ← 기존 HTTP API
```

## 사전 조건

- Umbrel(또는 동등)에서 **Mempool 앱** 동작  
- 같은 기기에 **Tailscale** 설치·로그인  
- Docker (Umbrel이면 보통 있음)

## 1. 프록시 기동

Umbrel SSH 후 이 디렉터리에서:

```bash
# mempool이 호스트 3006이 아니면 MEMPOOL_UPSTREAM 수정
export MEMPOOL_UPSTREAM=http://172.17.0.1:3006
# 또는 host.docker.internal (Caddyfile/compose extra_hosts 지원 시)
# export MEMPOOL_UPSTREAM=http://host.docker.internal:3006

docker compose up -d
```

로컬 확인 (Umbrel 본체에서):

```bash
curl -sS -D- http://127.0.0.1:8787/api/blocks/tip/height -o /tmp/h.txt
# 응답 헤더에 Access-Control-Allow-Origin 이 있어야 함
# /tmp/h.txt 에 블록 높이 숫자
```

Umbrel mempool 포트가 3006이 아니면 `MEMPOOL_UPSTREAM`만 바꾸면 됩니다.

## 2. Tailscale HTTPS (Mixed Content 제거)

**권장:** 프록시만 Serve (경로 단순).

```bash
# 백그라운드 HTTPS → 로컬 8787
tailscale serve --bg --https=443 http://127.0.0.1:8787
tailscale serve status
```

MagicDNS 이름 예:

```text
https://umbrel-elecrum.tailcb1ed9.ts.net
```

브라우저(폰, Tailscale 켠 상태)에서:

```text
https://<your-node>.ts.net/api/blocks/tip/height
```

→ **숫자**가 보이면 HTTPS OK.

이미 다른 서비스가 443 Serve 중이면:

```bash
tailscale serve reset   # 주의: 기존 serve 규칙 초기화
# 또는 공식 문서대로 path 기반 규칙 추가
```

## 3. My Ledger 설정

**mempool API URL:**

```text
https://umbrel-elecrum.tailcb1ed9.ts.net/api
```

(`…/blocks/tip/height` 는 넣지 않음. 앱이 붙입니다.)

→ **연결 테스트** → 블록 높이 성공.

## 4. CORS_ORIGIN 좁히기 (선택)

기본 `*` 는 편하지만, 출처 고정 권장:

```bash
export CORS_ORIGIN=https://leaky-sats.vercel.app
docker compose up -d
```

로컬 개발 시:

```bash
export CORS_ORIGIN=http://localhost:5173
```

## 실패 체크리스트

| 증상 | 원인 |
|---|---|
| 주소창 tip height 숫자, 앱만 실패 | CORS 헤더 없음 / 구 캐시 — 프록시 경유 URL인지 확인 |
| Mixed Content | URL이 아직 `http://` — Tailscale **https://….ts.net** 사용 |
| Cannot GET | 경로 오류 — base는 `/api` 까지 |
| fetch aborted / timeout | 노드·Tailscale 느림 — 앱 타임아웃 20s (최신 빌드) |
| curl은 되고 폰만 안 됨 | 폰 Tailscale 미연결 |

## 보안 메모

- 프록시는 **Tailscale 망 안에서만** 노출하세요. 공인 IP:8787 포트포워딩은 비권장.  
- `CORS_ORIGIN=*` 는 브라우저 출처만 완화합니다. Tailscale ACL로 접근 자체를 제한하는 것이 본체 보안입니다.  
- 시드·xpub를 이 프록시에 저장하지 않습니다. 조회 URL만 중계합니다.
