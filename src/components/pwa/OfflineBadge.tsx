import { useEffect, useState } from "react";

export default function OfflineBadge() {
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);

  useEffect(() => {
    const update = () => setIsOffline(!navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!isOffline) return null;
  return <div className="ldg-offline-badge">오프라인 · 저장된 거래는 계속 볼 수 있어요</div>;
}
