# 지갑 동기화 설계 (제안 1 + 제안 2)

> 목표: 보유 BTC의 진실의 원천을 "앱의 계산"에서 "와치온리 지갑의 온체인 잔고"로 옮기고,
> 판매 기록을 실측값(지갑에서 나간 BTC, 실제 받은 원화) 기반으로 바꿔 정산과 지갑이 절대 어긋나지 않게 한다.
>
> xpub 파생/잔고 조회 로직은 Atlas-Self-hosted-Watch-only 레포의 `packages/bitcoin` 및
> `apps/api/src/mempool`을 브라우저용으로 포팅한다.

---

## 0. 현재 구조 요약과 문제

| 항목 | 현재 | 문제 |
|---|---|---|
| 보유 BTC | `heldBtc.ts` — localStorage에 수동 입력한 숫자 하나 | 실제 지갑과 무관, 오차 누적 |
| 판매 확정 | `SellConfirmModal` — 원화 1개 입력 → `BTC = 원화 ÷ 앱 시세`로 역산 후 heldBtc 차감 | 김프/슬리피지/체결가 차이로 역산 BTC ≠ 실제 판 BTC |
| 온체인 전송 수수료 | 기록 안 됨 | 지갑에서는 빠지는데 앱에는 없음 |
| 거래소 매매 수수료 | 기록 안 됨 | 동일 |

핵심 방향: **앱이 빼기 연산을 그만두고, 잔고는 체인에서 읽는다.** (wallet-sync 모드)

---

## 1. 아키텍처 결정

### 1-1. 클라이언트 내장 방식 (채택)

leaky-sats는 백엔드 없는 Vite React PWA이므로, Atlas API 서버를 의존성으로 두지 않고
**xpub 파생과 mempool 조회를 브라우저에서 직접** 수행한다.

```
[leaky-sats PWA (브라우저)]
   ├── xpub → 주소 파생 (bip32 + bitcoinjs-lib)
   ├── 주소별 UTXO 조회 (fetch → 자가호스팅 mempool API)
   └── 합산 → heldBtc 갱신
            │
            ▼ HTTPS (Tailscale ts.net 권장)
[Umbrel mempool 앱]  ←  [자기 비트코인 풀노드]
```

- 퍼블릭 mempool.space는 **기본값에서 제외**. 자가호스팅 mempool URL만 설정에서 입력.
- PWA가 HTTPS면 `http://` API는 mixed content 차단 → **Tailscale HTTPS(ts.net) URL**을 문서/UI에 명시. `http://localhost`만 예외.
- 대안(비채택): Atlas API를 잔고 서버로 사용 — 인증·상시 구동 부담으로 제외. 요청 유틸(타임아웃/재시도/동시성)만 참고.

### 1-2. 라이브러리 (Phase 2)

| 용도 | 패키지 | 비고 |
|---|---|---|
| BIP32 파생 | `bip32` | Atlas와 동일 |
| 주소 생성 | `bitcoinjs-lib` | Atlas와 동일 |
| base58check | `bs58check` | zpub/ypub → xpub 버전 변환 |
| ECC | `@bitcoinerlab/secp256k1` | 순수 JS (WASM 회피) |

`wallet/` 모듈은 동적 `import()`로 코드 스플리팅.

---

## 2. 신규 모듈: `src/lib/wallet/` (Phase 2+)

| 파일 | 역할 |
|---|---|
| `xpub.ts` | 확장공개키 감지/변환, 주소 파생, 또는 주소 목록 모드 |
| `mempoolClient.ts` | 타임아웃·재시도·동시성 4 |
| `scan.ts` | gap limit 스캔 + 주소 캐시 |
| `balance.ts` | UTXO 합산, online/partial/offline |
| `walletConfig.ts` | localStorage 설정 3키 |
| `sync.ts` | 홈/포그라운드/수동/판매 직후 동기화 |

**partial/offline 시 heldBtc를 갱신하지 않는다** (과소 잔고 방지).

localStorage 키:

| 키 | 내용 |
|---|---|
| `myledger.wallet.config.v1` | enabled, descriptor, mempoolApiUrl, gapLimit, includeUnconfirmed |
| `myledger.wallet.addressCache.v1` | 파생 주소 + 사용 인덱스 |
| `myledger.wallet.lastBalance.v1` | 마지막 성공 WalletBalance |

---

## 3. `heldBtc` 이중 모드 (Phase 3)

```ts
export type HeldBtcMode = "manual" | "wallet-sync";
```

- **manual**: 기존 — 설정 손 입력, 판매 시 실측 BTC만큼 차감.
- **wallet-sync**: `getHeldBtc()`는 체인 잔고. 판매 시 **차감하지 않음** (`deductedFromHeldBtc: false`). 이중 차감 방지.

---

## 4. Phase 1: 판매 확정 실측 입력 (현재 구현 범위)

### 4-1. 입력 필드

| 필드 | 설명 | 기본값 |
|---|---|---|
| 실제 받은 원화 `krwReceived` | 거래소 입금 원화 | 이번 기간 부족분 |
| 지갑에서 나간 BTC `btcSpentFromWallet` | 수수료 포함 실측 | 시세 역산을 placeholder |
| (선택) 전송 수수료 sats `networkFeeSats` | 통계용 | 비움 |

- 실효 매도가: `krwReceived ÷ (btcSpent − feeBtc)` (분모 ≤ 0 이면 저장 차단)
- 앱 시세 대비 % 차이 표시
- **manual 모드(현재 유일 모드): `btcSpentFromWallet` 필수**, 그만큼 heldBtc 차감 (역산 폐지)

### 4-2. `BtcSellRecord` 스키마 v2

기존 필드 전부 유지 + optional:

```ts
schemaVersion?: 2;
btcSpentFromWallet?: number;
krwReceived?: number;       // krwCovered와 동일값 저장
marketBtcKrwAtSell?: number;
networkFeeSats?: number;
// btcSold / satsSold = btcSpentFromWallet 기준
// btcKrwAtSell = 실효 매도가
```

- v1 레코드는 그대로 유효 (`isValidRecord` optional 검증)
- `isSellCompleted()`는 `krwCovered` 기준 유지

---

## 5. 설정 UI (Phase 3)

- 모드 토글, mempool URL + 연결 테스트, xpub/주소 입력, gap limit, 지금 동기화
- xpub 프라이버시 경고, 백업에 xpub 포함 경고

---

## 6. 구현 Phase

| Phase | 내용 | 상태 |
|---|---|---|
| **1** | 판매 실측 입력, 스키마 v2, manual 차감=실측 BTC | **이 문서와 함께 구현** |
| **2** | `wallet/` 모듈 (xpub + mempool + scan) | 예정 |
| **3** | 설정 UI + sync + heldBtc 이중 모드 | 예정 |
| **4** | 백업 키, 실효/김프 통계, 미확정 뱃지 | 예정 |

---

## 7. 엣지 케이스

- [ ] mempool CORS 실패 안내
- [ ] 판매 직후 동기화 시 미반영은 오차 표시하지 않음
- [ ] 외부 입금 시 heldBtc 증가 = 의도 (wallet-sync)
- [ ] 거래소 미판매 전송분 감소 = 의도 (셀프커스터디)
- [ ] 내부 합산은 sats 정수 권장 (Phase 2)
- [ ] 실효가 분모 0 차단 (Phase 1)

---

## 8. 보안

- xpub은 탈취로 송금 불가, **거래 내역 프라이버시**만 깨짐 → 도움말 명시
- 자가호스팅 mempool만 사용해 주소 목록 외부 유출 최소화
- 앱 잠금(appLock)은 설정 접근 보호 (기존)
