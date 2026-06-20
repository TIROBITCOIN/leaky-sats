import { useRef, useState, type ChangeEvent } from "react";
import { downloadBackup, parseBackupFile, restoreBackupPayload } from "../../lib/backup";

type Status = { tone: "ok" | "error" | "idle"; text: string };

export default function BackupRestoreCard() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState<Status>({
    tone: "idle",
    text: "백업 파일은 개인 기기에 안전하게 보관하세요.",
  });

  const handleRestore = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const payload = await parseBackupFile(file);
      const ok = window.confirm(
        "백업을 복원하면 현재 이 브라우저의 거래/카테고리 데이터가 덮어써집니다. 계속할까요?"
      );
      if (!ok) return;
      restoreBackupPayload(payload);
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
      <input ref={inputRef} type="file" accept="application/json,.json" onChange={handleRestore} style={{ display: "none" }} />
      <div className={`ldg-backup-status ${status.tone}`}>{status.text}</div>
    </div>
  );
}
