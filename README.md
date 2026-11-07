# Công Trình — Dashboard quản trị tư vấn xây dựng

Dashboard tiếng Việt cho công ty tư vấn thiết kế xây dựng: dự án, tiến độ có trọng số, hợp đồng, nghiệm thu, tiền đã thu, công nợ theo đợt, tải nhân sự và danh mục hồ sơ Google Drive.

**Hai chế độ tách biệt:**

- `demo`: dữ liệu giả lập, dùng ngay không cần tài khoản dịch vụ. Các thay đổi lưu trong localStorage của trình duyệt; không phải dữ liệu công ty, không đồng bộ giữa thiết bị. Có nút khôi phục demo.
- `live`: dữ liệu thật trong Cloudflare D1. API yêu cầu phiên đăng nhập email/mật khẩu hợp lệ và thành viên đã được quản trị thêm. Có thể dùng Cloudflare Access khi đặt AUTH_MODE=access. Không tự quay về dữ liệu mẫu khi API thật bị lỗi.

## Công nghệ

React 19 + TypeScript + Vite; Cloudflare Worker ES module; Cloudflare D1; đăng nhập email/mật khẩu; Trello REST API; Google Drive API. Build đóng gói cả frontend vào Worker, một lần deploy, không cần máy chủ Node.js riêng. Không dùng dịch vụ AI trả phí khi vận hành dashboard.

## Chạy thử

Yêu cầu Node.js 24 LTS và npm.

```sh
npm ci
npm run dev
```

Vite dev luôn chạy dữ liệu demo. Để kiểm tra Worker đầy đủ:

```sh
npm test
npm run build
npm run db:local
npm run preview
```

`npm run preview` chạy Wrangler với `APP_MODE=demo` mặc định. Không đặt secrets thật vào Vite/client.

## Chức năng đã triển khai

- Tổng quan: giá trị hợp đồng, tiền thực nhận, dự án hoạt động, cảnh báo, biểu đồ dòng tiền 6 tháng, sức khỏe danh mục.
- Dự án: tạo/sửa, tìm kiếm, lọc trạng thái, xuất CSV, chi tiết công việc/tài liệu/thanh toán.
- Công việc: đồng bộ một chiều từ Trello; quản trị/chủ nhiệm xác nhận trọng số, phần trăm hoàn thành, giờ dự kiến, người phụ trách và vướng mắc.
- Tài chính: cập nhật giá trị nghiệm thu trong dự án; tạo đợt thanh toán; ghi nhận khoản thu; phân bổ vào đợt để tính còn lại; xuất CSV.
- Nhân sự: thêm thành viên và quyền; số việc mở, khối lượng giờ, tỷ lệ đúng hạn khi có đủ lịch sử, việc quá hạn.
- Hồ sơ: thêm link Drive với nhóm/phiên bản/trạng thái; mở file gốc; quản trị/chủ nhiệm liệt kê trực tiếp thư mục Drive của dự án, có phân trang.
- Kết nối: ánh xạ cột Trello; đồng bộ thủ công và lịch 15 phút trên Cloudflare riêng; hiển thị lỗi và thời gian đồng bộ.
- Nhật ký thay đổi trong bảng `audit_log` cho dự án, nhân sự, giao dịch, đợt thanh toán, hồ sơ và metadata công việc.

## Phân quyền

| Vai trò | Phạm vi                                                  | Quyền ghi                                            |
| ------- | -------------------------------------------------------- | ---------------------------------------------------- |
| admin   | Toàn bộ                                                  | Dự án, nhân sự, tài chính, hồ sơ, công việc, kết nối |
| manager | Dự án do mình phụ trách, bao gồm tài chính của dự án     | Metadata công việc và hồ sơ trong dự án              |
| finance | Tất cả dự án, tài chính và danh mục hồ sơ                | Khoản thu và đợt thanh toán                          |
| staff   | Dự án có công việc được giao; không có số liệu tài chính | Hồ sơ kỹ thuật trong dự án                           |

Danh sách nhân sự chỉ trả email/Trello ID cho admin. Staff không nhận tài liệu được phân nhóm Hợp đồng/Nghiệm thu/Thanh toán từ danh mục; nội dung tài liệu cần được phân loại đúng. Quyền mở file thực tế do Drive quyết định. Chức năng liệt kê thư mục bằng tài khoản dịch vụ chỉ cho admin và chủ nhiệm của chính dự án đó.

## Công thức và giới hạn dữ liệu

