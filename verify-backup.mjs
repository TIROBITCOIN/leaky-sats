import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const backupPath = join(root, "src", "lib", "backup.ts");
const cardPath = join(root, "src", "components", "settings", "BackupRestoreCard.tsx");
const deploymentPath = join(root, "docs", "DEPLOYMENT.md");
const readmePath = join(root, "README.md");

assert.equal(existsSync(backupPath), true, "src/lib/backup.ts exists");
const backup = readFileSync(backupPath, "utf8");
assert.match(backup, /createBackupPayload/, "createBackupPayload exists");
assert.match(backup, /downloadBackup/, "downloadBackup exists");
assert.match(backup, /parseBackupFile/, "parseBackupFile exists");
assert.match(backup, /validateBackupPayload/, "validateBackupPayload exists");
assert.match(backup, /restoreBackupPayload/, "restoreBackupPayload exists");
assert.match(backup, /app: APP_ID/, "backup payload includes app");
assert.match(backup, /version: BACKUP_VERSION/, "backup payload includes version");
assert.match(backup, /createdAt:/, "backup payload includes createdAt");
assert.match(backup, /myledger\.txns\.v1/, "txns key included");
assert.match(backup, /myledger\.categories\.v1/, "categories key included");
assert.doesNotMatch(backup, /pendingUndo.*createBackupPayload/s, "pendingUndo is not backed up");
assert.match(backup, /value\.app !== APP_ID/, "wrong app is rejected");
assert.match(backup, /value\.version !== BACKUP_VERSION/, "wrong version is rejected");
assert.match(backup, /JSON\.parse/, "invalid JSON import is handled");

assert.equal(existsSync(cardPath), true, "BackupRestoreCard exists");
const card = readFileSync(cardPath, "utf8");
assert.match(card, /window\.confirm/, "restore requires confirmation");
assert.match(card, /백업 파일 다운로드/, "download UI exists");
assert.match(card, /백업 파일에서 복원/, "restore UI exists");

assert.equal(existsSync(deploymentPath), true, "deployment docs exist");
const docs = readFileSync(deploymentPath, "utf8");
const readme = readFileSync(readmePath, "utf8");
assert.match(docs + readme, /localStorage-only|localStorage 전용/, "localStorage-only warning documented");
assert.match(docs + readme, /시드|개인키|API 키/, "sensitive key warning documented");

console.log("verify:backup passed");
