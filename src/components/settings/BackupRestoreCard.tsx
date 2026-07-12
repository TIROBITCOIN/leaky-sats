import { useRef, useState, type ChangeEvent } from "react";
import {
  decryptBackupFile,
  downloadBackup,
  downloadEncryptedBackup,
  loadLastBackupAt,
  prepareBackupRestore,
  readBackupFile,
  restoreBackupPayload,
  saveLastBackupAt,
  type EncryptedBackupFile,
  type BackupPayload,
  type BackupPreview,
} from "../../lib/backup";
import { backupContainsWatchDescriptors } from "../../lib/walletConfig";

type Status = { tone: "ok" | "error" | "idle"; text: string };
type PendingRestore = { fileName: string; payload: BackupPayload; preview: BackupPreview };
type PendingEncryptedRestore = { fileName: string; encrypted: EncryptedBackupFile };
const BACKUP_STALE_DAYS = 7;

function formatLastBackupAt(value: string | null): string {
  if (!value) return "아직 백업 기록 없음";
  return new Date(value).toLocaleString("ko-KR");
}

function isBackupStale(value: string | null): boolean {
  if (!value) return false;
  const ageMs = Date.now() - new Date(value).getTime();
  return ageMs >= BACKUP_STALE_DAYS * 24 * 60 * 60 * 1000;
}

