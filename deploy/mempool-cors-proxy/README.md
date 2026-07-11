# mempool HTTPS/CORS 프록시

Leaky Sats는 브라우저에서 사용자의 self-hosted mempool API를 직접 호출한다.
따라서 API는 HTTPS로 열려 있어야 하고, CORS 헤더도 브라우저가 받아들일 수 있어야 한다.

앱에 넣는 최종 URL:

```text
https://<your-node>.ts.net/api
```

`/blocks/tip/height`는 넣지 않는다. 앱이 자동으로 붙인다.

## 먼저 시도할 가장 단순한 구성

Umbrel에서 Tailscale 앱을 쓰면 `tailscale` 명령이 호스트에 없고 컨테이너 안에 있을 수 있다.

컨테이너 확인:

```bash
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Ports}}" | grep -i tailscale
```

예상 이름:

```text
tailscale_web_1
```

Tailscale 컨테이너 안에서 mempool API가 보이는지 확인:

```bash
docker exec tailscale_web_1 wget -qO- http://127.0.0.1:3006/api/blocks/tip/height
```

숫자가 나오면 바로 Serve:

```bash
docker exec tailscale_web_1 tailscale serve reset
docker exec tailscale_web_1 tailscale serve --bg --yes --https=443 http://127.0.0.1:3006
docker exec tailscale_web_1 tailscale serve status
```

브라우저에서 확인:

```text
https://<your-node>.ts.net/api/blocks/tip/height
```

숫자가 나오고 앱 연결 테스트도 성공하면 여기서 끝이다.

## CORS가 중복되거나 빠질 때

주소창에서는 숫자가 나오는데 앱만 실패하면 CORS를 확인한다.

정상:

```text
Access-Control-Allow-Origin: *
```

문제:

```text
Access-Control-Allow-Origin: *,*
```

중복 헤더가 나오면 중간 프록시가 CORS를 또 붙이고 있는 것이다.
이 경우에는 mempool 원본 CORS만 통과시키거나, 원본 CORS를 지우고 프록시가 하나만 붙이도록 해야 한다.

## localhost 프록시 구성

Tailscale Serve가 직접 mempool로 붙지 못하거나, 별도 프록시가 필요하면 Tailscale 컨테이너의 network namespace 안에서 Caddy를 실행한다.

```bash
mkdir -p ~/leaky-sats-mempool-cors-proxy
cd ~/leaky-sats-mempool-cors-proxy

cat > Caddyfile <<'EOF'
{
	auto_https off
	admin off
}

:18887 {
	@options method OPTIONS
	handle @options {
		header Access-Control-Allow-Origin "*"
		header Access-Control-Allow-Methods "GET, HEAD, OPTIONS"
		header Access-Control-Allow-Headers "*"
		header Access-Control-Max-Age "86400"
		respond "" 204
	}

	handle {
		reverse_proxy http://127.0.0.1:3006
	}
}
EOF

docker rm -f tailscale-mempool-localhost-proxy 2>/dev/null || true

docker run -d \
  --name tailscale-mempool-localhost-proxy \
  --restart unless-stopped \
  --network container:tailscale_web_1 \
  -v "$PWD/Caddyfile:/etc/caddy/Caddyfile:ro" \
  caddy:2.8-alpine

docker exec tailscale-mempool-localhost-proxy wget -qO- http://127.0.0.1:18887/api/blocks/tip/height

docker exec tailscale_web_1 tailscale serve reset
docker exec tailscale_web_1 tailscale serve --bg --yes --https=443 http://127.0.0.1:18887
docker exec tailscale_web_1 tailscale serve status
```

상태 예:

```text
https://<your-node>.ts.net
|-- / proxy http://127.0.0.1:18887
```

## PC에서 CORS까지 확인

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

## 실패 체크리스트

| 증상 | 확인할 것 |
|---|---|
| `tailscale: command not found` | Umbrel Tailscale 앱 컨테이너에서 `docker exec tailscale_web_1 tailscale ...` 실행 |
| `Cannot GET /api/blocks/tip/height` | Serve가 mempool API가 아닌 다른 서비스로 연결됨 |
| `404 page not found` | 경로 또는 Serve 대상 오류 |
| `502` | Caddy upstream이 컨테이너 내부에서 접근 불가 |
| 주소창은 숫자, 앱만 실패 | CORS 헤더 확인 |
| `Access-Control-Allow-Origin: *,*` | CORS 중복. 프록시가 헤더를 또 붙이는지 확인 |
| 폰만 실패 | 폰 Tailscale 연결 상태 확인 |

## 보안 메모

- 프록시는 Tailnet 안에서만 노출한다.
- 공인 IP 포트포워딩은 권장하지 않는다.
- 시드와 개인키는 절대 입력하지 않는다.
- xpub은 송금 권한은 없지만 거래 내역 프라이버시를 노출할 수 있다.
