# Excel (her sayfa bir oyun, sayfa adı tarih) -> data/archive.json
# Kullanım: python tools/excel_to_archive.py okey.xlsx data/archive.json  (openpyxl gerekir; sunucu durdurulmuşken kopyala)
import sys, re, json, datetime, openpyxl
sys.stdout.reconfigure(encoding='utf-8')
MONTHS = {'ocak':1,'şubat':2,'subat':2,'mart':3,'nisan':4,'mayıs':5,'mayis':5,'may':5,'haziran':6,'june':6,'temmuz':7,
          'ağustos':8,'agustos':8,'eylül':9,'eylul':9,'ekim':10,'kasım':11,'kasim':11,'aralık':12,'aralik':12}
NAME_FIX = {'Yucer': 'Yücer', 'M.Ketenci': 'Ketenci', 'Mehmet Y': 'Mehmet', 'Sbn': 'Şaban', 'Saban': 'Şaban', 'Omer Faruk': 'Ömer'}
COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#84cc16']
# Kalıcı kişi renkleri: aynı kişi her oyunda aynı renkte
PERSON_ORDER = ['Ketenci', 'Zeki', 'Fatih', 'Hasan', 'İsmail', 'Yücer', 'Ömer', 'Murat', 'Ahmet', 'Mehmet', 'Şaban', 'Mecit', 'Ali']

def parse_date(title):
    d, mon, y = re.search(r'(\d{1,2})\s+(\S+)\s+(\d{4})', title).groups()
    k = mon.replace('I', 'ı').replace('İ', 'i').lower()
    mo = MONTHS.get(k) or MONTHS.get(k.replace('ı', 'i'))
    return datetime.date(int(y), mo, int(d))

def num(v):
    return v if isinstance(v, (int, float)) and not isinstance(v, bool) else None

def clean_name(v):
    n = v.strip()
    return NAME_FIX.get(n, n)

def parse_sheet(ws):
    rows = [list(r) for r in ws.iter_rows(values_only=True)]
    hi = next((i for i, r in enumerate(rows) if isinstance(r[0], str) and r[0].strip().lower() in ('rnd', 'round')), None)
    if hi is not None:  # "Round | isimler..." formatı
        names = []
        for v in rows[hi][1:]:
            if not isinstance(v, str) or not v.strip() or v.strip().lower() == 'kisi': break
            names.append(v)
        rounds = []
        for r in rows[hi + 1:]:
            if num(r[0]) is None: break
            rounds.append([num(x) for x in r[1:1 + len(names)]])
    else:  # 2024 eski format: ilk satır isimler, son satır toplam
        names = [v for v in rows[0] if isinstance(v, str) and v.strip()]
        body = [[num(x) for x in r[:len(names)]] for r in rows[1:] if any(num(x) is not None for x in r[:len(names)])]
        rounds = body[:-1]  # son satır toplam
        sums = [sum(r[i] or 0 for r in rounds) for i in range(len(names))]
        assert [round(x) for x in body[-1]] == sums, (ws.title, body[-1], sums)
    while rounds and all(v is None for v in rounds[-1]): rounds.pop()
    names = [clean_name(n) for n in names]
    keep = [i for i in range(len(names)) if any(r[i] is not None for r in rounds)]  # hiç oynamayan sütun atılır
    return [names[i] for i in keep], [[r[i] for i in keep] for r in rounds]

wb = openpyxl.load_workbook(sys.argv[1], data_only=True)
games, per_day = [], {}
for ws in wb.worksheets:
    names, rounds = parse_sheet(ws)
    date = parse_date(ws.title)
    n = per_day[date] = per_day.get(date, 0) + 1
    closed = datetime.datetime(date.year, date.month, date.day, 12, n - 1, tzinfo=datetime.timezone.utc)  # öğlen UTC: her saat diliminde aynı gün
    iso = closed.astimezone(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')
    players = []
    for i, name in enumerate(names):
        ci = PERSON_ORDER.index(name) if name in PERSON_ORDER else len(PERSON_ORDER) + i
        players.append({'id': f'p{i + 1}', 'name': name[:8], 'color': COLORS[ci % len(COLORS)]})
    games.append({
        'id': f'EXCEL-{date:%Y%m%d}-{n}',
        'roomCode': 'EXCEL',
        'startedAt': iso, 'closedAt': iso, 'updatedAt': iso,
        'players': players,
        'rounds': [{'round': k + 1, 'scores': {p['id']: (int(v) if v is not None else None) for p, v in zip(players, r)}}
                   for k, r in enumerate(rounds)],
        '_sheet': ws.title,
    })
for g in games:
    assert all(v is None or float(v).is_integer() for r in g['rounds'] for v in r['scores'].values())
out = sorted(games, key=lambda g: g['closedAt'])
json.dump([{k: v for k, v in g.items() if k != '_sheet'} for g in out], open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False)
print(len(out), 'oyun ->', sys.argv[2])
from collections import Counter
print(Counter(p['name'] for g in out for p in g['players']).most_common())
wins = Counter(min(g['players'], key=lambda p: sum((r['scores'][p['id']] or 0) for r in g['rounds']))['name'] for g in out)
print('kazanma:', wins.most_common())
for g in out:
    if g['_sheet'] in ('26 Şubat 2024', '14 Nisan 2024', 'Copy of 6 Nisan 2025', 'Copy of 29 Temmuz 2025', '8 Ekim 2025'):
        print(g['id'], g['_sheet'], [(p['name'], sum((r['scores'][p['id']] or 0) for r in g['rounds'])) for p in g['players']])
