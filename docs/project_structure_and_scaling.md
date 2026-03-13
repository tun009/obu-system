# Chiến lược Lưu trữ Dữ liệu Lớn & Cấu trúc Thư mục Microservices

## 1. Bài toán lưu trữ tỷ bản ghi của `journey_logs`

Bạn hoàn toàn đúng khi lo lắng về bảng `journey_logs`. Với hàng chục, hàng trăm xe gửi tọa độ 2 giây/lần, bảng này sẽ phình lên hàng triệu bản ghi mỗi ngày, dẫn đến việc quét tìm kiếm (query) cực kỳ chậm nếu không thiết kế sớm.

Và vì đặc thù nghiệp vụ của bạn: **"Báo cáo và xem lại lịch sử thường được truy xuất theo TỪNG NGÀY"**, chúng ta có công cụ tuyệt hảo nhất trong PostgreSQL để xử lý việc này: **Table Partitioning (Phân mảnh bảng theo Thời gian)**.

### Cơ chế Partitioning hoạt động thế nào?
Thay vì lưu 1 tỷ bản ghi vào CÙNG 1 CÁI BAO TẢI KHỔNG LỒ tên là `journey_logs`, Database sẽ tự động chia nhỏ thành các "bao tải con" TÙY THEO NGÀY:
*   `journey_logs_2026_03_12` (chứa 4 triệu bản ghi của ngày 12/03)
*   `journey_logs_2026_03_13` (chứa 4 triệu bản ghi của ngày 13/03)
*   ...

**Sức mạnh của nó:**
1.  **Chớp nhoáng khi Query:** Khi người dùng xem báo cáo của "ngày 12/03", thay vì PostgreSQL đi mò mẫm trong 1 tỷ dòng, nó chỉ mở đúng cái "bao tải" `journey_logs_2026_03_12` có vài triệu dòng ra xem (bỏ qua hoàn toàn dữ liệu các ngày khác). Tốc độ trả về gần như Tức thì.
2.  **Dọn rác dễ dàng (Data Retention/Archiving):** Sau 1 năm, lười xoá từng bản ghi, lệnh `DROP TABLE journey_logs_2025_03_01` chỉ mất 0.1 giây để vứt cái "bao tải" cũ đi thay vì lệnh `DELETE FROM...` thông thường quật chết toàn bộ tài nguyên Server.

### Giải đáp: TimescaleDB hay Tự Phân Mảnh (Native Partitioning)?

Thực ra, **TimescaleDB CHÍNH LÀ một công cụ tự động hóa việc Phân mảnh (Partitioning) của PostgreSQL**.
*   **Nếu dùng Postgres bản "Chay" (Native Partitioning):** Bạn phải tự viết code hoặc tự cài Job để cứ đêm giao thừa là tạo sẵn 1 bảng `journey_logs_2026_03_13` cho ngày mai. Rất cực và dễ lỡ quên sinh lỗi khi qua ngày mới.
*   **Nếu cài thêm Extension TimescaleDB:** Bạn chỉ gõ đúng 1 lệnh lúc tạo bảng: `SELECT create_hypertable('journey_logs', 'timestamp');`. Xong! Từ đó về sau, TimescaleDB sẽ TỰ ĐỘNG đẻ ra các bảng con theo tuần/ngày (gọi là *chunk*) dưới nền mỗi khi có dữ liệu rơi trúng mốc thời gian đó. Bạn code như đang tương tác với 1 bảng bình thường.

=> **Khuyên dùng:** NÊN CÀI MẶC ĐỊNH **PostgreSQL + TimescaleDB**.

### Giải đáp: Query nhiều ngày thì sao (VD: Từ 01/03 đến 15/03)?

Câu trả lời là **Vô cùng đơn giản và Nhanh hơn bình thường rất nhiều**.

Lý do là vì PostgreSQL (và TimescaleDB) dùng cơ chế **Bảng Ảo (Parent Table / Hypertable)**.
*   Lúc bạn viết Code Node.js (Prisma) hoặc gõ SQL, bạn Tuyệt đối KHÔNG BAO GIỜ phải gõ cái tên `journey_logs_2025_03_01`.
*   Bạn **LUÔN LUÔN** query vào tên bảng gốc là: `SELECT * FROM journey_logs WHERE time BETWEEN '2025-03-01' AND '2025-03-15'`.
*   **Sự thông minh của Database (Query Planner):** Khi nhận được lệnh trên, PostgreSQL tự động phân tích cái điều kiện `BETWEEN 01 -> 15`. Nó biết ngay nó chỉ cần chui xuống tầng hầm, nhón lấy đúng 15 cái "bao tải con" từ mùng 1 đến 15 ra ghép lại với nhau rồi trả về cho bạn. Nó **Bỏ Qua Hoàn Toàn** hàng ngàn cái bao tải của các tháng trước và năm trước.
*   Do đó, dù bạn query chéo 2 ngày hay chéo 30 ngày, hệ thống vẫn "Bách phát bách trúng" mà không bao giờ bị hiện tượng Full Table Scan (Quét toàn bộ ổ cứng) làm treo máy chủ.

