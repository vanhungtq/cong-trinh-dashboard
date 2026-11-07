# Đưa Công Trình lên GitHub và Cloudflare

## 1. GitHub

Dùng repository **private** cho ứng dụng nội bộ. Nếu mã nguồn chưa được push:

```sh
git init
git add .
git commit -m "Build construction project dashboard"
gh auth login
gh repo create cong-trinh-dashboard --private --source=. --remote=github --push
```

Nếu repository đã có, dùng `git remote add github <URL repository của bạn>` và `git push github main`. Không ghi token vào remote URL.

## 2. Tạo tài nguyên Cloudflare

```sh
npm ci
npx wrangler login
npx wrangler d1 create cong-trinh-db
```

Lấy `database_id` trả về và điền vào `d1_databases[0].database_id` trong `wrangler.jsonc`. Đây là mã tài nguyên, không phải API token.

```sh
npm run db:remote
npm run build
npx wrangler deploy
```

Lần đầu triển khai ở `APP_MODE=demo`. URL thật được Wrangler trả về; không suy đoán URL. Demo không cần Trello, Google hoặc Access.

## 3. Bảo vệ chế độ live bằng Cloudflare Access

1. Gắn hostname/domain của ứng dụng trong Cloudflare Workers.
2. Trong Cloudflare Zero Trust → Access → Applications, tạo ứng dụng self-hosted cho hostname đó. Cho phép danh sách email công ty; có thể dùng mã đăng nhập một lần gửi email.
3. Sao chép **Application Audience (AUD)** và team domain dạng `ten-doi.cloudflareaccess.com`.
4. Điền vào `vars` của Wrangler hoặc dùng biến của workflow:

```json
{
  "APP_MODE": "live",
  "CF_ACCESS_TEAM_DOMAIN": "ten-doi.cloudflareaccess.com",
  "CF_ACCESS_AUD": "application-audience",
  "ADMIN_EMAIL": "email-quan-tri-cua-ban@example.com"
}
```

5. Deploy lại. Admin email đầu tiên được thêm vào D1 sau khi JWT hợp lệ. Thêm các nhân sự còn lại ở màn Nhân sự.

Worker kiểm tra chữ ký JWT, issuer và audience bằng JWKS chính thức của Cloudflare; không tin email header tự gửi. API live không trả dữ liệu nếu thiếu cấu hình hoặc đăng nhập. Đường dẫn workers.dev không được Access bảo vệ sẽ nhận 401 ở API; dùng hostname đã cấu hình Access. Có thể tắt workers.dev sau khi custom domain hoạt động.

## 4. Trello

1. Dùng tài khoản công ty có quyền đọc các bảng cần quản lý. Lấy API key và token **read-only** qua quy trình chính thức của Trello.
2. Lưu secrets bằng lệnh, nhập ở terminal khi được hỏi:

```sh
npx wrangler secret put TRELLO_API_KEY
npx wrangler secret put TRELLO_TOKEN
```

3. Trong dashboard, thêm nhân sự với email và Trello Member ID. Thêm dự án và Board ID đầy đủ 24 ký tự nếu có. Mỗi bảng chỉ gắn một dự án.
4. Mở **Kết nối & cài đặt → Tải danh sách bảng**, ánh xạ tất cả cột đang chứa công việc sang trạng thái dashboard. Cột hoàn thành phải là cột đã qua kiểm tra.
5. Lưu và **Đồng bộ ngay**. Mở từng dự án, bấm công việc để nhập trọng số, giờ dự kiến và phần trăm được xác nhận.

Khóa Trello chỉ dùng ở Worker, không đưa xuống trình duyệt. Nếu một cột chưa ánh xạ, đồng bộ sẽ báo lỗi rõ ràng. Lịch 15 phút được khai báo trong Wrangler; không phải tác vụ ChatGPT. Worker có khóa chống chạy đồng bộ chồng nhau.

## 5. Google Drive

Không cần API để dùng chức năng **Thêm hồ sơ từ Drive** và mở link. Muốn liệt kê nội dung thư mục ngay trong dashboard:

