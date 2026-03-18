# Báo Cáo Phân Tích Hạn chế – OBU Fleet Tracker

> Phân tích toàn bộ source code (`mqtt-ingestion`, `api-backend`, `web-frontend`, `packages/database`) và tài liệu `docs/`.

---

## 🔴 1. Vấn đề Bảo mật (Nghiêm trọng)

### 1.1 Credentials hardcode trong `.env` bị commit lên repo

```
DATABASE_URL="postgresql://admin:password123@localhost:5432/obu_database"
REDIS_URL="redis://localhost:6379"
MQTT_HOST=tcp://0.tcp.ap.ngrok.io
```

- Hai file `.env` của `api-backend` và `mqtt-ingestion` đang **không có trong `.gitignore`** hoặc file `.gitignore` ở root không cover đủ path con.
- Mật khẩu DB (`password123`) rất yếu và đang lộ trong repo.
- MQTT được kết nối qua **ngrok không có username/password** (`MQTT_USERNAME=`, `MQTT_PASSWORD=` để trống).
- **Rủi ro:** Ai có repo đều truy cập được DB và MQTT broker.

### 1.2 API Backend hoàn toàn không có Authentication

Toàn bộ REST API (`GET`, `POST`, `PUT`, `DELETE /api/vehicles/*`) hiện tại **không có bất kỳ tầng xác thực nào**. 

- Bất kỳ ai biết URL `http://server:5000/api/vehicles` đều có thể:
  - Xem danh sách xe và tọa độ GPS
  - Thêm/Xóa xe
  - Xóa toàn bộ journey_logs (Cascade)

### 1.3 Socket.IO không có Authentication

```js
// socketHub.js
const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});
```

`origin: "*"` cho phép bất kỳ domain nào connect và nhận realtime stream tọa độ xe.

### 1.4 SQL Injection tiềm ẩn trong Ingestion

```js
// mqtt-ingestion/src/index.js – line 95-106
await prisma.$executeRawUnsafe(`
    UPDATE vehicles 
    SET "current_location" = ${locationSql},
        "current_status" = '${status}'::...
        "engine_rpm" = ${rpm},
        ...
    WHERE "id" = ${vehicleId};
`);
```

Các biến `rpm`, `speed`, `fuel`, `status` được chèn trực tiếp vào SQL string mà không dùng parameterized query. Nếu parser không lọc tốt, payload độc có thể tấn công DB.

---

## 🟠 2. Vấn đề Backend / Logic

### 2.1 Batch INSERT không có bảo vệ khi lỗi – mất dữ liệu vĩnh viễn

```js
// Khi flush buffer thất bại:
} catch (error) {
    console.error('[Batch Insert Error] Failed to insert logs:', error);
    // Fallback: put them back to buffer or save to dead letter queue, but for now we log it.
}
```

Khi batch INSERT thất bại (timeout DB, lỗi PostGIS...), toàn bộ batch **bị vứt đi hoàn toàn**. Comment trong code tự ghi nhận vấn đề này nhưng chưa có giải pháp. Với 2 giây/flush, một lần lỗi có thể mất hàng chục bản ghi GPS.

**Đề xuất:** Retry với exponential backoff, hoặc Dead Letter Queue (file/Redis list).

### 2.2 `vehicleCache` không có TTL – cache stale vĩnh viễn

```js
const vehicleCache = new Map();
// vehicleId được set nhưng KHÔNG BAO GIỜ bị xóa khỏi cache
vehicleCache.set(imei, vehicleId);
```

Nếu admin xóa một xe khỏi DB, service vẫn tiếp tục nhận data của IMEI đó vì cache còn vehicleId cũ → insert vào `journey_logs` với `vehicle_id` không tồn tại → lỗi FK constraint.  
Nếu admin thêm lại xe với ID mới, cache vẫn trỏ về ID cũ.

### 2.3 Cron `pingStatus.js` kết nối MQTT riêng – lãng phí tài nguyên

```js
// cron/pingStatus.js
const mqttClient = mqtt.connect(mqttUrl, mqttOptions);
```

`api-backend` mở thêm 1 kết nối MQTT chỉ để publish ping. Trong khi `mqtt-ingestion` đã có kết nối MQTT sẵn. Đây là thiết kế thừa. Đúng ra cron nên gửi lệnh ping qua Redis command sang `mqtt-ingestion` xử lý, hoặc expose một internal endpoint.

### 2.4 `AddVehicleModal`: có thể "Tạo mới" mà không qua bước Kiểm tra IMEI

