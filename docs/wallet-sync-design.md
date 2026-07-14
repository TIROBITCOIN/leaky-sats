# leaky-sats 지갑 동기화 설계 (제안 1 + 제안 2)

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

핵심 방향: **앱이 빼기 연산을 그만두고, 잔고는 체인에서 읽는다.**

---

## 1. 아키텍처 결정

### 1-1. 클라이언트 내장 방식 (채택)

leaky-sats는 백엔드 없는 Vite React PWA이므로, Atlas의 API 서버를 의존성으로 두지 않고
**xpub 파생과 mempool 조회를 브라우저에서 직접** 수행한다.

```
[leaky-sats PWA (브라우저)]
   ├── xpub → 주소 파생 (bip32 + bitcoinjs-lib, Atlas packages/bitcoin 포팅)
   ├── 주소별 UTXO 조회 (fetch → 자가호스팅 mempool API)
   └── 합산 → heldBtc 갱신
            │
            ▼ HTTPS (Tailscale ts.net)
[Umbrel의 mempool 앱]  ←  [자기 비트코인 풀노드]
```

- 설정한 self-hosted mempool URL을 우선 사용하고, 실패하거나 비어 있으면
  **mempool.space → blockstream.info 공개 API 체인으로 자동 전환**
  (예: `https://umbrel-xxxx.tailxxxx.ts.net/mempool/api` 또는 LAN `http://umbrel.local:3006/api`).
  xpub에서 파생된 주소가 외부 서버로 나가지 않는다.
- PWA가 HTTPS로 서빙되면 `http://` API는 mixed content로 차단됨 →
  **Tailscale HTTPS(ts.net 인증서) URL 사용을 문서/설정 UI에 명시**. `http://localhost`만 예외.
- 대안(비채택): Atlas API를 잔고 서버로 사용. 인증(TOTP 세션) 연동이 과하고 Atlas 상시 구동이
  전제되어 제외. 단, mempool 요청 유틸(타임아웃/재시도/동시성)은 Atlas 코드를 그대로 참고한다.

### 1-2. 라이브러리

| 용도 | 패키지 | 비고 |
|---|---|---|
| BIP32 파생 | `bip32` | Atlas와 동일 |
| 주소 생성 | `bitcoinjs-lib` | Atlas와 동일 |
| base58check | `bs58check` | zpub/ypub → xpub 버전 변환용 |
| ECC | `@bitcoinerlab/secp256k1` | **Atlas는 `tiny-secp256k1`(WASM)이지만, Vite PWA에서 WASM 설정을 피하기 위해 순수 JS 구현으로 교체.** bip32/bitcoinjs-lib와 인터페이스 호환 |

번들 증가 ~150-250KB gzip. 지갑 미설정 사용자를 위해 `wallet/` 모듈 전체를
`import()` 동적 로딩(코드 스플리팅)한다.

---

## 2. 신규 모듈: `src/lib/wallet/`

### 2-1. `xpub.ts` — 주소 파생 (Atlas `packages/bitcoin/src/index.ts` 포팅)

Atlas에서 가져올 것 (거의 그대로):
- `detectExtendedPublicKeyKind()` — xpub/ypub/zpub/tpub/upub/vpub 접두어 감지
- `scriptTypeForExtendedPublicKey()` — zpub→native-segwit, ypub→nested, xpub→legacy
- `convertToCanonicalVersion()` — bs58check로 버전 바이트 교체 (zpub을 bip32가 읽을 수 있게)
- `deriveAddresses()` — receive(0)/change(1) 체인, startIndex/limit 지정 파생
- `paymentAddress()` — p2pkh / p2sh-p2wpkh / p2wpkh / p2tr

leaky-sats 단순화:
- 네트워크는 `mainnet` 고정 (테스트넷 분기 제거)
- 멀티 지갑 없음 — 지갑 1개 (xpub 1개 또는 descriptor 없이 단일 계정)
- **추가 입력 모드: 개별 주소 목록.** xpub 없이 주소 몇 개만 등록하는 콜드월렛
  사용자를 위해 `addresses: string[]` 모드도 지원 (파생 스킵, 조회만)