- Tiến độ = `Σ(trọng số × phần trăm hoàn thành được xác nhận) / Σ(trọng số)`. Công việc mới nhập có trọng số 0 và sẽ được cảnh báo; chủ nhiệm cần cấu hình.
- Cột Trello ánh xạ `done` được xem là đã kiểm tra, tiến độ 100%. Chỉ ánh xạ cột đã có quy trình kiểm tra nội bộ.
- Kế hoạch trong chi tiết dự án là tham chiếu tuyến tính từ ngày bắt đầu đến ngày kết thúc, không phải baseline khối lượng được duyệt.
- Tỷ lệ đúng hạn chỉ tính thẻ đã hoàn thành có cả hạn và ngày hoàn thành. Lần nhập đầu tiên không suy diễn ngày hoàn thành từ ngày đồng bộ. Chuyển trạng thái sau đó được ghi nhận vào ngày hệ thống quan sát được, độ trễ tối đa bằng chu kỳ đồng bộ.
- Giờ công đang mở là tổng dự kiến của các việc chưa hoàn thành, không phải chấm công hay số giờ làm trong tuần. Chưa có chi phí nhân công thực tế, lợi nhuận, bảng lương hoặc thang điểm KPI tự động.
- Giá trị hợp đồng, giá trị nghiệm thu, tiền đã thu và khoản đến hạn chưa thu là bốn chỉ số riêng. Các giá trị nên nhập cùng một cơ sở thuế (ví dụ đều gồm VAT) theo quy ước công ty.
- Khoản đến hạn chưa thu tính từ từng đợt có `due < hôm nay`, không lấy hợp đồng trừ tiền nhận. Nhập số phải thu đã điều chỉnh tạm ứng/thu hồi/giữ lại. Giao dịch chưa phân bổ chỉ tăng tiền đã thu, không giảm đợt cụ thể.
- Chưa có tính năng sửa/xóa giao dịch tiền; sai sót cần quản trị xử lý có kiểm soát trong D1 và lưu chứng từ. Không dùng thay phần mềm kế toán.
- Hồ sơ gốc vẫn nằm ở Drive. Dashboard quản lý link và phiên bản khai báo, không tự tải CAD/PDF lên Drive, không ký số hay thay thế phê duyệt pháp lý.
- Thẻ đã lưu trữ vẫn được giữ để bảo toàn lịch sử. Thẻ đã hoàn thành tiếp tục tính vào tiến độ; thẻ chưa hoàn thành đã lưu trữ được loại khỏi khối lượng đang mở.
- Đồng bộ Trello theo polling 15 phút, chưa dùng webhook; không ghi thay đổi vào Trello.

## Triển khai lên Cloudflare

Xem hướng dẫn đầy đủ tại [docs/DEPLOY.md](docs/DEPLOY.md). Đăng nhập trực tiếp dùng `AUTH_MODE=password`, khởi tạo admin bằng secret `ADMIN_SETUP_TOKEN` và email `ADMIN_EMAIL`; xem mục 3 của hướng dẫn deploy. Repo đã có workflow kiểm thử và workflow **Deploy to Cloudflare** chạy thủ công.

Không commit `.dev.vars`, `.env`, token Trello, token Google hay Cloudflare API token. `.dev.vars.example` chỉ ghi tên biến. `wrangler.jsonc` đang dùng ID D1 minh họa, cần thay bằng ID thật.

## Cấu trúc mã nguồn

```text
src/                  Giao diện, form, biểu đồ và client API
shared/               Kiểu dữ liệu, công thức, dữ liệu demo
worker/               API, xác thực, phân quyền, tích hợp
migrations/           Schema D1 và ràng buộc thanh toán
tests/                Kiểm thử công thức, validation, API, RBAC, SQL
scripts/              Build Worker và triển khai Cloudflare
.github/workflows/    CI và deployment thủ công
docs/DEPLOY.md        Hướng dẫn kết nối và triển khai
```

## Kiểm tra

```sh
npm test
npm run build
```

Kiểm thử dùng SQLite trong bộ nhớ tương thích các câu SQL hiện tại; các cuộc gọi Trello/Google/Cloudflare Access bên ngoài được giả lập khi cần. Cần kiểm tra lại kết nối bằng tài khoản thật sau khi cấu hình. Không tự sửa migrations đã áp dụng; thêm migration mới.

## Nhân sự & báo cáo ngày

- Lọc theo ngày (giờ Việt Nam), phòng ban, team, nhân sự; xem thẻ tổng quan hoặc bảng công việc có trạng thái bằng màu và chữ, xuất CSV theo bộ lọc.
- Admin có thể sửa hồ sơ nhân sự, phân phòng/team và Trello Member ID. Chủ nhiệm chỉ xem công việc trong dự án phụ trách; nhân viên/kế toán xem báo cáo của bản thân.
- Nhân viên ghi báo cáo cho task được giao: giờ thực tế tự báo cáo, tiến độ tự báo cáo, kết quả, kế hoạch và vướng mắc. Một bản ghi/ngày/task/người; gửi lại để sửa. Tổng giờ/người/ngày không vượt 24. Tiến độ tự báo cáo không tự sửa tiến độ được chủ nhiệm xác nhận.
- Chỉ số hoàn thành/đúng hạn trong ngày dựa trên ngày hoàn thành quan sát được. Thiếu lịch sử hiển thị “—”; không có điểm KPI suy diễn. Tổng giờ dự kiến đang mở không phải tải công việc trong một tuần.
- Migration `0005_personnel.sql` thêm lịch sử ngày và báo cáo. Cron hiện có lưu trạng thái task mỗi 15 phút, kể cả khi chưa cấu hình Trello; mỗi ngày giữ lần lưu cuối, không phải nhật ký mọi thay đổi. Không dựng lịch sử cho ngày trước khi triển khai. Báo cáo lịch sử được lọc theo phân nhóm nhân sự hiện tại.
