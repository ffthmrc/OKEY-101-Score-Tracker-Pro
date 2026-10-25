# OKEY 101 — Sunucu kurulumu (Oracle Cloud Ubuntu)

Tek bir Node süreci hem derlenmiş arayüzü (`dist/`) sunar hem de `/ws` üzerinden canlı senkronu yönetir.
Önünde Caddy durur: HTTPS sertifikasını otomatik alır ve `wss://` bağlantısını Node'a aktarır.

```
Telefon ──https/wss──▶ Caddy :443 ──▶ Node 127.0.0.1:8080 ──▶ data/rooms/*.json, data/archive.json
```

Odalar `data/rooms/<KOD>.json`, kapatılan oyunlar `data/archive.json` dosyasında durur.
Sunucu yeniden başlasa da bu dosyalardan geri yüklenir.

---

## 0. Ön kontrol (sunucu başka işler de çalıştırıyorsa)

```bash
uptime            # load average, çekirdek sayısının altında olmalı
free -h           # en az ~150 MB boş bellek
sudo ss -ltnp | grep -E ':(80|443|8080)\b'   # bu portlar boş olmalı
```

## 1. Node.js kurulumu (24 LTS)

Sunucu kodu Node'un yerleşik TypeScript desteğiyle çalışır, bu yüzden **Node 22.18 veya üstü** gerekir.

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs git
node -v   # v24.x
```

## 2. Uygulamayı kur ve derle

```bash
cd ~
git clone https://github.com/ffthmrc/OKEY-101-Score-Tracker-Pro.git okey101
cd okey101
npm ci
npm test          # oda mantığı testleri
npm run build     # dist/ oluşur
```

Elle deneme (Ctrl+C ile durdur):

```bash
PORT=8080 node server/index.ts
curl -s localhost:8080/healthz    # {"ok":true,...}
```

## 3. systemd ile otomatik başlatma

Gizli değerler için ortam dosyası:

```bash
sudo tee /etc/okey101.env >/dev/null <<'EOF'
PORT=8080
HOST=127.0.0.1
DATA_DIR=/home/ubuntu/okey101/data
# Arşivde düzenleme/silme PIN'i (sadece burada durur, repoya yazma)
ARCHIVE_PIN=
# İsteğe bağlı: Gemini analizi için
GEMINI_API_KEY=
EOF
sudo chmod 600 /etc/okey101.env
```

Servis dosyası:

```bash
sudo tee /etc/systemd/system/okey101.service >/dev/null <<'EOF'
[Unit]
Description=OKEY 101 oda sunucusu
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/okey101
EnvironmentFile=/etc/okey101.env
ExecStart=/usr/bin/node server/index.ts
Restart=always
RestartSec=3
MemoryMax=200M

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now okey101
sudo systemctl status okey101 --no-pager
journalctl -u okey101 -n 50 --no-pager
```

> pm2 tercih edilirse: `sudo npm i -g pm2 && pm2 start server/index.ts --name okey101 --interpreter node && pm2 save && pm2 startup`.
> Tek servis için systemd yeterli ve ek paket istemez.

## 4. Ücretsiz alan adı (DuckDNS)

1. https://www.duckdns.org adresine GitHub/Google ile gir.
2. Bir alt alan adı al (ör. `okey101`) ve IP olarak sunucunun **public IP**'sini yaz.
3. Sayfadaki **token**'ı kopyala. IP sabit olsa da güncelleme cron'u kurmak zararsızdır:

```bash
mkdir -p ~/duckdns
echo 'echo url="https://www.duckdns.org/update?domains=okey101&token=TOKEN_BURAYA&ip=" | curl -k -o ~/duckdns/duck.log -K -' > ~/duckdns/duck.sh
chmod 700 ~/duckdns/duck.sh
(crontab -l 2>/dev/null; echo "*/30 * * * * ~/duckdns/duck.sh >/dev/null 2>&1") | crontab -
```

Kontrol: `dig +short okey101.duckdns.org` komutu sunucunun IP'sini döndürmeli.

## 5. Oracle'da 80/443 portlarını açma

İki katman var ve **ikisi de** açılmalı.

### 5a. VCN Security List (Oracle konsolu)

Networking → Virtual Cloud Networks → (VCN) → Subnet → Security List → **Add Ingress Rules**:

| Source CIDR | IP Protocol | Destination Port |
|---|---|---|
| 0.0.0.0/0 | TCP | 80 |
| 0.0.0.0/0 | TCP | 443 |

### 5b. Sunucunun iptables kuralları

Oracle'ın Ubuntu imajında INPUT zincirinin sonunda bir `REJECT` kuralı vardır. Yeni kurallar onun **önüne** eklenmelidir:

```bash
sudo iptables -L INPUT --line-numbers -n     # REJECT satırının numarasını bul (genelde 5 veya 6)
N=$(sudo iptables -L INPUT --line-numbers -n | awk '/REJECT/ {print $1; exit}')
sudo iptables -I INPUT $N -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo iptables -I INPUT $N -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo netfilter-persistent save
```

Port 8080 **dışarıya açılmaz**; Node sadece 127.0.0.1'i dinler.

## 6. Caddy ile HTTPS ve wss://

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

`/etc/caddy/Caddyfile`:

```
okey101.duckdns.org {
    encode gzip
    reverse_proxy 127.0.0.1:8080
}
```

```bash
sudo systemctl reload caddy
journalctl -u caddy -n 30 --no-pager      # "certificate obtained successfully" görülmeli
curl -s https://okey101.duckdns.org/healthz
```

`reverse_proxy`, WebSocket upgrade isteklerini ek ayar olmadan aktarır, yani `wss://okey101.duckdns.org/ws` kendiliğinden çalışır.