```ts
export interface WalletDescriptor {
  kind: "xpub" | "addresses";
  xpub?: string;              // kind === "xpub"
  scriptType?: ScriptType;    // 자동감지값 override 가능
  addresses?: string[];       // kind === "addresses"
}

/** 지갑은 여러 개 등록 가능 — 설정에서는 개별, 홈에서는 합산 표시 */
export interface WalletEntry {
  id: string;                 // wallet_{timestamp}_{rand} (btcSellRecords generateId 패턴)
  label: string;              // "콜드카드", "핫월렛" 등 사용자 지정
  descriptor: WalletDescriptor;
  includeInTotal: boolean;    // 합산 포함 토글 (기본 true)
  createdAt: string;
}
```

### 2-2. `mempoolClient.ts` — HTTP 유틸 (Atlas `mempool/request.ts` 포팅)

그대로 가져올 것:
- 타임아웃 4초(`AbortSignal.timeout`), 재시도 1회, 재시도 가능 에러 판별(`isRetryableMempoolError`)
- `mapWithConcurrency()` — 주소 조회 동시성 4

leaky-sats 기존 `priceApi.ts`의 `fetchJson` 패턴과 톤을 맞춘다.

사용 엔드포인트 (mempool/esplera 호환):
- `GET {base}/address/{addr}/utxo` — UTXO 목록 (Atlas와 동일)
- `GET {base}/blocks/tip/height` — 연결 테스트용 (priceApi에 이미 유사 코드 존재)

### 2-3. `scan.ts` — gap limit 스캔 (Atlas discovery 로직 참고)

```ts
export interface ScanOptions {
  gapLimit: number;      // 기본 20, 설정에서 1~200 (Atlas와 동일 범위)
  batchSize: number;     // 한 번에 파생/조회할 주소 수, 기본 = gapLimit
  hardCap: number;       // 안전 상한, 기본 200 (Atlas의 safety cap 개념)
}
```

알고리즘 (receive/change 체인 각각):
1. `startIndex`부터 `batchSize`개 파생 → 각 주소 UTXO 조회
2. "사용됨" 판정: UTXO가 있거나 `/address/{addr}` 의 `chain_stats.tx_count > 0`
   (잔고 0이지만 과거에 쓴 주소도 gap을 리셋해야 하므로 tx_count 확인 필요)
3. 캐시된 마지막 사용 인덱스까지는 gap 종료를 금지하고, 그 경계를 지난 뒤 연속 미사용이 `gapLimit`에 도달하면 종료
4. `hardCap` 도달 시 `partial` 상태로 종료 (Atlas의 "reached the safety cap" 메시지 참고)

캐시: 파생 주소 목록과 마지막 사용 인덱스를 localStorage에 저장
(`myledger.wallet.addressCache.v1`). 재동기화 시 파생을 다시 하지 않고
receive/change별 캐시 경계를 먼저 보장한 뒤 "마지막 사용 인덱스 + gapLimit"까지만 조회한다. 주소 캐시가 유실된 경우 마지막 성공 잔고의 인덱스 메타데이터로 경계를 복구한다.

### 2-4. `balance.ts` — 합산 (Atlas `mempool/utxos.ts`의 `buildSummary` 포팅)

- outpoint(`txid:vout`) 기준 중복 제거 (Atlas와 동일)
- 결과:

```ts
export interface WalletBalance {
  confirmedSats: number;
  unconfirmedSats: number;
  totalSats: number;
  utxoCount: number;
  status: "online" | "partial" | "offline";  // Atlas와 동일한 3단계
  failedAddresses: number;
  fetchedAt: string; // ISO
}
```

- `partial`(일부 주소 조회 실패) 상태에서는 **heldBtc를 갱신하지 않는다** —
  잔고가 실제보다 적게 잡히는 사고 방지. `offline`도 동일하게 마지막 성공값 유지.

### 2-5. `walletConfig.ts` — 설정/상태 저장

localStorage 키 (기존 컨벤션 유지):