=> **Kết luận:** Bảng `journey_logs` CÓ THỂ ĐÁP ỨNG lưu trữ Vĩnh viễn mà không bao giờ sợ sập hay chậm Query, nhờ kỹ thuật Partitioning theo ngày.

---

## 2. Công Nghệ Hiện Đại Sử Dụng Trong Dự Án (Tech Stack)

Để hệ thống này đạt chuẩn "Enterprise" (Doanh nghiệp), có khả năng gánh vác hàng triệu luồng dữ liệu mà vẫn dễ dàng bảo trì và mở rộng, chúng ta sẽ áp dụng các công nghệ tối tân nhất hiện nay:

*   **⚡ Monorepo Manager (Turborepo):** Quản lý toàn bộ vòng đời ứng dụng. Giúp bạn gõ 1 lệnh là khởi động cả Frontend, Backend, Ingestion cùng lúc; và mang đi deploy từng phần cực kỳ thông minh.
*   **📡 Backend Ingestion (Node.js & MQTT.js):** Lắng nghe dữ liệu IOT tốc độ cao bằng Event-Loop của Node.js, xử lý hàng ngàn Message mỗi giây không giật lag.
*   **🗄️ Database Siêu Không Gian (PostgreSQL + PostGIS):** Sự lựa chọn số 1 thế giới để tính toán bản đồ, tổng độ dài quãng đường và vẽ Geofencing (Hàng rào địa lý).
*   **🔗 Tầng Giao Tiếp SQL Chuyên Nghiệp (Prisma ORM):** Thay vì gõ tay hàng ngàn dòng lệnh SQL dễ sai sót, Prisma biến mọi table trong Postgres thành Class Javascript. Cực kỳ an toàn, có sẵn Type-Check (Gỡ lỗi tự động).
*   **🐿️ Cầu Nối Thời Gian Thực (Redis Pub/Sub):** Tác nhân "kỳ diệu" đứng giữa 2 Service để gửi tín hiệu cập nhật bản đồ ngay lập tức (Realtime) tới người dùng Web phân tán mà không làm sập Database.
*   **🌐 Trạm Phát Sóng Giao Diện (Socket.IO):** Gắn tại Service 2 để bắn tín hiệu Websocket lên hàng ngàn trình duyệt xem báo cáo cùng lúc.
*   **🖥️ Giao Diện Nhận Tín Hiệu (React / Next.js):** Framework hiện đại bậc nhất để vẽ màn hình "Giám sát xe" cực kỳ mượt mà, tối ưu SEO, không giật trang khi load bản đồ GPS.

---

## 3. Những thứ Cần Chuẩn bị để chạy Microservices

Để triển khai được hệ thống "Công nghiệp" này, bạn cần chuẩn bị môi trường:

1.  **Node.js (v18+ hoặc v20+):** Để chạy mã nguồn 2 services.
2.  **PostgreSQL (kèm PostGIS extension):** Cơ sở dữ liệu chính yếu.
3.  **Redis Cache:** Cầu nối trung chuyển Pub/Sub siêu tốc để vòi phun Socket đẩy mượt mà mà không làm kẹt Database.
4.  **PM2 (Process Manager):** Trình quản lý giúp Service chạy ngầm vĩnh viễn, chết tự khởi động lại (Hoặc dùng Docker nếu bạn quan thuộc DevOps).

---

## 3. Cấu trúc Thư mục Tiêu chuẩn (Dễ dàng Mở rộng)

Với hệ thống này, ta dùng kiến trúc **Monorepo** (Nhiều con nằm chung 1 ngôi nhà). Nó giúp mọi service chia sẻ chung File định nghĩa Database (Prisma), định dạng Typescript (Interfaces)...

Cấu trúc cây thư mục Đề xuất của Project:

