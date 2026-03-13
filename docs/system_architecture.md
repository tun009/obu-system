# Kiến trúc Hệ thống OBU Tracker (Phiên bản Microservices)

## 1. Tại sao cần tách Service (Microservices)?

Theo như yêu cầu hiện tại, việc gộp chung việc "Lắng nghe tín hiệu MQTT" chung với "Phục vụ người dùng Web (API, Socket)" trong cùng 1 file `server.js` có rủi ro rất lớn:
*   Nếu lượng người dùng truy cập web xem bản đồ đông, API bị chậm, có thể gây đứt kết nối MQTT làm mất dữ liệu hành trình của xe.
*   Nếu có lỗi khi parse/xử lý tín hiệu OBU làm văng ứng dụng (App crash), toàn bộ người dùng đang xem trang web Web Dashboard cũng sẽ bị sập theo.

**👉 Giải pháp: Chia hệ thống thành 2 "Công nhân" (Services) chạy độc lập, kết nối với nhau qua Database (PostgreSQL).**

---

## 2. Cấu trúc Mô hình 2 Services (Kiến trúc chuẩn Công nghiệp)

Ta sẽ có 2 Process (Dịch vụ) Node.js chạy riêng rẽ (tương lai có thể chạy trên 2 Server / 2 Docker Container hoàn toàn khác nhau):

### Service 1: `obu-mqtt-ingestion` (Chuyên biệt việc "nạp" dữ liệu)
*   **Nhiệm vụ:** Hoạt động âm thầm 24/7 ở Background, độc lập hoàn toàn với việc người dùng có vào Web xem hay không.
*   **Logic cốt lõi:**
    *   Mở kết nối MQTT (Subscribe các topic dạng `IMEI:`).
    *   Mỗi khi nhận tin nhắn (2s/lần): Phân tích (Parse JSON) -> Tìm ra `IMEI` -> Tính toán trạng thái xe thông qua `rpm` và `speed` (Mở máy / Tắt máy / Chạy / Dừng).
    *   **Thao tác DB:** 
        1. `INSERT` dòng log tọa độ vào Bảng siêu lớn `journey_logs` (PostGIS Time-series) để dùng cho việc tính tổng khoảng cách, báo cáo sau này.
        2. `UPDATE` trạng thái mới nhất ngay lập tức vào bảng thông tin từng xe `vehicles`.
*   **Độ ổn định:** Cực cao. Crash tự khởi động lại qua PM2, không ảnh hưởng ai. Rất ít khả năng chết do chỉ tập trung tính toán thầm kín.

### Service 2: `obu-api-backend` (Phục vụ Giao diện Người dùng)
*   **Nhiệm vụ:** Phục vụ ứng dụng React/NextJS của trình duyệt để hiển thị "Danh sách xe", "Nhật trình".
*   **Logic cốt lõi:**
    *   Chứa toàn bộ các RESTful API (`GET /api/vehicles`, `GET /api/reports/journey...`). Khi người dùng mở list danh sách, Service này query thẳng vào bảng `vehicles` lúc này đã luôn được cập nhật bởi Service 1 và trả về trong < 20ms.
    *   **Socket.IO Server:** Kết nối WebSocket với Browser để truyền tải thời gian thực.
        *   *Logic Pub/Sub:* Khi Service 1 lưu Database xong, nó sẽ "Publish" (hét lên) luồng dữ liệu mới vào 1 kênh trung chuyển tên là **Redis**. Thằng Service 2 lúc này được phân công "Subscribe" (lắng tai nghe) cái kênh đó.
        *   *Websocket Truyền phát:* Nghe thấy tiếng từ Redis, Service 2 lấy ngay cục tọa độ, dùng Socket.IO `emit` (Ném) thẳng lên màn hình của 100 người đang mở Web Dashboard mà **không cần query vào Database**.
        *   *Trường hợp không có ai xem Web:* Socket.IO sẽ nhận diện danh sách client kết nối đang bằng 0. Khi Redis hét lên, Service 2 vẫn nghe thấy nhưng nó sẽ **bỏ qua (drop packet)** chứ không gắng sức phát đi. Điều này đặc biệt tiết kiệm tài nguyên mạng và RAM cho máy chủ, Service hoàn toàn thong dong.

*   **Tính mở rộng:** Nếu quá đông người xem báo cáo làm máy chủ đuối, ta chỉ cần nhân bản Service 2 này thành 10 cái (Load Balancing), Service 1 (Ingestion) vẫn chỉ 1 cái bền vững.

---

## 3. Kiến trúc Database: PostgreSQL + PostGIS (+ TimescaleDB)

Sơ đồ 2 bảng (Table) cốt lõi thiết kế theo chuẩn ORM:

#### A. Bảng `Vehicle` (Lưu thông tin hiện tại của Đầu xe)
* `id`: Khóa chính
* `imei` (Unique): Mã nhận diện từ MQTT Topic.
* `license_plate`: Biển số (ví dụ: `29A - 111.11`).
* `type`: Kiểu xe.
* `current_status` (Enum: `ONLINE`, `OFFLINE`, `STOPPED`, `PARKED`, `LOST_SIGNAL`). Dựa trên `rpm` và mốc thời gian mất mạng.
* `current_location`: Dữ liệu Không gian (Point Geometry của PostGIS).
* `engine_rpm`, `speed_kmh`, `fuel_level`: Snapshot thông số mới nhất.
* `last_update_time`: Thời điểm chốt thông tin cuối cùng, nếu rà soát job thấy cái này quá 10 phút trước hiện tại -> Đánh cờ "Mất tín hiệu".

#### B. Bảng `JourneyLog` (Hệ thống lưu Log vĩ đại - Timeseries)
* Phục vụ đắc lực cho tính năng **Nhật Trình (Lịch sử hành trình)** và gọi các lệnh phức tạp như **`ST_Length(geom)`** để ra tổng số Km di chuyển.
* Có thể phân mảnh tự động bằng TimescaleDB chia nhỏ theo từng Ngày/Tuần (Partition by Time).
* Chứa: `timestamp` (thời điểm ghi nhận), `vehicle_id` (Foreing Key), `location` (Điểm Point Tọa độ của PostGIS), `speed`, `rpm`.

---

## 4. Tổng Kết & Lộ trình thực hiện Giai đoạn 1 (Backend)

1. Cài đặt PostgreSQL và extension PostGIS vào máy tính hoặc dùng DB Cloud.
2. Dựng thư mục chuẩn với ORM `Prisma` để Mapping Table thành Javascript Object.
3. Tạo thư mục con: `src/services/mqtt-listener` (Service 1).
4. Tạo thư mục con: `src/services/api-server` (Service 2).
5. Code quy trình Mở kết nối, lắng nghe, Insert vào table.

*Hệ thống này sinh ra là để đón nhận hàng trăm chiếc xe, xử lý hàng triệu bản ghi dễ dàng, phục vụ báo cáo tính cước và hàng rào điện tử (Geofence) một cách chuyên nghiệp.*