| 키 | 내용 |
|---|---|
| `myledger.wallet.config.v1` | `{ enabled, wallets: WalletEntry[], mempoolApiUrl, gapLimit, includeUnconfirmed }` |
| `myledger.wallet.addressCache.v1` | 지갑 id별 파생 주소 + 사용 인덱스 캐시 (`Record<walletId, AddressCache>`) |
| `myledger.wallet.lastBalance.v1` | 지갑 id별 마지막 성공 `WalletBalance` (`Record<walletId, WalletBalance>`) |

합산 규칙:
- 홈의 heldBtc = `includeInTotal === true`인 지갑들의 `totalSats` 합
- **지갑별 독립 갱신**: 지갑 A 조회 성공 + B 실패 시, A만 갱신하고 B는 마지막 성공값 유지.
  실패 시도 메타데이터는 보존하되 지갑 행에 별도 경고 문구를 추가하지 않는다.
- 같은 주소가 두 지갑에 중복 등록되면 outpoint 전역 중복 제거로 이중 계산 방지

`backup.ts`의 내보내기/복원 대상에 위 3개 키 추가.

### 2-6. `walletSync.ts` — 동기화 오케스트레이션

- 트리거: ① 앱 시작 직후, ② 2분 주기, ③ 포그라운드/네트워크 복구,
  ④ 설정의 "지금 동기화" 버튼, ⑤ 판매 기록 저장 직후
- 자동 주기는 100초 기본 throttle과 429 adaptive backoff를 적용한다. 강제 트리거는 일반 throttle을 우회한다.
- 동시 실행 중 추가 호출은 즉시 반환하며, 전체 실행은 65초 상한에서 취소하고 락을 해제한다.
- 일반 장애 API는 5분간 자동 제외하되 강제 트리거에서 재확인한다. 429 대기 시간은 우회하지 않는다.
- 성공 시: `setHeldBtc(totalSats / 1e8)` + `lastBalance` 저장 + 이벤트 발행 →
  HomePage의 기존 `setHeldBtc(getHeldBtc())` 새로고침 흐름에 연결

---

## 3. `heldBtc.ts` 이중 모드

```ts
export type HeldBtcMode = "manual" | "wallet-sync";
```

- `manual` (기존): 설정에서 손 입력, 판매 확정 시 차감 — **하위 호환 그대로 유지**
- `wallet-sync`: `getHeldBtc()`는 `lastBalance.totalSats`(또는 confirmed만, 설정에 따라) 반환.
  설정의 수동 입력칸은 읽기 전용으로 전환 + "지갑 동기화 사용 중" 표시.
  **판매 확정 시 heldBtc 차감을 하지 않는다** (`deductedFromHeldBtc: false`로 저장) —
  코인이 실제로 나가면 다음 동기화 때 반영되기 때문. 이중 차감 버그 원천 차단.

UI 표시 (BalanceCard):
- 동기화 모드일 때: 마지막 동기화 시각, `unconfirmedSats > 0`이면 "확정 대기 ⏳ n sats" 뱃지
- `partial/offline`에서도 안전하게 보존한 마지막 잔고와 성공 시각을 표시하고 별도 경고 배지는 붙이지 않는다.

---

## 4. 제안 1: 판매 확정 실측 입력 (`SellConfirmModal` v2)

### 4-1. 입력 필드 (미니멀)

모달 = 제목 "판매 확정" + 입력 2개 + 버튼. 그 외 전부 제거.

| 필드 | 라벨 | 기본값 |
|---|---|---|
| `krwReceived` | **받은 원화** | 이번 기간 부족분 |
| `btcSpentFromWallet` | **보낸 비트코인** (전송 수수료 포함, 지갑 표시값) | wallet-sync 모드: 마지막 동기화 대비 온체인 감소분 자동 채움(수정 가능) / manual 모드: 빈칸 |

- 제거: 전송 수수료 입력, 실효 매도가, 앱 시세, 시세 대비 표시줄.
  실효가/김프는 저장값(`krwReceived ÷ btcSpentFromWallet`, `marketBtcKrwAtSell` 스냅샷)으로
  계산 가능하므로 **기록은 유지하되 표시는 월/연 요약 카드로 이동** (Phase 4)
- sats 환산 한 줄(`1,943,007 sats`)은 유지 — 오타 감지에 유용

