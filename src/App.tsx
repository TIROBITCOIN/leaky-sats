import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LedgerProvider } from "./state/LedgerContext";
import PageContainer from "./components/layout/PageContainer";
import TabBar from "./components/layout/TabBar";
import HomePage from "./components/home/HomePage";
import TransactionEntryPage from "./components/transaction/TransactionEntryPage";
import TxnListPage from "./components/transaction/TxnListPage";
import StatsPage from "./components/stats/StatsPage";
import SettingsPage from "./components/settings/SettingsPage";
import HelpPage from "./components/settings/HelpPage";
import UndoToast from "./components/common/UndoToast";
import OfflineBadge from "./components/pwa/OfflineBadge";
import InstallPrompt from "./components/pwa/InstallPrompt";
import AppLockGate from "./components/security/AppLockGate";

export default function App() {
  return (
    <LedgerProvider>
      <BrowserRouter>
        <AppLockGate>
          <PageContainer>
            <div className="app-main">
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/add" element={<TransactionEntryPage />} />
                <Route path="/transactions" element={<TxnListPage />} />
                <Route path="/stats" element={<StatsPage />} />
                {/* Phase 13.1: 자산 탭 제거 — 옛 북마크/링크로 들어오면 빈 화면 대신 홈으로 보낸다. */}
                <Route path="/assets" element={<Navigate to="/" replace />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/help" element={<HelpPage />} />
              </Routes>
            </div>
            <TabBar />
            <OfflineBadge />
            <InstallPrompt />
            <UndoToast />
          </PageContainer>
        </AppLockGate>
      </BrowserRouter>
    </LedgerProvider>
  );
}