```js
// AddVehicleModal.jsx – handleSubmit không kiểm tra checkStatus
const handleSubmit = async () => {
    if (isEditMode) { ... } else {
        const res = await axios.post(`${API_BASE_URL}/vehicles`, { imei, licensePlate: plate, type });
        ...
    }
    onClose();
}
```

UI có nút "Kiểm tra IMEI" nhưng không enforce bước này trước khi Submit. Người dùng có thể bấm "Tạo mới" ngay mà không verify IMEI → thêm xe rác vào DB.

### 2.5 Logic xác định trạng thái bị nhân đôi (Code Duplication)

Logic phân loại trạng thái RUNNING/STOPPED/PARKED xuất hiện ở **3 nơi** khác nhau:
- `mqtt-ingestion/src/parser.js` (dùng `car_response`)
- `web-frontend/src/utils/journeyFormatter.js` (dùng rpm/speed, ngưỡng 3 km/h)
- `web-frontend/src/utils/journeyAggregator.js` (dùng rpm/speed, ngưỡng 1 km/h ← khác!)

```js
// journeyAggregator.js – ngưỡng speed = 1 km/h
if (rpm === 0 && speed < 1) return 'PARKED';
if (rpm > 0 && speed < 1) return 'STOPPED';
// journeyFormatter.js – ngưỡng speed = 3 km/h
if (speed >= 3) { status = 'RUNNING'; }
```

→ Hai file dùng ngưỡng **khác nhau** (1 km/h vs 3 km/h), gây ra trạng thái không nhất quán giữa MapMonitor và JourneyHistory.

### 2.6 `MapMonitorPage`: Lịch sử hành trình trong ngày load nhưng không hiển thị trên map

```jsx
// MapMonitorPage.jsx – fetch journeyHistory nhưng không truyền vào MapDashboard
<MapDashboard 
    vehicles={vehicles} 
    selectedVehicle={selectedVehicle}
    journeyHistory={journeyHistory}  // ← prop được truyền vào
/>
// MapDashboard.jsx – prop journeyHistory KHÔNG được sử dụng
export default function MapDashboard({ vehicles, selectedVehicle }) { // ← không nhận prop này
```

Dữ liệu `journeyHistory` được fetch và truyền vào `MapDashboard` nhưng component này **không nhận và không render Polyline**. Tính năng xem đường đi trong ngày tại màn Monitor bị "chết" hoàn toàn.

---

## 🟡 3. Vấn đề Database / Performance

### 3.1 TimescaleDB được đề cập trong docs nhưng chưa được tích hợp

[`project_structure_and_scaling.md`] khuyến nghị dùng TimescaleDB để tự động partition `journey_logs` theo ngày. Nhưng schema Prisma hiện tại **không có lệnh `create_hypertable`** và không có setup nào. Với tốc độ ghi 2s/lần × N xe, bảng `journey_logs` sẽ phình to nhanh chóng mà không được partition.

### 3.2 Không có index cho `imei` trên bảng `vehicles`

```prisma
model Vehicle {
  imei  String  @unique
```

`@unique` tạo index nhưng query trong `pingStatus.js` và `vehicleRoutes.js` đôi khi filter theo `lastUpdatedAt` mà không có composite index `(currentStatus, lastUpdatedAt)`. Cron watchdog chạy mỗi 3 phút query `findMany` với 2 điều kiện thời gian → full scan nếu bảng lớn.

### 3.3 Không có giới hạn kết quả (LIMIT) cho `/history` endpoint

```js
// vehicles.js
const history = await prisma.$queryRaw`
    SELECT ... FROM journey_logs
    WHERE vehicle_id = ${vehicle.id}
      AND "timestamp" >= ${'...'}::timestamp
      AND "timestamp" <= ${'...'}::timestamp
    ORDER BY "timestamp" ASC;
`
```

Không có `LIMIT`. Khoảng 24h với 2s/bản ghi = **43,200 bản ghi** trả về một lần. Với nhiều xe, response này có thể vài chục MB, gây chậm browser và có thể timeout.

---

## 🟡 4. Vấn đề Frontend / UX

### 4.1 URL Backend hardcode trong Frontend (`localhost:5000`)

```js
// VehicleContext.jsx
const API_BASE_URL = 'http://localhost:5000/api';
const SOCKET_URL = 'http://localhost:5000';
```

Không dùng biến môi trường (`import.meta.env.VITE_API_URL`). Khi deploy lên production (Vercel + server thật), toàn bộ API call sẽ fail.

### 4.2 `JourneyHistoryPage`: File `journeyAggregator.js` còn tồn tại nhưng không được dùng

Theo kế hoạch V2 trong `journey_history_implementation_plan.md`, `journeyAggregator.js` đã được thay thế bởi `journeyFormatter.js`. Tuy nhiên file cũ vẫn còn trong codebase (~171 dòng) nhưng không được import ở đâu → dead code, gây nhầm lẫn.