### 4-1-b. 흑자 상태

`netKrw ≥ 0`이면 판매 버튼 진입 시 모달 대신 상태 표시:
**"이번 정산기간에는 팔 비트코인이 없습니다"** — 버튼을 숨기기보다 SellNeededCard 자체를
흑자 상태 문구로 전환하는 편이 명확 (버튼이 사라지면 고장으로 오해)

### 4-1-c. 보낸 비트코인 자동 계산

- **wallet-sync 모드**: 가능. 판매 확정 진입 시 즉시 재동기화 → `직전 잔고 − 현재 잔고`를
  기본값으로 채움. 단 ① 같은 창에 DCA 입금이 겹치면 오염, ② 거래소에 미리 보내둔 물량을
  판 경우 지갑 변화 없음 → 그래서 **자동 채움 + 수정 가능**이지 자동 확정이 아님
- **manual 모드**: 불가 (읽어올 원본이 없음) — 빈칸 수동 입력
- Phase 4 후보: 최근 outgoing tx 목록(`/address/{addr}/txs`)에서 해당 전송을 탭으로 선택 →
  수수료 포함 정확값 자동 입력

### 4-1-d. 매수(DCA) 흐름

- 보유 BTC: 매수분이 지갑에 도착하면 **동기화로 자동 반영** — 손댈 것 없음
- 원화 장부(수입−지출의 DCA 지출 기록): **수동 유지**. 체인은 sats 도착만 알지
  얼마 주고 샀는지(원화·김프·수수료)는 모름 + 입금이 매수인지 내 지갑 간 이동인지 구분 불가.
  자동 분류는 오기록 위험
- 보조 아이디어(Phase 4): 동기화가 기록에 없는 신규 입금 UTXO를 감지하면
  "새로 들어온 +n sats — DCA 매수로 기록할까요?" 프롬프트 → sats 자동, 원화만 입력.
  정기 DCA는 기존 `recurringRules`로도 커버 가능

### 4-2. `BtcSellRecord` 스키마 v2

```ts
export interface BtcSellRecord {
  // --- 기존 필드 전부 유지 (하위 호환) ---
  id: string; month: string; date: string;
  btcSold: number; satsSold: number;      // v2부터 = btcSpentFromWallet 기준
  btcKrwAtSell: number;                   // v2부터 = 실효 매도가
  krwCovered: number;                     // v2부터 = krwReceived (의미만 실측으로)
  deficitKrwAtConfirm: number;
  deductedFromHeldBtc: boolean; deductedBtcAmount?: number;
  note?: string; createdAt: string;

  // --- v2 신규 ---
  schemaVersion?: 2;
  btcSpentFromWallet?: number;   // 실측: 지갑에서 나간 총량
  krwReceived?: number;          // 실측: 입금 원화 (krwCovered와 동일값 저장, 명시적 필드)
  marketBtcKrwAtSell?: number;   // 당시 앱 시세 스냅샷 (김프 계산용)
  networkFeeSats?: number;
}
```

- `isValidRecord()`에 신규 필드 optional 검증 추가 (기존 레코드는 v1로 그대로 유효)
- `isSellCompleted()` 판정은 지금도 `krwCovered` 기준이므로 변경 불필요 —
  의미가 "실제 받은 원화"로 바뀌면서 오히려 더 정확해짐
- 월/연 요약 카드에 "실효 평균 매도가", "김프 평균" 항목 추가 가능 (Phase 4)

---

## 5. 설정 UI (`SettingsPage` 신규 카드: "지갑 동기화")

원칙: **설정에서는 지갑별로 따로, 홈에서는 합쳐서.**
그리고 **새 디자인 언어를 만들지 않는다 — 전부 기존 leaky-sats 패턴 재사용.**

### 5-0. 기존 UI 패턴 매핑 (신규 CSS 최소화)

