# OBU Fleet Tracker System (Microservices)

Dự án giám sát vận hành hệ thống OBU với kiến trúc Monorepo (Turborepo), sử dụng React, Vite, Tailwind CSS cho Frontend và Node.js, Express, Socket.io, Redis, PostgreSQL (với PostGIS) cho Backend.

## Yêu cầu môi trường (Prerequisites)
Bạn cần cài đặt các công cụ sau trước khi chạy dự án:
- **Node.js**: Phiên bản >= 18.x
- **Docker & Docker Compose**: Để chạy PostgreSQL và Redis.

## Hướng dẫn cài đặt và Khởi động nhanh (Quick Start)

### Bước 1: Khởi động cơ sở dữ liệu (Database & Redis)
Mở terminal tại thư mục gốc của dự án (`obu-system`) và chạy lệnh sau để khởi tạo DB và Redis qua Docker:
```bash
docker-compose up -d
```

### Bước 2: Cài đặt thư viện (Install Dependencies)
Dự án sử dụng NPM workspaces. Tại thư mục gốc của dự án (`obu-system`), chạy lệnh:
```bash
npm install
```

### Bước 3: Đồng bộ Database Schema (Prisma)
Chạy lệnh sau để tạo bảng trong PostgreSQL:
```bash
npx prisma db push --schema=packages/database/prisma/schema.prisma
```

### Bước 4: Khởi động Toàn bộ Dự án (Chạy 3 dịch vụ cùng lúc)
Nhờ có Turborepo cấu hình sẵn, bạn chỉ cần đứng ở thư mục gốc (`obu-system`) và chạy **1 lệnh duy nhất** này:
```bash
npm run dev
```

(Lệnh trên sẽ tự động bật 3 terminal song song cho 3 hệ thống: `mqtt-ingestion`, `api-backend`, và `web-frontend`).

---

## Truy cập Hệ thống
Sau khi chạy thành công `npm run dev`, mở trình duyệt và truy cập:
👉 **http://localhost:5173**
(Lưu ý: Bạn có thể cần đợi khoảng vài giây ở lần đầu tiên để Vite bundle giao diện React, sau đó ấn F5 lại trình duyệt nếu chưa lên hình).