1. Tạo Google Cloud project của công ty, bật Google Drive API và cấu hình OAuth consent screen.
2. Tạo OAuth client. Dùng OAuth flow có `access_type=offline` để nhận refresh token của tài khoản công ty có quyền đọc thư mục. Scope tối thiểu cho chức năng này: `https://www.googleapis.com/auth/drive.metadata.readonly`.
3. Có thể dùng OAuth Playground chính thức với tùy chọn dùng OAuth credentials của bạn để lấy refresh token; hoàn thành consent bằng tài khoản được phép. Không commit hoặc gửi token qua chat.
4. Cấu hình:

```sh
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put GOOGLE_REFRESH_TOKEN
```

5. Nhập Folder ID trong từng dự án. Vào chi tiết dự án → Hồ sơ → **Đọc thư mục Drive**.

Chỉ liệt kê con trực tiếp của thư mục; không đệ quy toàn Drive. Tài khoản được dùng để cấp refresh token quyết định tập metadata có thể đọc; chỉ gắn thư mục phù hợp với dự án. Người mở link vẫn cần quyền riêng trên Drive. Google có thể giới hạn tuổi refresh token khi OAuth app đang ở Testing; cấu hình trạng thái consent thích hợp cho vận hành lâu dài theo chính sách Google.

## 6. Deploy từ GitHub Actions

Trong repo → Settings → Secrets and variables → Actions:

**Secrets**

| Tên                                                            | Nội dung                                                         |
| -------------------------------------------------------------- | ---------------------------------------------------------------- |
| CLOUDFLARE_API_TOKEN                                           | Token có quyền deploy Workers và quản lý D1 trong đúng tài khoản |
| CLOUDFLARE_ACCOUNT_ID                                          | Account ID của Cloudflare                                        |
| TRELLO_API_KEY / TRELLO_TOKEN                                  | Khóa tích hợp Trello                                             |
| GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN | OAuth Drive, nếu dùng liệt kê thư mục                            |

**Variables**

| Tên                   | Nội dung               |
| --------------------- | ---------------------- |
| D1_DATABASE_ID        | ID D1 đã tạo           |
| CF_ACCESS_TEAM_DOMAIN | Team domain của Access |
| CF_ACCESS_AUD         | Audience của Access    |
| ADMIN_EMAIL           | Email quản trị         |

Tạo environment `production` nếu cần quy tắc phê duyệt nội bộ. Chọn Actions → **Deploy to Cloudflare** → Run workflow → `demo` hoặc `live`. Workflow kiểm thử, chuẩn bị cấu hình, build, áp dụng migrations, đưa secrets vào Worker và deploy. Workflow `Check dashboard` tự chạy trên push/PR.

Không bật deploy tự động trên mọi push để tránh đổi môi trường live ngoài ý muốn. GitHub connection trong ChatGPT không tự cấp quyền truy cập Cloudflare; tài khoản Cloudflare cần được cấu hình riêng.

## 7. Kiểm tra sau khi triển khai live

- Admin đăng nhập và tạo dự án; tải lại trang vẫn thấy dữ liệu.
- Staff chỉ thấy dự án được giao, không có giá trị tài chính; tài khoản lạ nhận 403.
- Trello sync đúng danh sách; thử đổi một thẻ và đồng bộ lại.
- Nhập một giao dịch thử có chứng từ riêng, đối chiếu tiền đã thu và phần còn lại của đợt; không dùng số liệu giả trên hệ thống chính thức.
- Mở file Drive với một tài khoản đúng quyền; thử tài khoản không có quyền để kiểm tra phân quyền Drive.
- Xem trạng thái đồng bộ và Worker logs khi nguồn ngoài lỗi. Không đưa token hoặc nội dung tài liệu vào log.

## Bản xem thử qua ChatGPT

Mã nguồn có `.openai/hosting.json` dùng cho bản demo riêng tư được phát hành trong ChatGPT. Nó không cấu hình Cloudflare account của bạn. Deploy qua Wrangler/GitHub sử dụng `wrangler.jsonc` và hoàn toàn độc lập. Bản xem thử chưa kết nối tài khoản Trello hoặc Google thật.