| 신규 UI | 재사용할 기존 패턴 |
|---|---|
| 카드 컨테이너/제목/설명 | `ldg-card` + `ldg-setting-label` + `ldg-setting-desc` (다른 설정 카드와 동일) |
| mempool URL 입력 + 연결 테스트 버튼 | `ldg-wallet-name-form` + `ldg-input` + `ldg-wallet-name-btns`의 `ldg-submit-btn secondary` (지갑 이름/보유 BTC 입력과 동일한 input+버튼 조합) |
| 지갑 목록 행 | **`CategoryManager`의 `ldg-cat-row` 패턴 그대로** — 좌측 스와치 자리에 상태 점, 가운데 라벨(flex:1), 우측 `ldg-cat-manage-actions`의 `ldg-icon-action` 아이콘 버튼(연필=이름변경, 휴지통=삭제) |
| 이름 변경 | CategoryManager의 인라인 편집 전환 패턴(`ldg-cat-form`) — 행이 그 자리에서 `ldg-input` + 저장/취소로 바뀜. 모달 없음 |
| 지갑 추가 폼 | CategoryManager의 "추가" 인라인 폼 패턴 (`ldg-cat-form` + `ldg-cat-form-actions`) |
| 합산 포함 토글 | 기존에 토글 컴포넌트가 없으므로 `ldg-chip` 재사용 (선택 시 강조) 또는 체크박스 — 새 토글 스타일을 만들지 않음 |
| 상태/시각 서브텍스트 | `ldg-balance-sub` (현재 정산기간 표시와 동일 톤) |
| 연결 실패/성공 피드백 | `ldg-backup-status ok` 패턴 (백업 카드와 동일) |
| 삭제 확인 | 기존 판매 기록 삭제와 동일한 confirm 흐름 |

주의: 기존 `walletName.ts`(홈 제목용 "지갑 이름")와 **이름 충돌** — 신규 다중지갑 라벨은
`src/lib/wallet/` 네임스페이스의 `WalletEntry.label`로 완전히 분리하고, 설정 카드 제목도
"지갑 동기화"로 구분해 기존 "지갑 이름" 카드와 혼동을 피한다.

### 5-1. 카드 구성 (위→아래)

1. 모드 토글: 수동 / 지갑 동기화 (`ldg-radio-group` — 기존 라디오 그룹 재사용)
2. mempool API URL 입력 + **"연결 테스트"** 버튼 (`/blocks/tip/height` 호출, 성공 시 블록 높이 표시)
   - placeholder와 도움말(`ldg-setting-desc`)에 Tailscale HTTPS 예시, mixed content 주의 문구
3. **지갑 목록** — `ldg-cat-row` 스타일 행, 지갑마다:
   - 상태 점(● 초록=온라인 / 노랑=partial·stale / 회색=오프라인)
   - **라벨** (기본값 "지갑 N", 2~24자 — 기존 `walletName.ts`의 MIN/MAX 규칙 재사용) + 서브라인: 마지막 동기화 · 미확정 있으면 `⏳ +n`
   - **xpub은 저장 후 어디에도 표시하지 않는다** (복사/내보내기 버튼도 없음) —
     구분은 라벨로 충분. MFP·파생 경로·디스크립터는 서명용 정보라 저장 자체를 안 함
   - 대신 **중복 등록 검사**: 같은 xpub(또는 동일 주소) 추가 시 "이미 등록된 지갑입니다" 차단
     (화면에 안 보이므로 내부 검사가 유일한 방어선)
   - 개별 잔고 (설정 단위)
   - `ldg-icon-action` 연필 → **인라인 이름 변경** (행이 입력폼으로 전환, 저장/취소)
   - `ldg-icon-action` 휴지통 → 삭제 (확인 후)
   - 합산 포함 체크/칩 (끄면 홈 합산 제외, 잔고는 계속 표시)
4. **"+ 지갑 추가"** — CategoryManager 추가 패턴의 인라인 폼:
   - 라벨 입력 (기본값 "지갑 N")
   - xpub 붙여넣기 또는 "주소 직접 입력" 전환 (`ldg-chip-group`)
   - xpub 형식/버전 검증 실패 시 즉시 에러 (Atlas의 에러 메시지 참고)
   - 검증 통과 시 **파생 주소 첫 3개 미리보기** — 사용자가 자기 지갑 앱과 대조 (오입력 방지)
   - 저장 시 해당 지갑만 즉시 첫 스캔 (진행 표시)
