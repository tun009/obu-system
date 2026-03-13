# File Kế Hoạch: Cập nhận Giao thức Trạng thái IoT (OBU v1)

Dựa trên luồng quy trình tối ưu 5G mới từ team IoT, hệ thống OBU Backend cần thay đổi logic tiếp nhận và xử lý trạng thái xe. Dưới đây là phân tích và kế hoạch triển khai.

## 1. Phân tích Yêu cầu mới

*   **Bỏ Auto-create xe rác:** Thiết bị lạ gửi data lên sẽ bị **bỏ qua**. Xe chỉ được đưa vào hệ thống khi Admin thêm thủ công qua Web UI (đã có tính năng này).
*   **Topic Subscription:** Đổi từ `#` (bắt mọi thứ) sang `obuv1/+` để chỉ hứng data hợp lệ từ thiết bị OBU. (Ví dụ: `obuv1/25075738112`).
*   **Biến số `car_response`:**
    *   `"car_response": "1"` -> Đang nổ máy (Di chuyển hoặc Dừng đèn đỏ chờ). Dữ liệu gửi liên tục.
    *   `"car_response": "0"` -> Vừa tắt máy (Rút chìa khóa). Sẽ chỉ có **1 bản tin duy nhất** này được gửi báo hiệu Tắt máy, sau đó ngắt kết nối để tiết kiệm 3G/5G.
*   **Vấn đề Mất Tín Hiệu (Offline) vs Tắt Máy (Parked):**
    *   Vì lúc tắt máy xe không gửi gì thêm, server không thể biết nó đang ngủ hay đã mất cắp/tháo nguồn (mất tín hiệu thực sự).
    *   **Giải pháp:** Cần Publish text `"check_status"` vào topic `obuv1/{imei}`. Nếu xe phản hồi -> Đang ngủ (Parked). Nếu im lặng -> Đứt kết nối (Offline).

## 2. Giải đáp thắc mắc của sếp về Cơ chế Pub/Sub

Sếp thắc mắc: *"ở api phục vụ màn giám sát khi sub mà không trả ra dữ liệu thì call lại pub... Cứ tưởng API sub trực tiếp?"*

**Giải thích Kiến trúc thực tế hệ thống hiện tại:**
Sếp nhớ cực kì chuẩn xác! Thiết kế ban đầu của chúng ta là bắn thẳng tốc độ bàn thờ qua **Redis Pub/Sub** để Màn hình giám sát (Live Map) chạy mượt mà theo thời gian thực (Real-time).

Tuy nhiên, hệ thống song song tồn tại **2 Luồng Dữ Liệu (Data Flows) hoạt động cùng lúc**:

*   **(Luồng 1) Luồng Real-time Nóng (Di chuyển/Sống):** 
    OBU gửi MQTT `->` Ingestion Service hứng `->` Đẩy thẳng JSON vào **Redis Channel** `->` Backend API bắt được từ Redis `->` Đẩy thẳng **Websocket** lên Màn Giám sát cho sếp xem xe nhích từng mét trên bản đồ mà không cần chờ Database ghi nhận.
    *(Luồng này siêu nhanh, nhưng nhược điểm là nếu xe tắt máy không chịu gửi gì, thì Websocket cũng im bặt, nó sẽ hiển thị xe đứng im ở vị trí cũ chứ không biết là Offline hay Đỗ).*

*   **(Luồng 2) Luồng Lưu trữ Trạng thái (Ngỏm/Tắt máy):** 
    OBU gửi MQTT `->` Ingestion Service hứng `->` **Ghi vào Database** (PostgreSQL) tọa độ chốt hạ và cập nhật thời gian `last_updated_at`.
    Khi sếp mới bật trình duyệt (Load trang lần đầu) hoặc khi xe im lặng quá lâu, Màn Giám sát không có tia Websocket nào bắn vào, nó buộc phải chọc vào **Luồng 2 (Database API)** để hỏi: *"Trạng thái cuối cùng của xe này là gì? Ở đâu? Cập nhật lúc mấy giờ?"*

