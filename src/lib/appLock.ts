export const APP_LOCK_STORAGE_KEY = "myledger.appLock.v1";
export const APP_LOCK_AUTO_LOCK_MS = 5 * 60 * 1000;
const APP_LOCK_ITERATIONS = 100_000;

export interface AppLockConfig {
  enabled: true;
  salt: string;
  hash: string;
  iterations: number;
  createdAt: string;
  updatedAt: string;
}

export function isAppLockSupported(): boolean {
  return typeof crypto !== "undefined" && !!crypto.subtle && !!crypto.getRandomValues;
}

export function isPinFormatValid(value: string): boolean {
  return /^\d{4,6}$/.test(value);
}

export function getAppLockConfig(): AppLockConfig | null {
  try {
    const raw = localStorage.getItem(APP_LOCK_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AppLockConfig>;
    if (
      parsed.enabled === true &&
      typeof parsed.salt === "string" &&
      typeof parsed.hash === "string" &&
      typeof parsed.iterations === "number" &&
      Number.isFinite(parsed.iterations) &&
      typeof parsed.createdAt === "string" &&
      typeof parsed.updatedAt === "string"
    ) {
      return parsed as AppLockConfig;
    }
  } catch {
    return null;
  }
  return null;
}

export function isAppLockEnabled(): boolean {
  return getAppLockConfig()?.enabled === true;
}

export async function setupAppLock(pin: string): Promise<void> {
  assertCanUseAppLock(pin);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const now = new Date().toISOString();
  const config: AppLockConfig = {
    enabled: true,
    salt: bytesToBase64(salt),
    hash: await hashPin(pin, toArrayBuffer(salt), APP_LOCK_ITERATIONS),
    iterations: APP_LOCK_ITERATIONS,
    createdAt: now,
    updatedAt: now,
  };
  localStorage.setItem(APP_LOCK_STORAGE_KEY, JSON.stringify(config));
}

export async function verifyAppLockPin(pin: string): Promise<boolean> {
  if (!isPinFormatValid(pin) || !isAppLockSupported()) return false;
  const config = getAppLockConfig();
  if (!config) return false;

  try {
    const salt = base64ToBytes(config.salt);
    const candidateHash = await hashPin(pin, toArrayBuffer(salt), config.iterations);
    return timingSafeEqual(candidateHash, config.hash);
  } catch {
    return false;
  }
}

export async function changeAppLockPin(currentPin: string, nextPin: string): Promise<void> {
  const verified = await verifyAppLockPin(currentPin);
  if (!verified) throw new Error("현재 PIN이 올바르지 않습니다.");
  await setupAppLock(nextPin);
}

export async function disableAppLock(currentPin: string): Promise<void> {
  const verified = await verifyAppLockPin(currentPin);
  if (!verified) throw new Error("현재 PIN이 올바르지 않습니다.");
  localStorage.removeItem(APP_LOCK_STORAGE_KEY);
}

function assertCanUseAppLock(pin: string) {
  if (!isAppLockSupported()) throw new Error("이 브라우저는 Web Crypto 기반 앱 잠금을 지원하지 않습니다.");
  if (!isPinFormatValid(pin)) throw new Error("PIN은 숫자 4~6자리로 입력하세요.");
}

async function hashPin(pin: string, salt: ArrayBuffer, iterations: number): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return bytesToBase64(new Uint8Array(bits));
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
