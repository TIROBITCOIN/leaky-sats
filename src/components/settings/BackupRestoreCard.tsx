import { useRef, useState, type ChangeEvent } from "react";
import {
  downloadBackup,
  parseBackupFile,
  prepareBackupRestore,
  restoreBackupPayload,
  type BackupPayload,
  type BackupPreview,
} from "../../lib/backup";

type Status = { tone: "ok" | "error" | "idle"; text: string };
type PendingRestore = { fileName: string; payload: BackupPayload; preview: BackupPreview };

export default function BackupRestoreCard() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState<Status>({
    tone: "idle",
    text: "백업 파일은 개인 기기에 안전하게 보관하세요.",
  });
  const [pendingRestore, setPendingRestore] = useState<PendingRestore | null>(null);

  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const payload = await parseBackupFile(file);
      const prepared = prepareBackupRestore(payload);
      setPendingRestore({ fileName: file.name, payload, preview: prepared.preview });
      setStatus({ tone: "idle", text: "복원할 내용을 확인한 뒤 복원 버튼을 눌러주세요." });
    } catch (error) {
      setPendingRestore(null);
      setStatus({ tone: "error", text: error instanceof Error ? error.message : "백업 복원에 실패했습니다." });
    }
  };

  const handleRestore = () => {
    if (!pendingRestore) return;
    const ok = window.confirm(
      "백업을 복원하면 현재 데이터가 자동 안전백업된 뒤 선택한 데이터로 교체됩니다. 계속할까요?"
    );
    if (!ok) return;

    try {
      restoreBackupPayload(pendingRestore.payload);
      setPendingRestore(null);
      setStatus({ tone: "ok", text: "복원 완료. 앱을 새로고침하면 적용됩니다." });
    } catch (error) {
      setStatus({ tone: "error", text: error instanceof Error ? error.message : "백업 복원에 실패했습니다." });
    }
  };

  return (
    <div className="ldg-card">
      <div className="ldg-label" style={{ marginBottom: 10 }}>
        백업 / 복원
      </div>
      <div className="ldg-page-sub" style={{ marginBottom: 12 }}>
        localStorage 전용 앱이라 브라우저 데이터 삭제나 기기 변경 전에 백업이 필요합니다. 시드, 개인키, API 키는 저장하지 않습니다.
      </div>
      <div className="ldg-backup-actions">
        <button className="ldg-submit-btn" type="button" onClick={downloadBackup}>
          백업 파일 다운로드
        </button>
        <button className="ldg-submit-btn secondary" type="button" onClick={() => inputRef.current?.click()}>
          백업 파일에서 복원
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        onChange={handleFileSelect}
        style={{ display: "none" }}
      />
      {pendingRestore && (
        <div className="ldg-setting-desc" style={{ marginTop: 12 }}>
          <div className="ldg-setting-label">복원할 데이터</div>
          <div>{pendingRestore.fileName}</div>
          <div>거래 {pendingRestore.preview.txnsCount}개</div>
          <div>카테고리 {pendingRestore.preview.categoriesCount}개</div>
          <div>BTC 판매 기록 {pendingRestore.preview.btcSellRecordsCount}개</div>
          <div>반복 항목 {pendingRestore.preview.recurringRulesCount}개</div>
          <div>반복 처리 기록 {pendingRestore.preview.recurringMaterializedCount}개</div>
          {pendingRestore.preview.hasHeldBtc && <div>보유 BTC 포함</div>}
          {pendingRestore.preview.hasSettlementDay && <div>정산 기준일 포함</div>}
          {pendingRestore.preview.invalidItemsRemoved > 0 && (
            <div className="ldg-backup-status error">
              잘못된 항목 {pendingRestore.preview.invalidItemsRemoved}개는 제외됩니다.
            </div>
          )}
          <div style={{ marginTop: 8 }}>복원 전 현재 데이터는 자동으로 안전백업됩니다.</div>
          <button className="ldg-submit-btn" type="button" style={{ marginTop: 10 }} onClick={handleRestore}>
            확인 후 복원
          </button>
        </div>
      )}
      <div className={`ldg-backup-status ${status.tone}`}>{status.text}</div>
    </div>
  );
}
