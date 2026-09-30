# Murder City — GitHub Pages Answer Checker

Đây là website tĩnh hoàn chỉnh cho **Murder City — 7,000 Buildings. One Hidden Killer.** Không dùng framework/CDN nên có thể upload thẳng lên GitHub Pages.

## Những gì bản này đã làm sẵn

- Form kiểm tra **District + Avenue + Street**.
- Đáp án đúng được xác thực bằng **SHA-256 hash**, không ghi thẳng địa chỉ đáp án trong source code.
- Phần giải thích đáp án được **mã hóa AES-GCM** và chỉ giải mã khi người đọc nhập đúng vị trí.
- Sai: hiện `NOT HERE` và không tiết lộ đáp án.
- Đúng: hiệu ứng police breach + confetti + `CASE CLOSED`, sau đó hiện lý giải chi tiết từng nhóm clue.
- Legend roulette chạy nhanh rồi chậm dần và khóa vào hình của ô vừa search.
- 35 ảnh legend được chuẩn hóa bằng CSS `object-fit: contain`, nên file PNG vuông có kích thước pixel khác nhau vẫn hiển thị đồng đều.
- Có Sound On/Off, mặc định Off.
- Responsive cho desktop/mobile.

## Quan trọng: Excel + 35 PNG thật chưa có trong lần upload hiện tại

Trong dữ liệu tôi nhận được hiện tại chỉ có cover và PDF solution. Vì vậy folder này đang có 35 **placeholder PNG** (`legend-01.png` → `legend-35.png`) và `data/cell-legends.js` đang ở `demo-fallback`.

Điều đó có nghĩa:

- **Đúng/sai của đáp án cuối là chính xác.**
- Nhưng icon roulette của từng ô chưa thể đúng 100% theo bản đồ cho tới khi import Excel thật.

Khi có Excel + 35 PNG, chỉ cần làm hai bước dưới đây.

## 1. Thay 35 ảnh legend thật

Đưa ảnh vào:

`assets/legends/`

với tên:

`legend-01.png` ... `legend-35.png`

Không cần resize. Website tự căn giữa và scale đồng đều.

## 2. Import Excel để roulette dừng đúng icon của từng ô

Excel cần có 4 thông tin cho mỗi cell:

- District
- Avenue
- Street
- Legend / Image ID

Tên cột phổ biến được script tự nhận diện. Ví dụ:

`District | Avenue | Street | Legend`

Cài dependency:

```bash
pip install -r tools/requirements.txt
```

Chạy:

```bash
python tools/import_excel.py your-city-map.xlsx
```

Sau khi thành công, file `data/cell-legends.js` sẽ chuyển sang `mode: "exact"` và chứa mapping chính xác cho toàn thành phố.

Nếu layout Excel của bạn khác hẳn kiểu bảng trên, gửi file Excel cho tôi; tôi sẽ sửa importer theo đúng cấu trúc file, không cần bạn tự đổi Excel.

## Upload lên GitHub Pages

1. Tạo repository mới.
2. Upload **toàn bộ nội dung trong folder này** vào root repository.
3. GitHub → `Settings` → `Pages`.
4. `Build and deployment` → `Deploy from a branch`.
5. Chọn branch `main`, folder `/ (root)` → Save.
6. Đợi GitHub tạo URL Pages.

## Test local

Không nên double-click `index.html` vì Web Crypto cần HTTPS/localhost.

Trong folder project chạy:

```bash
python -m http.server 8000
```

Sau đó mở `http://localhost:8000`.

## Cấu trúc

```text
index.html
styles.css
app.js
.nojekyll
assets/
  cover.png
  legends/
    legend-01.png ... legend-35.png
data/
  case-config.js
  cell-legends.js
tools/
  import_excel.py
  requirements.txt
```

## Ghi chú chống spoiler

Vì GitHub Pages là website tĩnh, không thể có “secret” tuyệt đối như backend/server. Bản này tránh việc để đáp án ở dạng plaintext: đáp án dùng hash và phần giải thích được mã hóa. Người đọc bình thường xem source sẽ không thấy thẳng final address. Một người có kỹ năng kỹ thuật vẫn có thể brute-force không gian địa chỉ nếu cố tình, vì toàn bộ verification cuối cùng vẫn chạy phía client.
