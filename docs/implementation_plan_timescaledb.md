# Chuyển đổi sang TimescaleDB — Phân tích rủi ro & Kế hoạch triển khai

## Tóm tắt

Chuyển bảng `journey_logs` từ PostgreSQL thường sang **TimescaleDB Hypertable** để tự động partition theo ngày, tăng tốc query lịch sử hành trình.

---

## ⚠️ Phát hiện quan trọng từ nghiên cứu

### Vấn đề 1: PRIMARY KEY phải bao gồm cột partition

> [!CAUTION]
> TimescaleDB **bắt buộc** PRIMARY KEY phải chứa cột partition (`timestamp`). Hiện tại `journey_logs` có PK là [id](file:///d:/Elcom/OBU/OBU_ELcom_Building/obu-system/apps/web-frontend/src/context/VehicleContext.jsx#11-92) (BigInt autoincrement) — **không tương thích** với hypertable!

**Hiện tại trong Prisma schema:**
```prisma
model JourneyLog {
  id        BigInt   @id @default(autoincrement())  // ← PK chỉ có id
  timestamp DateTime @default(now())                 // ← Cột partition, không nằm trong PK
}
```

**Cần đổi thành** composite PK [(id, timestamp)](file:///d:/Elcom/OBU/OBU_ELcom_Building/obu-system/apps/web-frontend/src/components/ui/CarIcon.jsx#13-80) — hoặc xóa bỏ cột [id](file:///d:/Elcom/OBU/OBU_ELcom_Building/obu-system/apps/web-frontend/src/context/VehicleContext.jsx#11-92) hoàn toàn (vì code **không ai query theo [id](file:///d:/Elcom/OBU/OBU_ELcom_Building/obu-system/apps/web-frontend/src/context/VehicleContext.jsx#11-92)**).

### Vấn đề 2: Foreign Key từ hypertable → bảng thường

> [!NOTE]
> FK từ hypertable (`journey_logs.vehicle_id`) → bảng thường (`vehicles.id`) **ĐƯỢC HỖ TRỢ** bởi TimescaleDB. Chiều ngược lại mới không được.
> → **Không ảnh hưởng** hệ thống hiện tại. ✅

### Vấn đề 3: Docker image tương thích

> [!NOTE]
> Image `timescale/timescaledb-ha:pg15` đã **tích hợp sẵn PostGIS** — không cần image riêng. Cùng PostgreSQL 15 nên volume `pgdata` tương thích.

---

## Đánh giá rủi ro mất dữ liệu

| Bước | Rủi ro | Giải pháp |
|---|---|---|
| Đổi Docker image | Volume `pgdata` giữ nguyên → **không mất data** | Backup trước bằng `pg_dump` |
| ALTER PRIMARY KEY | Cần `DROP CONSTRAINT` + tạo lại → **lock bảng tạm thời** | Thực hiện lúc ít traffic |
| `create_hypertable(migrate_data => true)` | Data được migrate in-place → **không mất** | Đã backup ở bước trên |
| Prisma schema thay đổi | Chỉ thay đổi khai báo, không affect data | — |

> **Kết luận: KHÔNG mất dữ liệu** nếu thực hiện đúng trình tự và backup trước.

---

## Proposed Changes

### Infrastructure

#### [MODIFY] [docker-compose.yml](file:///d:/Elcom/OBU/OBU_ELcom_Building/obu-system/docker-compose.yml)

Đổi image PostgreSQL:

```diff
-    image: postgis/postgis:15-3.4
+    image: timescale/timescaledb-ha:pg15-latest
```

---

### Database Schema

#### [MODIFY] [schema.prisma](file:///d:/Elcom/OBU/OBU_ELcom_Building/obu-system/packages/database/prisma/schema.prisma)

Xóa cột [id](file:///d:/Elcom/OBU/OBU_ELcom_Building/obu-system/apps/web-frontend/src/context/VehicleContext.jsx#11-92) khỏi `JourneyLog` (vì không ai dùng nó) và đổi sang composite index. Prisma không hỗ trợ composite PK với `@@id`, nên sẽ giữ schema không dùng `@id` mà quản lý PK bằng migration SQL thủ công.

> [!IMPORTANT]
> Thay đổi schema Prisma **không ảnh hưởng** code Node.js/API vì không có chỗ nào query `journey_logs` theo [id](file:///d:/Elcom/OBU/OBU_ELcom_Building/obu-system/apps/web-frontend/src/context/VehicleContext.jsx#11-92). Tất cả query đều dùng `vehicle_id + timestamp`.

---

### Migration SQL (chạy 1 lần trên server sau khi đổi image)

```sql
-- Bước 0: Backup đã thực hiện trước đó

-- Bước 1: Bật extensions
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
CREATE EXTENSION IF NOT EXISTS postgis CASCADE;

-- Bước 2: Xóa PK cũ (chỉ có cột id)
ALTER TABLE journey_logs DROP CONSTRAINT journey_logs_pkey;

-- Bước 3: Xóa cột id (không ai dùng)
ALTER TABLE journey_logs DROP COLUMN id;

-- Bước 4: Convert thành hypertable, migrate data in-place
SELECT create_hypertable('journey_logs', 'timestamp',
  migrate_data => true,
  chunk_time_interval => INTERVAL '1 day'
);
```

---

### Code Changes: Không cần thay đổi!

Sau khi xem kỹ toàn bộ code:

| File | Cần sửa? | Lý do |
|---|---|---|
| `mqtt-ingestion/index.js` | ❌ | INSERT không chỉ định cột [id](file:///d:/Elcom/OBU/OBU_ELcom_Building/obu-system/apps/web-frontend/src/context/VehicleContext.jsx#11-92) (autoincrement tự sinh) |
| `api-backend/routes/vehicles.js` | ❌ | Query history dùng `vehicle_id + timestamp`, không dùng [id](file:///d:/Elcom/OBU/OBU_ELcom_Building/obu-system/apps/web-frontend/src/context/VehicleContext.jsx#11-92) |
| `api-backend/cron/pingStatus.js` | ❌ | Không query `journey_logs` |
| Frontend | ❌ | Không liên quan DB |

---

## Verification Plan

### Trên server Ubuntu (sau khi migration)

```bash
# 1. Kiểm tra TimescaleDB đã hoạt động
docker exec -it obu-postgres psql -U admin -d obu_database \
  -c "SELECT * FROM timescaledb_information.hypertables;"
# Mong đợi: 1 dòng hiển thị journey_logs là hypertable

# 2. Kiểm tra chunks (partitions tự động)
docker exec -it obu-postgres psql -U admin -d obu_database \
  -c "SELECT * FROM timescaledb_information.chunks WHERE hypertable_name = 'journey_logs';"

# 3. Kiểm tra data còn nguyên
docker exec -it obu-postgres psql -U admin -d obu_database \
  -c "SELECT COUNT(*) FROM journey_logs;"
# Mong đợi: Cùng số lượng record như trước migration

# 4. Kiểm tra API hoạt động bình thường
curl -s http://localhost:3001/api/vehicles | head -c 200
# Mong đợi: JSON danh sách xe

# 5. Kiểm tra API lịch sử hành trình vẫn trả kết quả
curl -s "http://localhost:3001/api/vehicles/{IMEI}/history?start=2026-03-01&end=2026-03-16"
# Mong đợi: JSON với data lịch sử
```

### Manual Verification (anh kiểm tra)
- Mở trình duyệt → `http://103.56.160.96:3001`
- Vào **Giám sát xe** → kiểm tra xe hiển thị bình thường trên map
- Vào **Nhật trình** → chọn xe + ngày → kiểm tra đường đi Polyline hiện đúng