## 7. GitHub Pages yönlendirmesi

Eski `ffthmrc.github.io/OKEY-101-Score-Tracker-Pro/` linki yeni adrese yönlenir:

`main`'e push edildiğinde workflow `pages-redirect/index.html` sayfasını yayınlar (`?oda=` parametresi korunur).
Hedef adres workflow'da varsayılan olarak `https://okey-101.duckdns.org`; değişirse repo değişkeni `APP_URL` ile ezilir.

> Sırayla yap: önce sunucu HTTPS ile çalışsın, **sonra** bu değişikliği `main`'e push et.

## 8. Güncelleme

```bash
cd ~/okey101
git pull
npm ci
npm run build
sudo systemctl restart okey101
```

Yeni sürümde `public/service-worker.js` içindeki `CACHE_NAME` değerini artır (ör. `okey-101-v3`). Eski önbellek otomatik silinir.

## 9. Yedek

Tüm veri `~/okey101/data/` klasöründedir:

```bash
(crontab -l; echo "15 4 * * * tar czf ~/okey101-yedek-\$(date +\%u).tgz -C ~/okey101 data") | crontab -
```

Bu komut haftanın her günü için bir dosya tutar (7 dosya döner).

---

## Yerelde iki sekmeyle test

```bash
npm install
npm run dev:server     # 1. terminal: oda sunucusu :8080 (değişiklikte kendini yeniden başlatır)
npm run dev            # 2. terminal: arayüz :3000 (/ws ve /api istekleri :8080'e yönlenir)
```

1. `http://localhost:3000` adresini aç. Adres `/?oda=XXXXX` olur. **Katıl** → "Ali".
2. Aynı linki **gizli pencerede** aç (ayrı cihaz kimliği için şart). Hücreler salt okunurdur. **Katıl** → "Veli".
3. Birinde skor yaz; diğerinde anında görünür, sıralama, grafik ve rozetler de güncellenir.
4. Ali'nin sekmesini yenile: yine 1. sandalyede olmalı (kartta mavi çerçeve, üstte **Ayrıl** butonu).
5. Sunucuyu durdur: iki sekmede de 🔴 "Bağlantı koptu" yazar. Tekrar başlatınca 🟢 olur ve veri yerindedir.
6. **Oyunu kapat** → onay → masa boşalır, **archive** sekmesinde tarihli kayıt görünür. Kayda tıkla → **Düzenle** → onay → değiştir → **Kaydet** → onay.
7. `npm test` oda mantığını (sandalye, yetki, geri al, arşiv) test eder.
