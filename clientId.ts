// Cihaz kimliği: sadece "bu cihaz hangi sandalyede" bilgisi için localStorage'da tutulur.
// Skorlar artık sunucuda; localStorage'a skor yazılmaz.
const CLIENT_ID_KEY = 'okey_client_id';
// Linksiz açılış (ör. iPhone ana ekran simgesi) her zaman ortak masayı açar
export const DEFAULT_ROOM = 'MASA';

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

// URL'de ?oda= varsa onu, yoksa ortak masayı kullanır ve sonucu adres çubuğuna yazar.
// (Son oda hatırlanmaz: iPhone ana ekran uygulaması Safari'nin hafızasını görmez, rastgele odaya düşmesin.)
export function resolveRoomCode(): string {
  const url = new URL(window.location.href);
  let code = (url.searchParams.get('oda') ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
  if (code.length < 3) code = DEFAULT_ROOM;
  url.searchParams.set('oda', code);
  window.history.replaceState(null, '', url);
  return code;
}
