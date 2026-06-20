import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LedgerProvider } from "./state/LedgerContext";
import PageContainer from "./components/layout/PageContainer";
import TabBar from "./components/layout/TabBar";
import HomePage from "./components/home/HomePage";
import TransactionEntryPage from "./components/transaction/TransactionEntryPage";
import TxnListPage from "./components/transaction/TxnListPage";
import StatsPage from "./components/stats/StatsPage";
import AssetsPage from "./components/assets/AssetsPage";
import SettingsPage from "./components/settings/SettingsPage";
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
                <Route path="/assets" element={<AssetsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
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
