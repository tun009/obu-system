# Hướng dẫn Deploy OBU System — Chi tiết từng bước

> ⚠️ **Database local hoàn toàn an toàn** — các lệnh bên dưới chỉ ĐỌC từ DB local, không ghi hay xóa gì.

---

## GIAI ĐOẠN 1 — Chuẩn bị trên máy Windows

### 1.1 Push code lên Git

```powershell
cd d:\Elcom\OBU\OBU_ELcom_Building\obu-system
git add .
git commit -m "feat: docker compose setup"
git push
```

> Nếu chưa có remote: tạo repo trên GitHub → `git remote add origin URL && git push -u origin main`

### 1.2 Dump database local (chỉ ĐỌC, không ảnh hưởng data gốc)

```powershell
# Dump ra file SQL
docker exec obu-postgres pg_dump -U admin obu_database > obu_backup.sql

# Kiểm tra file (phải > 0 bytes)
Get-Item obu_backup.sql
```

✅ `obu_backup.sql` là bản sao — **data gốc trong container local không bị thay đổi gì**.

### 1.3 Copy file backup lên server

```powershell
scp obu_backup.sql root@YOUR_SERVER_IP:/opt/obu_backup.sql
```

---

## GIAI ĐOẠN 2 — Deploy trên Server

```bash
# Clone project
git clone YOUR_REPO_URL /opt/obu-system
cd /opt/obu-system

# Tạo .env
cp .env.example .env
nano .env
```

Điền vào .env:
```
SERVER_IP=203.x.x.x
DB_USER=admin
DB_PASSWORD=MatKhauManh@2024
DB_NAME=obu_database
MQTT_HOST=tcp://0.tcp.ap.ngrok.io
MQTT_PORT=16386
MQTT_USERNAME=
MQTT_PASSWORD=
MQTT_CLIENT_ID=obu_backend_listener
```
Lưu: `Ctrl+O → Enter → Ctrl+X`

```bash
# Build và chạy (lần đầu ~5 phút)
docker compose up -d --build

# Kiểm tra tất cả services
docker compose ps
```

Mong đợi tất cả STATUS = `running`:
```
obu-postgres   running (healthy)
obu-redis      running
obu-api        running
obu-ingestion  running
obu-frontend   running
```

```bash
# Kiểm tra app truy cập được (thấy HTML là ok)
curl -s http://localhost:3001 | head -5
```

---

## GIAI ĐOẠN 3 — Migrate Data

```bash
# Restore database (chỉ INSERT, không xóa gì trên local)
docker exec -i obu-postgres psql -U admin -d obu_database < /opt/obu_backup.sql

# Kiểm tra data đã restore
docker exec -it obu-postgres psql -U admin -d obu_database \
  -c "SELECT COUNT(*) FROM vehicles;" \
  -c "SELECT COUNT(*) FROM journey_logs;"

# Restart API để reload cache
docker compose restart api ingestion
```

Mở browser: **`http://SERVER_IP:3001`** → thấy đầy đủ xe và lịch sử hành trình 🎉

---

## Nếu có lỗi

```bash
docker compose logs api --tail=50
docker compose logs ingestion --tail=50
docker compose logs postgres --tail=20
```