### 4.3 `VehicleListPage`: Phân trang chưa hoàn thiện

```jsx
// Hiện tại chỉ render tối đa 5 trang
const pageNumber = idx + 1; // Simplify for now
```

Nếu có > 50 xe (5 trang × 10), pagination không nhảy đúng page. Nút "Go to page" cũng không có handler (`→` button không có onClick).

### 4.4 Không có cơ chế retry / error state khi mất kết nối Socket

```js
// VehicleContext.jsx
const socket = io(SOCKET_URL);
socket.on('connect', () => { ... });
// Không có: socket.on('disconnect'), socket.on('connect_error')
```

Nếu backend restart hoặc mạng gián đoạn, UI không thông báo gì cho người dùng. Xe trên map "đứng im" không phân biệt được là đang offline thật hay WebSocket bị đứt.

### 4.5 `VehicleList` không có filter "Mất tín hiệu" trong phần chip filter

```jsx
// VehicleList.jsx – chips filter chỉ có ALL, RUNNING, STOPPED, PARKED
// Thiếu LOST_SIGNAL / OFFLINE
```

Nhưng ô KPI "Mất tín" có click → `setFilter('LOST_SIGNAL')` hoạt động được. Chip filter bar bên dưới lại thiếu option này → trải nghiệm không nhất quán.

---

## 🔵 5. Vấn đề Vận hành / Deployment

### 5.1 Không có bất kỳ test nào (Unit/Integration)

Toàn bộ codebase **không có file test nào**. Logic quan trọng như `parser.js`, `determineVehicleStatus()`, `journeyFormatter.js` hoàn toàn không có test coverage.

### 5.2 Không có Docker / PM2 setup cho production

README hướng dẫn chạy bằng `npm run dev` (Vite devserver + nodemon), không có:
- `Dockerfile` cho từng service
- `ecosystem.config.js` cho PM2
- Health check endpoint (`/health` hoặc `/ping`)

### 5.3 MQTT host qua ngrok – không ổn định cho production

```
MQTT_HOST=tcp://0.tcp.ap.ngrok.io
MQTT_PORT=16386
```

Ngrok là tunnel tạm thời, URL thay đổi mỗi lần restart tunnel miễn phí. Môi trường production cần MQTT broker cố định (IP public hoặc domain riêng).

### 5.4 Không có logging hệ thống (chỉ `console.log`)

Toàn bộ hệ thống chỉ dùng `console.log/error`. Không có:
- Structured logging (winston, pino)
- Log rotation
- Log aggregation (ELK, Loki)

Khi hệ thống chạy production với hàng chục xe, không thể trace lỗi hiệu quả.

---

## 📋 Tổng hợp theo Mức độ ưu tiên

| # | Vấn đề | Mức độ | Nhóm |
|---|---|---|---|
| 1 | API không có Authentication | 🔴 Nghiêm trọng | Bảo mật |
| 2 | SQL Injection trong Ingestion | 🔴 Nghiêm trọng | Bảo mật |
| 3 | `journeyHistory` prop bị "chết" trên MapMonitorPage | 🔴 Bug thực tế | Backend/FE |
| 4 | Batch INSERT mất dữ liệu khi lỗi, không retry | 🟠 Cao | Backend |
| 5 | `vehicleCache` không có TTL – stale cache | 🟠 Cao | Backend |
| 6 | URL `localhost:5000` hardcode – deploy sẽ fail | 🟠 Cao | Frontend |
| 7 | Logic phân trạng thái bị nhân đôi + ngưỡng khác nhau | 🟠 Cao | Logic |
| 8 | Không có LIMIT trên `/history` – có thể OOM browser | 🟡 Trung bình | Performance |
| 9 | TimescaleDB không tích hợp dù docs yêu cầu | 🟡 Trung bình | Database |
| 10 | Không có retry/error state cho Socket disconnect | 🟡 Trung bình | Frontend |
| 11 | File `.env` có credentials yếu commit lên repo | 🟡 Trung bình | Bảo mật |
| 12 | Cron mở MQTT connection riêng – thừa | 🟡 Trung bình | Backend |
| 13 | Pagination `VehicleListPage` chưa hoàn thiện | 🔵 Thấp | Frontend |
| 14 | Chip filter thiếu "Mất tín hiệu" | 🔵 Thấp | UX |
| 15 | Không có test, Dockerfile, PM2 setup | 🔵 Thấp | DevOps |
| 16 | MQTT qua ngrok – không ổn định | 🔵 Thấp | Ops |
