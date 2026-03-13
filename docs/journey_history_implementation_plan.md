# Phân tích & Triển khai Màn hình Nhật trình xe (Journey History) V2 - Raw Data Plotting

Dựa trên phản hồi mới nhất của sếp, mục tiêu hiện tại là **ưu tiên tính trung thực của dữ liệu phần cứng**. Chúng ta sẽ dẹp bỏ hoàn toàn thuật toán gộp nhóm sự kiện (Aggregation) và dịch địa chỉ (Reverse Geocoding) để tránh làm "tròn" và mất mát các điểm nhỏ giọt. 

## 1. Phương pháp Triển khai Mới: Raw Data Plotting

1.  **Hiển thị Toàn bộ Dữ liệu Thô (Raw Data Plotting):**
    - Cứ có bản tin hợp lệ nào bắn về từ phần cứng thì hiển thị 1 dòng trên UI Timeline và 1 điểm (marker/vertex) trên đường đi lưới bản đồ.
    - Timeline sẽ hiển thị các thông số kĩ thuật (Lat/Lng, Vận tốc, Fuel, Engine RPM) thay vì dòng địa chỉ Text (để tiết kiệm tài nguyên API bên thứ 3).

2.  **Khử Nhiễu / Lọc Dữ Liệu Rác (GPS 0,0):**
    - Khi tắt máy hoặc mất tín hiệu, OBU bắn về tọa độ `(0, 0)`, làm bản đồ vẽ đường thẳng từ VN kéo dài sang Null Island (Châu Phi).
    - Cần một bộ lọc: `Math.abs(lat) < 0.1 && Math.abs(lng) < 0.1`

## 2. Thảo luận: Xử lý Dữ liệu Rác (0,0) ở Tầng Nào?

Khi đối mặt với dữ liệu nhiễu `(0,0)`, chúng ta có 3 chốt chặn để xử lý:

| Cấp độ | Vị trí Xử lý | Ưu điểm | Nhược điểm | Đề xuất |
| :--- | :--- | :--- | :--- | :--- |
| **Tầng 1** | **MQTT Ingestion** (Ngay khi thiết bị gửi lên) | Tiết kiệm DB nhất. Dữ liệu rác không bao giờ được lưu vào Database. | Làm mất tính "Audit" (Truy vết). Nếu sau này thiết bị lỗi gửi toàn 0,0, ta sẽ tưởng là OBU mất kết nối chứ không biết là do GPS hỏng. DB bị mất 1 khoảng thời gian trống. | ❌ Không nên. Ingestion nên làm đúng nhiệm vụ: Lưu trung thực mọi thứ phần cứng nhổ ra. |
| **Tầng 2** | **Backend API** (Khi Frontend query `/history`) | Tốt nhất. Frontend nhận data sạch sẽ, không cần tốn CPU/RAM để lặp mảng lọc rác nữa. DB vẫn giữ được log thô để debug phần cứng khi cần. | Query chậm hơn 1 chút nếu dùng `WHERE lat != 0`, tuy nhiên PostGIS xử lý bounding box rất nhanh. | ✅ Mức lý tưởng nhất. Nên áp dụng lâu dài (Dùng SQL Query hoặc PostGIS Query). |
| **Tầng 3** | **Frontend UI** (Trong React Component) | Giải pháp "Chữa cháy" nhanh nhất. BE khỏi nhúng tay. | Tốn băng thông mạng tải hàng nghìn Object rác xuống Browser rồi lại phải ngốn CPU của Browser (Laptop người dùng) để quét mảng vứt đi. | ⚠️ Tạm thời (Hiện tại code Frontend đang gánh phần này). |

👉 **Chiến lược chốt:** Chúng ta sẽ chuyển logic lọc `0,0` xuống **Backend API**. Database query sẽ trực tiếp từ chối trả về các bản ghi thiếu GPS để Frontend "nhẹ đầu". Tuy nhiên, nếu sếp muốn Timeline *vẫn hiển thị* việc cúp máy (không có GPS, báo Mất tín hiệu) thì Backend vẫn phải trả về, và ta chỉ dùng Frontend để "giấu" chấm đó trên Map.

---

## 3. Kiến trúc Frontend của Màn Nhật trình (`JourneyHistoryPage.jsx`) cập nhật:

Màn hình này sẽ được chia rẽ thành 3 phần component chính để code không bị rối:
*   **`HistoryFilterBar`**: Khối chọn Xe, Chọn Từ ngày - Đến ngày, nút Xuất file.
*   **`HistoryStats`**: 4 ô Card hiển thị Tổng KM, Thời gian...
*   **`HistoryTimeline`**: Khối Sidebar bên trái hiển thị toàn bộ chi tiết từng bản tin thu được (Lat/Lng, Vận tốc, Thời gian).
*   **`HistoryMap`**: Khối bản đồ bên phải, vẽ `Polyline` đường đi và chèn các Marker tại TẤT CẢ các điểm hợp lệ.

### Thuật toán Xử lý Dữ liệu Nhẹ (Data Formatting)
Sửa đổi file `utils/journeyAggregator.js` chuyển thành File `utils/journeyFormatter.js`.
- Bỏ logic Aggregate Event.
- Bỏ luôn thuật toán `Haversine` tính Quãng đường ở Frontend.
- Hàm format sẽ nhận mạng `rawLogs` và scan 1 vòng để:
  - Lấy `Total KM` trực tiếp từ con số Backend tính toán trả về (Dùng PostGIS `ST_Length`).
  - Phân loại trạng thái (Chạy/Dừng/Đỗ) Dựa vào RPM/Speed cho TỪNG ĐIỂM (không gộp).
  - Return thẳng mảng data và list Map Points ra.

### Cập nhật Backend API (`apps/api-backend/src/routes/vehicles.js`)
- Endpoint `GET /api/vehicles/:imei/history`:
  - Thêm cờ `WHERE lat != 0 AND lng != 0` (hoặc kiểm tra NULL) để chặn đứng dữ liệu rác GPS trước khi gửi về Frontend.
  - Sử dụng hàm Không gian của PostGIS: `ST_Length(ST_MakeLine(geom::geometry)::geography) / 1000` để tính trực tiếp Tổng quãng đường (KM) cực kỳ chuẩn xác ngay trong khối SQL Query và trả về ở trường `totalKm`. Backend chịu tải tính toán này thay vì vứt cho Frontend.
