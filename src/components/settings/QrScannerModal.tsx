import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { parseWatchOnlyQrText, type QrWatchPayload } from "../../lib/wallet/qrParse";

type Props = {
  open: boolean;
  onClose: () => void;
  onScan: (payload: QrWatchPayload) => void;
};

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};

function getBarcodeDetector(): BarcodeDetectorLike | null {
  const BD = (window as unknown as { BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike })
    .BarcodeDetector;
  if (!BD) return null;
  try {
    return new BD({ formats: ["qr_code"] });
  } catch {
    return null;
  }
}

function permissionMessage(err: unknown): string {
  const name = err && typeof err === "object" && "name" in err ? String((err as { name: string }).name) : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "카메라 권한이 거부되었습니다. 브라우저/OS 설정에서 허용한 뒤 다시 시도하세요.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "사용 가능한 카메라를 찾지 못했습니다.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "카메라가 다른 앱에서 사용 중이거나 시작할 수 없습니다.";
  }
  if (typeof location !== "undefined" && location.protocol !== "https:" && location.hostname !== "localhost") {
    return "카메라 접근은 HTTPS(또는 localhost)에서만 가능합니다.";
  }
  return err instanceof Error ? err.message : "카메라를 열 수 없습니다.";
}

export default function QrScannerModal({ open, onClose, onScan }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const timerRef = useRef<number>(0);
  const closedRef = useRef(false);
  const handledRef = useRef(false);

  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("카메라 준비 중…");
  const [fileBusy, setFileBusy] = useState(false);

  const stopCamera = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = 0;
    }
    const stream = streamRef.current;
    streamRef.current = null;
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
    }
    const video = videoRef.current;
    if (video) {
      video.srcObject = null;
    }
  }, []);

  const handleRaw = useCallback(
    (raw: string) => {
      if (handledRef.current || closedRef.current) return;
      const parsed = parseWatchOnlyQrText(raw);
      if (!parsed.ok) {
        setError(parsed.error);
        setStatus("다시 스캔하거나 다른 QR을 비춰 주세요.");
        return;
      }
      handledRef.current = true;
      stopCamera();
      onScan(parsed.payload);
      onClose();
    },
    [onClose, onScan, stopCamera]
  );

  const decodeCanvas = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!(w > 0 && h > 0)) return;

    // Downscale for jsQR performance on mobile
    const maxSide = 640;
    const scale = Math.min(1, maxSide / Math.max(w, h));
    const cw = Math.max(1, Math.round(w * scale));
    const ch = Math.max(1, Math.round(h * scale));
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, cw, ch);
    const imageData = ctx.getImageData(0, 0, cw, ch);

    const detector = getBarcodeDetector();
    if (detector) {
      try {
        const codes = await detector.detect(canvas);
        const raw = codes[0]?.rawValue;
        if (raw) {
          handleRaw(raw);
          return;
        }
      } catch {
        /* fall through to jsqr */
      }
    }

    try {
      const { default: jsQR } = await import("jsqr");
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });
      if (code?.data) handleRaw(code.data);
    } catch {
      /* keep scanning */
    }
  }, [handleRaw]);

  useEffect(() => {
    if (!open) return;
    closedRef.current = false;
    handledRef.current = false;
    setError(null);
    setStatus("카메라 준비 중…");

    let cancelled = false;

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("이 브라우저는 카메라 API를 지원하지 않습니다. 아래에서 QR 이미지를 선택하세요.");
        setStatus("이미지로 불러오기");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        if (cancelled) {
          for (const t of stream.getTracks()) t.stop();
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        video.setAttribute("playsinline", "true");
        video.muted = true;
        await video.play();
        setStatus("QR 코드를 사각형 안에 맞춰 주세요");

        const tick = () => {
          if (cancelled || closedRef.current || handledRef.current) return;
          void decodeCanvas().finally(() => {
            if (cancelled || closedRef.current || handledRef.current) return;
            // ~5 fps — enough for QR, lighter on battery
            timerRef.current = window.setTimeout(() => {
              rafRef.current = requestAnimationFrame(tick);
            }, 200);
          });
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch (err) {
        if (!cancelled) {
          setError(permissionMessage(err));
          setStatus("이미지로 불러오기 또는 권한 허용 후 재시도");
        }
      }
    };

    void start();

    return () => {
      cancelled = true;
      closedRef.current = true;
      stopCamera();
    };
  }, [open, decodeCanvas, stopCamera]);

  const handleClose = () => {
    closedRef.current = true;
    stopCamera();
    onClose();
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setFileBusy(true);
    setError(null);
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      const maxSide = 1280;
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("캔버스를 사용할 수 없습니다.");
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();

      const detector = getBarcodeDetector();
      if (detector) {
        try {
          const codes = await detector.detect(canvas);
          const raw = codes[0]?.rawValue;
          if (raw) {
            handleRaw(raw);
            return;
          }
        } catch {
          /* jsqr */
        }
      }

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const { default: jsQR } = await import("jsqr");
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "attemptBoth",
      });
      if (code?.data) {
        handleRaw(code.data);
        return;
      }
      setError("이미지에서 QR 코드를 찾지 못했습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "이미지를 읽지 못했습니다.");
    } finally {
      setFileBusy(false);
    }
  };

  if (!open) return null;

  const portalTarget =
    (typeof document !== "undefined" && document.querySelector(".app-frame")) ||
    (typeof document !== "undefined" ? document.body : null);
  if (!portalTarget) return null;

  return createPortal(
    <div className="ldg-modal-backdrop" role="dialog" aria-modal="true" aria-label="xpub QR 스캔" onClick={handleClose}>
      <div
        className="ldg-modal-content ldg-qr-scanner"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 420, width: "100%" }}
      >
        <div className="ldg-modal-title">xpub QR 스캔</div>
        <div className="ldg-setting-desc" style={{ marginBottom: 8 }}>
          지갑 앱의 와치온리 xpub/ypub/zpub QR을 비추세요. 개인키·시드 QR은 사용하지 마세요.
        </div>

        <div className="ldg-qr-video-wrap">
          <video ref={videoRef} className="ldg-qr-video" playsInline muted autoPlay />
          <div className="ldg-qr-frame" aria-hidden />
          <canvas ref={canvasRef} className="ldg-qr-canvas" />
        </div>

        <div className="ldg-balance-sub" style={{ textAlign: "center" }}>
          {status}
        </div>
        {error && <div className="ldg-modal-error">{error}</div>}

        <label className="ldg-secondary-btn" style={{ display: "block", textAlign: "center", cursor: "pointer" }}>
          {fileBusy ? "이미지 분석 중…" : "갤러리 / 사진에서 QR 선택"}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: "none" }}
            disabled={fileBusy}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              e.target.value = "";
              void handleFile(f);
            }}
          />
        </label>

        <div className="ldg-modal-actions">
          <button type="button" className="ldg-submit-btn secondary" onClick={handleClose} style={{ gridColumn: "1 / -1" }}>
            닫기
          </button>
        </div>
      </div>
    </div>,
    portalTarget
  );
}
