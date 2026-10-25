// Disk kalıcılığı: her oda için bir JSON dosyası + tek arşiv dosyası.
// Yazma atomiktir (.tmp dosyasına yaz, sonra yeniden adlandır) ve 300 ms toplanır.
import fs from 'node:fs';
import path from 'node:path';
import type { ArchivedGame } from '../shared/protocol.ts';
import type { RoomData } from './rooms.ts';

const DEBOUNCE_MS = 300;
const ROOM_TTL_DAYS = 90;

export class JsonStore {
  private roomsDir: string;
  private archivePath: string;
  private trashPath: string;
  private timers = new Map<string, NodeJS.Timeout>();
  private pending = new Map<string, () => unknown>();

  constructor(dataDir: string) {
    this.roomsDir = path.join(dataDir, 'rooms');
    this.archivePath = path.join(dataDir, 'archive.json');
    this.trashPath = path.join(dataDir, 'archive-deleted.json'); // arşivden silinenler (geri alınabilir)
    fs.mkdirSync(this.roomsDir, { recursive: true });
  }

  loadRooms(now = Date.now()): RoomData[] {
    const rooms: RoomData[] = [];
    for (const file of fs.readdirSync(this.roomsDir)) {
      if (!file.endsWith('.json')) continue;
      const full = path.join(this.roomsDir, file);
      try {
        const data = JSON.parse(fs.readFileSync(full, 'utf8')) as RoomData;
        if (now - Date.parse(data.updatedAt) > ROOM_TTL_DAYS * 86400_000) {
          fs.unlinkSync(full);
          continue;
        }
        rooms.push(data);
      } catch (err) {
        console.error(`Oda dosyası okunamadı: ${file}`, err);
      }
    }
    return rooms;
  }

  loadArchive(): ArchivedGame[] {
    if (!fs.existsSync(this.archivePath)) return [];
    return JSON.parse(fs.readFileSync(this.archivePath, 'utf8')) as ArchivedGame[];
  }

  saveRoom(room: RoomData) {
    this.schedule(`room:${room.code}`, () => this.writeAtomic(path.join(this.roomsDir, `${room.code}.json`), room));
  }

  saveArchive(games: ArchivedGame[]) {
    this.schedule('archive', () => this.writeAtomic(this.archivePath, games));
  }

  loadTrash(): (ArchivedGame & { deletedAt: string })[] {
    if (!fs.existsSync(this.trashPath)) return [];
    return JSON.parse(fs.readFileSync(this.trashPath, 'utf8'));
  }

  saveTrash(games: (ArchivedGame & { deletedAt: string })[]) {
    this.schedule('trash', () => this.writeAtomic(this.trashPath, games));
  }

  // Kapanışta bekleyen tüm yazmaları hemen yapar
  flush() {
    for (const [key, timer] of this.timers) {
      clearTimeout(timer);
      this.pending.get(key)?.();
    }
    this.timers.clear();
    this.pending.clear();
  }

  private schedule(key: string, write: () => unknown) {
    clearTimeout(this.timers.get(key));
    this.pending.set(key, write);
    this.timers.set(key, setTimeout(() => {
      this.timers.delete(key);
      this.pending.delete(key);
      write();
    }, DEBOUNCE_MS));
  }

  private writeAtomic(file: string, value: unknown) {
    const tmp = `${file}.tmp`;
    try {
      fs.writeFileSync(tmp, JSON.stringify(value));
      fs.renameSync(tmp, file);
    } catch (err) {
      console.error(`Yazılamadı: ${file}`, err);
    }
  }
}
