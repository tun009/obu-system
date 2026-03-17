-- ============================================================
-- TimescaleDB Migration Script
-- Chuyển bảng journey_logs từ PostgreSQL thường → TimescaleDB Hypertable
-- ============================================================
-- LƯU Ý: Chạy script này SAU KHI đã:
--   1. Backup database (pg_dump)
--   2. Đổi Docker image sang timescale/timescaledb-ha:pg15-latest
--   3. Restart container postgres
-- ============================================================

-- Bước 1: Bật extensions
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
CREATE EXTENSION IF NOT EXISTS postgis CASCADE;

-- Bước 2: Xóa PK cũ (chỉ có cột id — không tương thích hypertable)
ALTER TABLE journey_logs DROP CONSTRAINT journey_logs_pkey;

-- Bước 3: Xóa cột id (không ai query theo id, chỉ query theo vehicle_id + timestamp)
ALTER TABLE journey_logs DROP COLUMN id;

-- Bước 4: Convert thành hypertable, migrate data có sẵn in-place
-- chunk_time_interval = 1 ngày → mỗi ngày tự tạo 1 partition riêng
SELECT create_hypertable('journey_logs', 'timestamp',
  migrate_data => true,
  chunk_time_interval => INTERVAL '1 day'
);

-- Bước 5: Kiểm tra kết quả
SELECT * FROM timescaledb_information.hypertables;
SELECT COUNT(*) AS total_records FROM journey_logs;
