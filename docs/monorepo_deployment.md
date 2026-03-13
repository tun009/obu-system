# Bí ẩn của Monorepo: Code chung nhưng Deploy Tách biệt (Isolated Deployment)

Khái niệm **Monorepo** (Một Repository chứa nhiều Dự án) thực ra là "Vũ khí bí mật" của Google, Facebook và Vercel. Chắc hẳn bạn đang thắc mắc: *"Nếu vứt chung Frontend, Backend, Service 1, Service 2 vào 1 thư mục `obu-system`, thì lúc copy code lên Server 1 nó lại mang theo cả code của Frontend à? Vừa nặng vừa lộ code?"*

Sự thật là **KHÔNG**. Monorepo chỉ là không gian lúc lập trình (Development). Khi **Đóng gói (Build)** để mang đi chạy (Deploy), hệ thống sẽ tóm cổ từng thằng ra riêng lẻ, cắt đứt vòi với những thằng không liên quan.

Dưới đây là 3 cách phổ biến nhất để thực hiện phép màu này:

---

## Cách 1: Sử dụng Công cụ quản lý Turborepo (Hoặc Yarn/PNPM Workspaces)

Bạn hoàn toàn không phải tự copy thủ công bất kỳ file nào. Khi dùng `Turborepo`, nó hiểu sự phụ thuộc của các Folder. 

**Kịch bản: Bạn muốn Deploy cái `mqtt-ingestion` lên VPS số 1.**
*   Trên VPS số 1, bạn gõ lệnh: `npx turbo run build --filter=mqtt-ingestion`
*   **Phép màu xảy ra:** Turborepo sẽ nhặt đúng những file nằm trong thư mục `apps/mqtt-ingestion` VÀ các file dung chung mà nó mượn từ `packages/database`. Nó tạo ra 1 cục `.zip` (hoặc thư mục `dist`) gọn nhẹ chỉ khoảng vài chục MB.
*   Cục `dist` này **hoàn toàn không có tí khái niệm nào** về code của `web-frontend` hay `api-backend`.
*   Bạn chỉ cần gõ `node dist/index.js` là nó chạy độc lập trên VPS đó.

---

## Cách 2: Sự kỳ diệu của Docker (Cách tốt nhất)

Khi bạn muốn đưa ra Thế giới (AWS, Digital Ocean), Docker là Vua.
Trong thư mục `obu-system/`, bạn không viết 1 cái `Dockerfile` chung, mà bạn viết **3 cái `Dockerfile` khác nhau**.

**Dockerfile số 1 (Nằm trong `apps/mqtt-ingestion/Dockerfile`):**
```dockerfile
# Chỉ copy thư mục mqtt-ingestion và database
COPY apps/mqtt-ingestion ./
COPY packages/database ./
RUN npm install
CMD ["node", "src/index.js"]
```

**Dockerfile số 2 (Nằm trong `apps/web-frontend/Dockerfile`):**
```dockerfile
# Chỉ copy thư mục frontend
COPY apps/web-frontend ./
RUN npm run build
CMD ["npm", "start"]
```

**Lúc Deploy:**
*   Trên Server 1 đang nổ máy bên Mỹ, bạn kéo code về và gõ lệnh build cái Dockerfile số 1. Nó đẻ ra 1 Container chỉ biết đúng việc nghe MQTT.
*   Trên Server 2 (Vercel) nằm ở Singapore, nó tự động đọc Dockerfile số 2 và lôi đúng giao diện Frontend ra chạy. Không ai liên quan ai!

---

## Cách 3: Nền tảng Cloud tự hiểu (Vercel, Render)

Nếu bạn lười thiết lập Server thủ công, bạn đẩy cả cục `obu-system` lên Github.
Sau đó bạn đăng nhập vào Vercel (để host Frontend) và Render (để host Backend).

*   **Tại Vercel:** Bạn bấm "Thêm dự án mới", chọn Repo `obu-system`. Ngay cái mục *Root Directory*, bạn gõ: `apps/web-frontend`. Vercel gật đầu: *"À tao hiểu rồi, tao mặc kệ phần còn lại, tao chỉ biên dịch và đẩy cái thư mục web này lên mạng thôi"*.
*   **Tại Render:** Bạn thêm cái Node.js API. Root Directory bạn gõ: `apps/api-backend`. Render cũng tự động bóc tách đúng cái API đó ra chạy.

### Tổng Kết
Bạn hãy coi `obu-system` chỉ là cái **Phòng làm việc** của bạn. Lúc đi học (như `api-backend`) thì chỉ xếp sách vở môn Toán vào cặp. Lúc đi đá bóng (`mqtt-ingestion`) thì chỉ xách đôi giày. Đồ đạc ở chung phòng nhưng lúc lên đường đi (Deploy) thì ai mang đồ nấy!