export default function BackupRestoreCard() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState<Status>({
    tone: "idle",
    text: "백업 파일은 개인 기기에 안전하게 보관하세요.",
  });
  const [pendingRestore, setPendingRestore] = useState<PendingRestore | null>(null);
  const [pendingEncryptedRestore, setPendingEncryptedRestore] = useState<PendingEncryptedRestore | null>(null);
  const [encryptExport, setEncryptExport] = useState(false);
  const [backupPassword, setBackupPassword] = useState("");
  const [backupPasswordConfirm, setBackupPasswordConfirm] = useState("");
  const [restorePassword, setRestorePassword] = useState("");
  const [restoreCompleted, setRestoreCompleted] = useState(false);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(() => loadLastBackupAt());

  const recordBackupSuccess = () => {
    setLastBackupAt(saveLastBackupAt());
  };

  const preparePlainRestore = (fileName: string, payload: BackupPayload) => {
    const prepared = prepareBackupRestore(payload);
    setPendingRestore({ fileName, payload, preview: prepared.preview });
    setPendingEncryptedRestore(null);
    setRestorePassword("");
    setRestoreCompleted(false);
    setStatus({ tone: "idle", text: "복원할 내용을 확인한 뒤 복원 버튼을 눌러주세요." });
  };

  const handleDownload = async () => {
    const watchNote = backupContainsWatchDescriptors()
      ? " 주의: 백업에 와치온리 xpub/주소가 포함됩니다. 유출 시 거래 내역 프라이버시가 깨질 수 있으니 안전하게 보관하세요."
      : "";
    if (!encryptExport) {
      downloadBackup();
      recordBackupSuccess();
      setStatus({
        tone: "ok",
        text: `백업 파일을 다운로드했습니다. 마지막 백업 시간이 저장되었습니다.${watchNote}`,
      });
      return;
    }
    if (!backupPassword) {
      setStatus({ tone: "error", text: "백업 비밀번호를 입력해주세요." });
      return;
    }
    if (backupPassword !== backupPasswordConfirm) {
      setStatus({ tone: "error", text: "백업 비밀번호가 서로 일치하지 않습니다." });
      return;
    }
    try {
      await downloadEncryptedBackup(backupPassword);
      recordBackupSuccess();
      setBackupPassword("");
      setBackupPasswordConfirm("");
      setStatus({
        tone: "ok",
        text: `암호화 백업 파일을 다운로드했습니다. 마지막 백업 시간이 저장되었습니다.${watchNote}`,
      });
    } catch (error) {
      setStatus({ tone: "error", text: error instanceof Error ? error.message : "암호화 백업에 실패했습니다." });
    }
  };

  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const result = await readBackupFile(file);
      if (result.kind === "encrypted") {
        setPendingRestore(null);
        setPendingEncryptedRestore({ fileName: file.name, encrypted: result.encrypted });
        setRestorePassword("");
        setRestoreCompleted(false);
        setStatus({ tone: "idle", text: "암호화 백업입니다. 백업 비밀번호를 입력해주세요." });
        return;
      }
      preparePlainRestore(file.name, result.payload);
    } catch (error) {
      setPendingRestore(null);
      setPendingEncryptedRestore(null);
      setRestoreCompleted(false);
      setStatus({ tone: "error", text: error instanceof Error ? error.message : "백업 복원에 실패했습니다." });
    }
  };

  const handleDecryptRestore = async () => {
    if (!pendingEncryptedRestore) return;
    if (!restorePassword) {
      setStatus({ tone: "error", text: "백업 비밀번호를 입력해주세요." });
      return;
    }
    try {
      const payload = await decryptBackupFile(pendingEncryptedRestore.encrypted, restorePassword);
      preparePlainRestore(pendingEncryptedRestore.fileName, payload);
    } catch (error) {
      setStatus({ tone: "error", text: error instanceof Error ? error.message : "암호화 백업 복호화에 실패했습니다." });
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
      setPendingEncryptedRestore(null);
      setRestorePassword("");
      setRestoreCompleted(true);
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
        백업 시 등록된 공개키가 포함될 수 있습니다.
      </div>
      <div className="ldg-backup-status idle" style={{ marginBottom: 12 }}>
        마지막 백업: {formatLastBackupAt(lastBackupAt)}
      </div>
      {isBackupStale(lastBackupAt) && (
        <div className="ldg-backup-status error" style={{ marginBottom: 12 }}>
          마지막 백업 후 7일 이상 지났습니다. 기기 변경/브라우저 삭제 전에 백업을 권장합니다.
        </div>
      )}
      <div className="ldg-backup-actions">
        <button className="ldg-submit-btn" type="button" onClick={handleDownload}>
          백업
        </button>
        <button className="ldg-submit-btn secondary" type="button" onClick={() => inputRef.current?.click()}>
          복구
        </button>
      </div>
      <div className="ldg-setting-desc" style={{ marginTop: 12 }}>
        <label>
          <input
            type="checkbox"
            checked={encryptExport}
            onChange={(event) => setEncryptExport(event.target.checked)}
          />{" "}
          암호화 백업
        </label>
        {encryptExport && (
          <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
            <input
              className="ldg-input"
              type="password"
              value={backupPassword}
              onChange={(event) => setBackupPassword(event.target.value)}
              placeholder="백업 비밀번호"
              autoComplete="new-password"
            />
            <input
              className="ldg-input"
              type="password"
              value={backupPasswordConfirm}
              onChange={(event) => setBackupPasswordConfirm(event.target.value)}
              placeholder="백업 비밀번호 확인"
              autoComplete="new-password"
            />
            <div className="ldg-backup-status error">비밀번호를 잊으면 이 백업은 복구할 수 없습니다.</div>
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        onChange={handleFileSelect}
        style={{ display: "none" }}
      />
      {pendingEncryptedRestore && (
        <div className="ldg-setting-desc" style={{ marginTop: 12 }}>
          <div className="ldg-setting-label">암호화 백업</div>
          <div>{pendingEncryptedRestore.fileName}</div>
          <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
            <input
              className="ldg-input"
              type="password"
              value={restorePassword}
              onChange={(event) => setRestorePassword(event.target.value)}
              placeholder="백업 비밀번호"
              autoComplete="current-password"
            />
            <button className="ldg-submit-btn" type="button" onClick={handleDecryptRestore}>
              비밀번호 확인
            </button>
          </div>
        </div>
      )}
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
      {restoreCompleted && (
        <div className="ldg-backup-status idle" style={{ marginTop: 10 }}>
          복원 완료 후 화면 새로고침이 필요할 수 있습니다.
        </div>
      )}
      {restoreCompleted && (
        <button
          className="ldg-submit-btn secondary"
          type="button"
          style={{ marginTop: 10 }}
          onClick={() => window.location.reload()}
        >
          지금 새로고침
        </button>
      )}
    </div>
  );
}
