# Self-hosted mempool 연결: HTTPS + CORS

Leaky Sats 지갑 동기화는 브라우저에서 사용자의 mempool/Esplora API를 직접 호출한다.
서버에 xpub이나 주소 목록을 맡기지 않기 위한 방향이므로, 사용자의 노드가 브라우저 규칙을 만족해야 한다.

## 앱에 넣는 URL

설정 화면의 `self-hosted mempool API URL`에는 base URL만 넣는다.

```text
https://<your-node>.ts.net/api
```

예:

```text
https://your-node.your-tailnet.ts.net/api
```

넣지 않는 것:

```text
https://<your-node>.ts.net/api/blocks/tip/height
```

`/blocks/tip/height`, `/address/{addr}/utxo` 같은 경로는 앱이 자동으로 붙인다.

## 브라우저가 요구하는 것

| 요구 | 실패 증상 | 해결 |
|---|---|---|
| HTTPS 앱에서 HTTPS API 호출 | Mixed Content | Tailscale `https://….ts.net` 같은 HTTPS URL 사용 |
| CORS 허용 헤더 | 주소창은 되는데 앱 fetch 실패 | `Access-Control-Allow-Origin` 헤더 확인 |
| 올바른 API 경로 | `Cannot GET` / 404 | base URL은 `/api`까지만 입력 |
| Tailnet 연결 | timeout / fetch failed | PC/폰 Tailscale 연결 확인 |

정상 CORS 헤더:

```text
Access-Control-Allow-Origin: *
```

문제 있는 예:

```text
Access-Control-Allow-Origin: *,*
```

주소창은 CORS를 검사하지 않는다. 주소창에서 tip height 숫자가 보여도 앱의 `fetch()`는 CORS 헤더가 잘못되면 실패한다.

## 권장 구성

```text
Leaky Sats PWA
  -> https://<your-node>.ts.net/api
  -> Tailscale Serve
  -> self-hosted mempool API
  -> Umbrel/노드의 mempool :3006
```

Umbrel에서 Tailscale을 앱으로 설치한 경우, 호스트 쉘에서 `tailscale` 명령이 없을 수 있다.
그때는 Tailscale 컨테이너 안에서 Serve를 설정한다.

컨테이너 찾기:

```bash
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Ports}}" | grep -i tailscale
```

예상 이름:

```text
tailscale_web_1
```

컨테이너 안에서 mempool API가 보이는지 확인:

```bash
docker exec tailscale_web_1 wget -qO- http://127.0.0.1:3006/api/blocks/tip/height
```

숫자가 나오면 Tailscale Serve를 직접 mempool API로 연결할 수 있다.

```bash
docker exec tailscale_web_1 tailscale serve reset
docker exec tailscale_web_1 tailscale serve --bg --yes --https=443 http://127.0.0.1:3006
docker exec tailscale_web_1 tailscale serve status
```

상태 예:

```text
https://<your-node>.ts.net
|-- / proxy http://127.0.0.1:3006
```

이후 아래 주소가 숫자를 반환해야 한다.

```text
https://<your-node>.ts.net/api/blocks/tip/height
```

## CORS가 중복되거나 빠질 때

mempool API가 이미 CORS 헤더를 붙이면, 중간 Caddy 프록시가 같은 헤더를 또 붙이지 않게 해야 한다.
중복 CORS는 앱에서 실패한다.

문제 예:

```text
Access-Control-Allow-Origin: *,*
```

Tailscale Serve가 직접 mempool로 붙지 못하거나 헤더 정리가 필요하면
[`deploy/mempool-cors-proxy`](../deploy/mempool-cors-proxy/README.md)를 참고한다.

## 빠른 점검

PC에서:

```powershell
$headers=@{Origin='https://leaky-sats.vercel.app'}
Invoke-WebRequest -Uri 'https://<your-node>.ts.net/api/blocks/tip/height' -Headers $headers -UseBasicParsing
```

성공 조건:

```text
StatusCode: 200
Content: 957xxx
Access-Control-Allow-Origin: *
```

OPTIONS도 확인:

```powershell
Invoke-WebRequest `
  -Uri 'https://<your-node>.ts.net/api/blocks/tip/height' `
  -Method Options `
  -Headers @{Origin='https://leaky-sats.vercel.app'; 'Access-Control-Request-Method'='GET'} `
  -UseBasicParsing
```

성공 조건:

```text
StatusCode: 204
Access-Control-Allow-Origin: *
```

## 앱 쪽 동작

- 요청 타임아웃: 20초
- 퍼블릭 mempool.space 기본 사용 없음
- `http://` 공인 IP는 HTTPS PWA에서 차단
- `localhost`/`127.0.0.1`만 개발 예외
- 연결 테스트는 tip height를 호출해서 base URL, HTTPS, CORS, timeout을 구분한다.
