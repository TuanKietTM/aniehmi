# 🚀 Deploy ANIE-HMI lên Render.com + Turso

## 📋 Danh sách file đã cập nhật:
✅ `package.json` - Thay thế `better-sqlite3` bằng `@libsql/client`
✅ `server.js` - Chuyển đổi sang dùng Turso/LibSQL, hỗ trợ cả local và production
✅ `.env.example` - File mẫu biến môi trường
✅ `render.yaml` - Cấu hình tự động deploy trên Render
✅ `.gitignore` - Thêm `.env` vào danh sách bỏ qua

## 🔑 Các bước tiếp theo:

### 1. Tạo Database trên Turso (Không cần CLI!)
- Truy cập: https://turso.tech
- Đăng ký/Đăng nhập với GitHub
- Click "Create Database" → Đặt tên `anie-db`
- Vào "Settings" → Copy:
  - `Database URL` (vd: `libsql://anie-db-xxx.turso.io`)
  - `Auth Token`

### 2. Tạo file `.env` (local development)
```
TURSO_DATABASE_URL=libsql://your-db-name.turso.io
TURSO_AUTH_TOKEN=your-turso-auth-token
NODE_ENV=production
```

### 3. Đẩy code lên GitHub
```bash
git add .
git commit -m "Deploy preparation: Turso + Render"
git push
```

### 4. Tạo Web Service trên Render
1. Đăng nhập https://render.com
2. New → Web Service → Kết nối repository GitHub
3. Render sẽ tự động đọc `render.yaml`
4. Vào Settings → Environment Variables, thêm:
   - `TURSO_DATABASE_URL` = URL từ Turso
   - `TURSO_AUTH_TOKEN` = Token từ Turso
5. Click "Deploy"!

### 5. Kiểm tra sau deploy
- Server sẽ chạy trên: `https://anie-hmi.onrender.com`
- API: `https://anie-hmi.onrender.com/api/data`