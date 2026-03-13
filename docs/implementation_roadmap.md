# Kế Hoạch Triển Khai Hệ Thống OBU Tracker (Step-by-Step)

Để đảm bảo code chặt chẽ, dễ nâng cấp và tái sử dụng, chúng ta sẽ thực hiện theo từng Phase (Giai đoạn) một. Không code tràn lan dễ gây gãy vỡ hệ thống.

---

## 🟢 PHẦN 1: Setup Môi trường & Khung xương Base (Nền móng)

Đây là bước quan trọng nhất. Cột móng vững thì xây nhà cao tầng mới không đổ.

*   **Bước 1.1: Khởi tạo Turborepo (Monorepo)**
    *   Tạo mới thư mục dự án chuẩn (xóa luôn cái `server.js` cũ đi vì nó không còn phù hợp với tầm nhìn lớn).
    *   Chia sẵn 3 thư mục `apps/mqtt-ingestion`, `apps/api-backend`, và `apps/web-frontend`.
*   **Bước 1.2: Thiết lập Tầng Cơ sở dữ liệu (Package `database`)**
    *   Tạo file `schema.prisma`.
    *   Khai báo bảng `Vehicle` (Lưu Data hiện tại) và `JourneyLogs` (Lưu lịch sử).
    *   Tích hợp extension ranh giới bản đồ (PostGIS) vào schema.
    *   *Nghiệm thu: Chạy lệnh Push DB và xem trên Prisma Studio thấy các bảng đã được sinh ra gọn gàng trong PostgreSQL.*

---

## 🟢 PHẦN 2: Xây dựng Trái tim Nhận Dữ Liệu (`mqtt-ingestion` Service)

Service này làm nhiệm vụ hút dữ liệu IOT cường độ cao.

*   **Bước 2.1: Code MQTT Client**
    *   Kết nối broker: `0.tcp.ap.ngrok.io:16386`, tự động Re-connect khi đứt trạm cáp.
*   **Bước 2.2: Code Bộ giải mã & Tính toán Vận Mệnh (Parser & Rules Engine)**
    *   Parse đoạn chuỗi JSON chắp vá của OBU.
    *   Viết hàm logic cực gắt bằng `rpm` và `speed` để phân tách rõ: `"Đang Mở Máy Chạy", "Đang Nổ Máy Đứng Yên", "Tắt Máy Đỗ Xe"`.
*   **Bước 2.3: Code tương tác DB & Redis**
    *   Mỗi khi có tín hiệu, dùng Prisma "UPSERT" (Update nếu có, Insert nếu chưa) vào bảng `Vehicle`.
    *   INSERT thẳng vào bảng rác `JourneyLogs`.
    *   Gửi 1 dòng thông báo `"Dữ liệu Vị trí Mới"` qua cổng Redis Pub/Sub.
    *   *Nghiệm thu: Bật giả lập OBU, nhìn thấy Data trong Postgres nhảy ầm ầm.*

---

## 🟢 PHẦN 3: Xây dựng Dịch vụ Cung Cấp API (`api-backend` Service)

Service này gánh hàng nghìn người xem trang Web.

*   **Bước 3.1: Xây dựng API Quản Lý Xe**
    *   Code API `POST /api/vehicles`: Cho phép người dùng Nhập Biển Số và Gắn cái Biển Số đó với mã IMEI của OBU.
    *   Code API `GET /api/vehicles`: Lấy toàn bộ danh sách Xe cộ kèm trạng thái MỚI NHẤT hiện tại (lấy ra từ Postgres).
*   **Bước 3.2: Xây dụng API Xem Lịch Sử (Nhật Trình)**
    *   Code API `GET /api/history`: Cho phép Web truyền lên IMEI và khoảng Thời gian (Từ ngày X -> Ngày Y). API sẽ query khôn khéo vào DB để moi tọa độ ra vẽ đường đi.
*   **Bước 3.3: Lắp trạm phát sóng Realtime (Socket.IO + Redis)**
    *   Lắng nghe kênh Redis (nơi thằng Service 1 đang hét lên ở Bước 2.3).
    *   Nếu trong trạm Web đang có người xem chiếc xe đó, lập tức phun (Emit) dòng chữ cập nhật đó thẳng lên trình duyệt Web.
*   **Bước 3.4: Xây dựng Cảnh vệ Vô Hình (Cronjob Check Offline)**
    *   Nơi đây sẽ có 1 vòng lặp (1 phút nhảy 1 lần). Kiểm tra trong DB xem xe nào quá 10 phút chưa gửi tín hiệu (last_update). Nếu thấy -> Cập nhật thành `"MẤT TÍN HIỆU"`.

---

## 🟢 PHẦN 4: Làm Giao Diện Người Dùng (Frontend `web-frontend`)

Đập cái giao diện UI hiện đại (Light-themed như Figma) vào.

*   **Bước 4.1: Code Khung (Layouts)**
    *   Tạo Sidebar, Menu Navbar (Danh sách xe, Nhật trình...).
*   **Bước 4.2: Code Màn hình Danh sách & Thêm Xe**
    *   Tích hợp form gọi vào API ở Bước 3.1.
*   **Bước 4.3: Hút Socket Bản Đồ Thời Gian Thực (Crucial)**
    *   Sử dụng Leaflet hoặc Google Maps.
    *   Khi cái Socket phun dữ liệu đến, chiếc xe (Marker) trên bản đồ tự động nhích lên 1 xăng-ti-mét và vòng số km/h nhảy múa mượt mà.
*   **Bước 4.4: Code màn Nhật Trình (Replay)**
    *   Vẽ lại nguyên một đường chỉ đỏ (Polyline) gánh từ điểm A -> Điểm B theo data API 3.2 lấy về.

---

### *CÁCH THỨC LÀM VIỆC CỦA TÔI VÀ BẠN:*

Để đảm bảo chất lượng công nghiệp cao nhất, **Tôi sẽ không gõ một lèo 1 vạn dòng code**. 
Thay vào đó, tôi sẽ làm như sau:
1. Tôi viết lệnh tạo Khung cấu trúc thư mục (Phần 1.1) -> Yêu cầu bạn kiểm tra xem nó tải thư viện có lỗi mạng không.
2. Xong tôi lại code cái Schema cho Postgres (Phần 1.2) -> Yêu cầu bạn xem Data nó có vào chuẩn không.
3. Cứ lần lượt, hoàn thành vững chắc từng mốc nhỏ một cho bạn nghiệm thu rồi mới đi tiếp.

Bạn đã cài **Node.js, Postgres và Redis** ở máy bàn của mình chưa? Hãy xác nhận để tôi gõ lệnh Khởi tạo Monorepo (Bước 1.1) NGAY LẬP TỨC!