**Vậy suy ra Luồng hoạt động (Flow) cho vụ Offline chính xác sẽ là:**
1.  Xe đang chạy trên đường, vạch sóng Websocket nảy liên tục (Luồng 1).
2.  Tới bãi đỗ, Thiết bị gửi `car_response=0` (Bản tin cuối). Ingestion bắt được, ghi vào Database `status = PARKED` và update `last_updated_at = 12:00` (Luồng 2), đồng thời bắn 1 tia Websocket cuối báo vể UI là "Parked".
3.  Do xe tắt máy, thiết bị ngắt mạng, im bặt. Màn hình Web không nhận được bất kì tia Websocket nào nữa, giữ nguyên Icon Đỗ Xe.
4.  **Hành động Ping (Check Status):** 30 phút sau, sếp nghi ngờ xe này mất trộm bị tháo ắc quy. Sếp bấm nút `[Ping]`. Nút này gọi API. API dùng lệnh `mosquitto_pub` bắn thẳng lệnh `"check_status"` vào MQTT Topic `obuv1/{imei}`.
5.  *(Khúc này là khúc Hên Xui):* 
    * Nếu OBU **còn sống**, nó lồm cồm tỉnh dậy (khởi động Sim), và "nhả" ra chuỗi JSON cũ. **Luồng 1 (Redis)** chớp ngay gói JSON này đẩy lên Websocket cho sếp xem -> Sếp an tâm xe vẫn đang ngủ bãi.
    * Nếu sếp đợi 15 giây mà màn hình không chớp cục JSON nào -> OBU **đã chết** (Offline thực sự). Màn hình Frontend sẽ chủ động chuyển Icon sang màu Xám (Mất tín hiệu).

## 3. Khởi dựng Phương án Triển khai (User Review Required)

> [!NOTE]
> **Chốt Phương án (13/03/2026):**
> Theo chỉ đạo của sếp, hệ thống sẽ sử dụng cơ chế **Ping Tự Động (CronJob)** để ưu tiên tối đa Trải nghiệm người dùng (UX) trên Màn hình giám sát. Sự đánh đổi một phần dung lượng 5G của thiết bị OBU là hoàn toàn chấp nhận được.

### Kế hoạch Code dự kiến:

**Phase 1: Ingestion Layer (Đón Data)**
1.  Bỏ logic `prisma.vehicle.create()`. Drop mọi IMEI lạ nằm ngoài Danh sách Database.
2.  Sửa topic bắt đầu lắng nghe thành `mqttClient.subscribe('obuv1/+')`. Lấy `imei` từ `topic`.
3.  Dựa vào `car_response`: 
    - Bằng `"1"` -> Xác định là `RUNNING` hoặc `STOPPED` (dựa trên tốc độ).
    - Bằng `"0"` -> Cập nhật trạng thái bằng `PARKED`.

**Phase 2: CronJob Check Status (Tự động Ping)**
1.  Tạo file `apps/api-backend/src/cron/pingStatus.js`.
2.  Thiết lập Cron chạy ngầm mỗi 3 phút (hoặc 5 phút tùy cấu hình).
3.  Truy vấn DB: Lấy danh sách các xe có trạng thái `PARKED` hoặc đã quá 3 phút không hoạt động.
4.  Dùng thư viện MQTT Publish chữ `"check_status"` vào `obuv1/{imei}` của các xe này.
5.  *Cơ chế Đánh dấu Offline:* Cron sẽ kiểm tra thêm 1 điều kiện: Phàm là xe nào đã gửi Ping đi mà `last_updated_at` trong Database đã cũ hơn 10 phút -> Chuyển dòng đó trong Database thành `current_status = 'OFFLINE'`, đồng thời có thể PUSH 1 sóng Redis để FE cập nhật UI thành xám.
