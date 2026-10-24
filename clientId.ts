// Cihaz kimliği: sadece "bu cihaz hangi sandalyede" bilgisi için localStorage'da tutulur.
// Skorlar artık sunucuda; localStorage'a skor yazılmaz.
const CLIENT_ID_KEY = 'okey_client_id';
const LAST_ROOM_KEY = 'okey_last_room';
const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // karışan 0/O, 1/I yok

const safeGet = (key: string) => {
  try { return localStorage.getItem(key); } catch { return null; }
};
const safeSet = (key: string, value: string) => {
  try { localStorage.setItem(key, value); } catch { /* gizli sekme vb. */ }
};

// crypto.randomUUID sadece HTTPS/localhost'ta var; getRandomValues her yerde çalışır
export const randomId = (bytes = 16) =>
  Array.from(crypto.getRandomValues(new Uint8Array(bytes)), b => b.toString(16).padStart(2, '0')).join('');

let memoryClientId: string | null = null;

export function getClientId(): string {
  const saved = safeGet(CLIENT_ID_KEY) ?? memoryClientId;
  if (saved) return saved;
  const id = randomId();
  memoryClientId = id;
  safeSet(CLIENT_ID_KEY, id);
  return id;
}

const randomRoomCode = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(5)), b => ROOM_ALPHABET[b % ROOM_ALPHABET.length]).join('');

// URL'de ?oda= varsa onu, yoksa bu cihazın son odasını, o da yoksa yeni bir kod kullanır
// ve sonucu adres çubuğuna yazar (paylaşılan link her zaman odayı içerir).
export function resolveRoomCode(): string {
  const url = new URL(window.location.href);
  let code = (url.searchParams.get('oda') ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
  if (code.length < 3) code = safeGet(LAST_ROOM_KEY) ?? randomRoomCode();
  url.searchParams.set('oda', code);
  window.history.replaceState(null, '', url);
  safeSet(LAST_ROOM_KEY, code);
  return code;
}
