# Tích hợp TimescaleDB cho `journey_logs`

## Tóm tắt

Hiện tại `journey_logs` là bảng PostgreSQL thông thường — không partition. Với tốc độ ghi 2s/lần/xe, bảng sẽ phình to theo thời gian và query lịch sử ngày càng chậm.

**Mục tiêu:** Chuyển `journey_logs` thành **Hypertable** của TimescaleDB — tự động partition theo `timestamp` mà **không thay đổi gì trong code Node.js hay Prisma**.

> [!IMPORTANT]
> **Dữ liệu KHÔNG bị mất.** TimescaleDB dùng lệnh `create_hypertable(..., migrate_data => true)` để convert bảng existing sang hypertable in-place. Tuy nhiên **vẫn nên backup trước** để an toàn.

---

## Proposed Changes

### Infrastructure

#### [MODIFY] [docker-compose.yml](file:///d:/Elcom/OBU/OBU_ELcom_Building/obu-system/docker-compose.yml)

Đổi image từ `postgis/postgis:15-3.4` sang `timescale/timescaledb-ha:pg15-latest`.

Image `timescale/timescaledb-ha` đã tích hợp sẵn **cả PostGIS lẫn TimescaleDB** — không cần image riêng lẻ.

```diff
- image: postgis/postgis:15-3.4
+ image: timescale/timescaledb-ha:pg15-latest
```

> [!WARNING]
> Thay đổi image KHÔNG xóa data vì volume `pgdata` vẫn giữ nguyên. Nhưng cần chạy `pg_upgrade` nếu khác major version. Ở đây cùng là PostgreSQL 15 nên **an toàn hoàn toàn**.

---

### Migration Script (chạy 1 lần duy nhất trên server)

Sau khi container mới chạy, thực hiện 3 lệnh SQL:

```sql
-- 1. Bật extension TimescaleDB
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- 2. Bật extension PostGIS (đề phòng chưa có)
CREATE EXTENSION IF NOT EXISTS postgis CASCADE;

-- 3. Convert bảng journey_logs thành hypertable, migrate data in-place
SELECT create_hypertable('journey_logs', 'timestamp',
  migrate_data => true,
  chunk_time_interval => INTERVAL '1 day'
);
```

**Không cần thay đổi bất kỳ dòng code Prisma hay Node.js nào.** Query vào `journey_logs` vẫn như cũ.

---

## Verification Plan

### Bước 1 — Backup trước khi thực hiện (trên Ubuntu server)

```bash
docker exec obu-postgres pg_dump -U admin obu_database > /opt/obu_backup_pre_timescale.sql
```

### Bước 2 — Kiểm tra sau migrate

```bash
# Kiểm tra hypertable đã tồn tại
docker exec -it obu-postgres psql -U admin -d obu_database \
  -c "SELECT * FROM timescaledb_information.hypertables;"

# Kiểm tra số chunks (partition tự động)
docker exec -it obu-postgres psql -U admin -d obu_database \
  -c "SELECT * FROM timescaledb_information.chunks WHERE hypertable_name = 'journey_logs';"

# Kiểm tra record count còn nguyên
docker exec -it obu-postgres psql -U admin -d obu_database \
  -c "SELECT COUNT(*) FROM journey_logs;"
```

### Bước 3 — Test API vẫn hoạt động
```bash
curl http://localhost:3001/api/vehicles
# Phải trả về JSON danh sách xe, không lỗi
```