```text
obu-system/
├── packages/                  # Chứa các code dùng chung cho nhiều service
│   ├── database/              # (Cốt lõi) Chứa file kết nối DB, Prisma Schema
│   │   ├── prisma/schema.prisma  # Nơi khai báo Table Postgres + Partition
│   │   └── index.js
│   └── shared-types/          # Định nghĩa các cấu trúc chuẩn (Nếu dùng TypeScript)
│
├── apps/                      # Chứa các Microservices (Ứng dụng chạy thực tế)
│   ├── mqtt-ingestion/        # (Service 1) Background Worker hút tọa độ
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.js       # Khởi chạy Service, connect Redis
│   │       ├── mqttClient.js  # Lắng nghe MQTT từ broker
│   │       └── parser.js      # Giải mã JSON & Tính trạng thái chạy/đỗ
│   │
│   ├── api-backend/           # (Service 2) Server API & Socket cho Giao diện
│   │   ├── package.json
│   │   └── src/
│   │       ├── server.js      # Khởi động Express Server
│   │       ├── routes/        # Cung cấp API (ví dụ: REST lấy danh sách xe)
│   │       ├── controllers/   # Xử lý Logic lấy dữ liệu từ Postgres trả cho UI
│   │       └── socketHub.js   # Lắng nghe Redis & Emit dữ liệu thời gian thực
│   │
│   └── web-frontend/          # Web hiển thị (React.js / Next.js)
│       ├── package.json
│       ├── src/
│       │   ├── components/    # (Thêm xe, Bảng điều khiển, Bản đồ...)
│       │   ├── pages/         # Màn Hành trình, Danh sách
│       │   └── hooks/         # Kết nối API Backend & Lắng nghe Websocket
│
├── docs/                      # Tài liệu hệ thống
│   ├── system_architecture.md
│   └── project_structure_and_scaling.md (File bạn đang đọc)
│
└── package.json               # Package gốc quản lý toàn bộ cả cụm Monorepo
```

**Ưu điểm của Cấu trúc này:**
*   Phần Logic kết nối Database (`packages/database`) và các truy vấn `Prisma` sẽ được dùng chung cho cả `mqtt-ingestion` (dùng để INSERT) và `api-backend` (dùng để GET SELECT). Không sợ bị lệch (sync) giữa 2 nơi.
*   Mai sau bạn có mở thêm 1 Service 3 mang tên `AI-Predict-Accidents` hay 1 Web Admin App riêng nữa, chỉ việc tạo thêm thư mục bên trong `apps/` là xong!

---

## 4. Chiến lược Triển khai (Deployment Strategy)

Đây là điểm tuyệt vời nhất của kiến trúc **Monorepo (Turborepo/Lerna)**: Tuy chúng được viết code chung trong CÙNG MỘT Thư mục dự án `obu-system/` để dễ lập trình viên quản lý, nhưng khi **Triển khai (Deploy)** ra thực tế, chúng có thể **nằm rải rác ở khắp nơi trên Thế giới**:

Bạn HOÀN TOÀN KHÔNG bắt buộc phải chạy tất cả trên 1 Server. Ngược lại, để hệ thống không thể bị "sập dây chuyền", đây là chiến lược chuẩn:

1.  **Frontend (`apps/web-frontend`):**
    *   Nên deploy hoàn toàn tách biệt đẩy lên các nền tảng Host Static đỉnh cao như **Vercel** hoặc **Netlify**. File HTML/CSS/JS tĩnh sẽ được caching CDN toàn cầu, load trong < 1s và miễn phí băng thông.
2.  **Service Nhận dữ liệu (`apps/mqtt-ingestion`):**
    *   Deploy lên **VPS số 1** (hoặc AWS EC2 Instance 1). Nó chỉ cần cấu hình bình thường (2 Core, 2GB RAM), chạy nền ẩn bằng Docker hoặc PM2, vì không phải hứng traffic từ hàng ngàn trình duyệt.
3.  **Service Web API & Websocket (`apps/api-backend`):**
    *   Deploy lên **VPS số 2** (hoặc AWS EC2 Instance 2... Instance N). Đây là nơi gánh Traffic người dùng nên có thể Cần scale RAM cao lên để duy trì chục nghìn kết nối Socket.
4.  **Database (PostgreSQL & Redis):**
    *   Tách ra thuê riêng **Database Service Managed** (Như AWS RDS, Supabase, hoặc VPS số 3). Cả Service 1 và Service 2 đều trò chuyện chéo qua đây.

Nhờ kiến trúc này, *Nếu VPS số 2 (Web API) có lỡ sập do DDOS*, Dữ liệu từ xe ô tô vẫn âm thầm được Service 1 (VPS số 1) hút không rớt 1 giọt nào để vứt vào Database (VPS số 3). Khi Web API dựng lại, mọi dữ liệu vẫn còn nguyên vẹn!

