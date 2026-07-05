export function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || !import.meta.env.PROD) return;

  // 새 서비스워커가 제어권을 잡으면(= 새 배포가 활성화되면) 페이지를 한 번만 새로고침해서 최신
  // 번들을 로드한다. sw.js는 배포마다 CACHE_VERSION이 바뀌어 바이트가 달라지므로 브라우저가
  // 항상 업데이트를 감지하고, install의 skipWaiting + activate의 clients.claim 덕분에 새 워커가
  // 즉시 활성화되어 아래 controllerchange가 트리거된다.
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((registration) => {
        // 앱이 이미 떠 있는(설치형 PWA 포함) 동안 새 배포가 나와도 감지하도록, 포커스/가시성
        // 복귀 시 업데이트를 확인한다. 새 sw.js가 있으면 updatefound → 설치 → 활성화 →
        // controllerchange 순으로 자동 새로고침이 이어진다.
        const checkForUpdate = () => registration.update().catch(() => {});
        window.addEventListener("focus", checkForUpdate);
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") checkForUpdate();
        });

        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "activated") {
              // 활성화 완료 — controllerchange 핸들러가 새로고침을 처리한다. 외부에서 참조할 수
              // 있도록 이벤트도 함께 알린다.
              window.dispatchEvent(new CustomEvent("myledger-sw-update-ready"));
            }
          });
        });
      })
      .catch((error) => {
        console.warn("Service worker registration failed", error);
      });
  });
}