5. 공용 옵션: gap limit `ldg-select` (기본 20), 미확정 잔고 포함 여부
6. "전체 동기화" `ldg-submit-btn secondary` + 마지막 결과 (`ldg-balance-sub`)

### 5-2. 홈 화면 (BalanceCard) — 기존 레이아웃 유지

- 메인 숫자/단위 표시는 **기존 BalanceCard 그대로**, 값만 합산으로
- 서브 라인 한 줄만 추가: `지갑 3개 · 2분 전 동기화` (`ldg-balance-sub` 톤, 수동 모드면 미표시)
- 카드 탭 → 지갑별 브레이크다운 확장/접기 (라벨 + 개별 잔고, 읽기 전용) —
  기존 카드 확장 인터랙션이 없으므로 단순 conditional render, 애니메이션 불필요
- 일부 실패 시: 서브 라인을 기존 시세 지연 경고와 동일한 톤으로 `지갑 1개 조회 실패 · 마지막 값 포함`

보안:
- xpub은 개인키가 아니므로 유출돼도 자금 탈취는 불가능하지만 **전체 거래내역 프라이버시가 깨진다** —
  도움말에 명시하고, 기존 `appLock` 활성 시 설정 페이지 접근이 이미 보호되는지 확인
- 백업 파일에 xpub 포함됨을 내보내기 시점에 경고 문구로 안내

---

## 6. 구현 순서 (Phase)

| Phase | 내용 | 파일 | 리스크 |
|---|---|---|---|
| **1** | 판매 확정 실측 입력 (제안 1) — 스키마 v2, 모달 2필드, manual 모드 차감을 실측 기준으로 | `btcSellRecords.ts`, `SellConfirmModal.tsx`, `sellCompletion.ts`(무변경 확인) | 낮음 |
| **2** | `wallet/` 모듈 — xpub 파생 + mempool 클라이언트 + 스캔/합산, 유닛 테스트(파생 벡터는 Atlas 테스트 참고) | `src/lib/wallet/*` 신규 | 중간 (라이브러리 번들) |
| **3** | 설정 UI + sync 오케스트레이션 + heldBtc 이중 모드 + BalanceCard 표시 | `SettingsPage.tsx`, `heldBtc.ts`, `HomePage.tsx`, `BalanceCard.tsx` | 중간 |
| **4** | 백업 포함, 김프/실효가 통계, 미확정 뱃지 폴리시 | `backup.ts`, 요약 카드들 | 낮음 |

Phase 1은 독립적으로 배포 가능 — 지갑 연동 없이도 오차 누적이 즉시 멈춘다.

---

## 7. 엣지 케이스 체크리스트

- [ ] mempool CORS: 자가호스팅 mempool이 `Access-Control-Allow-Origin`을 안 주면 브라우저에서 차단됨.
      연결 테스트에서 CORS 실패를 감지해 "mempool 앱의 CORS 설정 또는 리버스프록시 헤더 추가 필요" 안내
- [ ] 파생 중 UI 블로킹: 주소 200개 파생은 수십 ms 수준이라 워커 불필요하나, 조회는 async 진행 표시
- [ ] 판매 저장 직후 동기화: 전송 tx가 아직 브로드캐스트 전이면 잔고가 안 줄어 있음 —
      정상 상황임을 이해하고, 미확정/미전송 상태를 오차로 표시하지 않기
- [ ] 사용자가 wallet-sync 모드에서 앱 밖 사유로 BTC를 받으면 heldBtc가 늘어남 — 의도된 동작 (DCA 자동 반영)
- [ ] 거래소에 보낸 뒤 아직 안 판 물량: 지갑 잔고에서 빠지므로 heldBtc 감소 — 의도된 동작
      (셀프커스터디 기준). 원하면 Phase 4에서 "거래소 대기 물량" 수동 항목 추가
- [ ] localStorage 용량: 주소 캐시 200개 × ~100B ≈ 20KB — 문제 없음
- [ ] PWA 오프라인: 동기화 실패 시 조용히 마지막 값 유지, 오프라인 뱃지 기존 패턴 재사용
