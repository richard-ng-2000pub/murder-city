# Murder City — GitHub Pages Answer Checker v2

Bản này đã được **điều chỉnh theo đúng cấu trúc trong `CityElimination7000_v2_QC_Audit(2).xlsx`** thay vì dùng mapping demo như bản trước.

## Những gì đã khớp với file QC

- **7,000 cells** = **100 districts × 7 avenues (A–G) × 10 streets (1–10)**.
- **4,883 apartment candidates**.
- **2,117 non-apartment / landmark cells**.
- **18 clues**.
- **32 legend types** trong workbook: 1 loại Apartment Building + 31 landmark types.
- **35 artwork files**: 4 apartment-art variants + 31 landmark artworks.
- Final survivor được giữ kín trong source ở dạng encrypted cell payload; website chỉ mở phần solution khi người đọc nhập đúng địa chỉ.
- Với một **apartment sai**, website hiển thị đúng **first eliminating clue + reason** từ sheet `Candidate Reasons`.
- Với đáp án đúng, website hiển thị final deduction, evidence groups và **18-clue proof** từ sheet `Solution Proof`.

## Điều chỉnh quan trọng so với bản cũ

Bản cũ cho phép District/Avenue/Street gần như không giới hạn và dùng icon demo cho mọi ô. Bản v2 khóa đúng quy hoạch:

- District: **1–100**
- Avenue / Column: **A–G**
- Street / Row: **1–10**

Animation cũng được sửa để **chạy qua đủ cả 35 artwork ít nhất một vòng**, sau đó chậm dần rồi khóa vào artwork của ô được kiểm tra.

## Về 35 PNG

Trong conversation hiện tại chưa có 35 PNG thật, vì vậy project vẫn chứa 35 ảnh placeholder được đánh số.

Thay trực tiếp các file trong:

`assets/legends/`

Theo thứ tự trong:

`tools/legend_file_order.csv`

Quy ước hiện tại:

- `legend-01.png` → Apartment Variant 1
- `legend-02.png` → Apartment Variant 2
- `legend-03.png` → Apartment Variant 3
- `legend-04.png` → Apartment Variant 4
- `legend-05.png` → Pharmacy
- ...
- `legend-35.png` → Bus Station

Không cần resize PNG. CSS dùng `object-fit: contain`, vì vậy ảnh vuông kích thước pixel khác nhau vẫn hiển thị đồng đều.

## Một giới hạn của chính file QC Audit

Workbook QC **không chứa cell-by-cell legend identity cho 2,117 landmark cells**. Nó có:

- toàn bộ 4,883 apartment coordinates + art variant;
- tổng số từng landmark;
- district flow;
- clue audit;
- solution proof;

nhưng không có bảng cho biết, ví dụ, `District 12 / Avenue F / Street 7 = Pharmacy` hay `Museum`.

Do đó bản này **không bịa icon** cho landmark cell. Nếu người đọc nhập một ô non-apartment:

1. roulette vẫn chạy qua đủ 35 artwork;
2. website kết luận chính xác rằng đó là **LANDMARK CELL / NOT AN APARTMENT CANDIDATE**;
3. sau đó dừng ở thẻ non-apartment đặc biệt.

Đối với **mọi apartment cell**, artwork variant là chính xác theo workbook.

### Muốn 2,117 landmark cells cũng dừng đúng artwork

File `tools/non_apartment_cells_template.csv` đã liệt kê sẵn toàn bộ 2,117 ô non-apartment.

Chỉ cần điền:
- `legend_key`
- `image_id` (5–35)

rồi chạy:

```bash
python tools/build_landmark_map.py tools/non_apartment_cells_template.csv
```

Script sẽ tạo `data/landmark-map.js`. Khi đủ 2,117 dòng, website tự chuyển sang exact landmark mode mà **không phải sửa `app.js`**.

## Chống spoiler

Bản v2 không còn một `answerHash` đơn lẻ dễ brute-force như bản đầu.

Mỗi apartment cell có một encrypted result pack kích thước đồng đều. Chỉ khi người đọc nhập location thì browser mới dùng chính location đó để giải mã result của cell tương ứng. Detailed final solution nằm trong một encrypted payload riêng.

Đây vẫn là GitHub Pages/static site, nên một người rất kỹ thuật có thể tự viết script thử toàn bộ không gian 7,000 ô. Static client-side không thể có secret tuyệt đối như backend. Nhưng việc View Source thông thường không làm lộ final address ở plaintext.

## Upload GitHub Pages

Upload toàn bộ nội dung của folder project vào root repository:

```text
index.html
styles.css
app.js
.nojekyll
assets/
data/
tools/
README.md
```

GitHub → **Settings → Pages → Deploy from a branch → main → /(root)**.

## Test local

Không double-click `index.html`, vì Web Crypto cần HTTPS hoặc localhost.

```bash
python -m http.server 8000
```

Sau đó mở:

`http://localhost:8000`

## Các file data chính

- `data/case-config.js` — city dimensions, district names, public stats.
- `data/legend-manifest.js` — mapping 35 artwork files.
- `data/cell-packs.js` — 4,883 encrypted apartment-cell result packs + exact art variants.
- `data/case-secret.js` — encrypted detailed final solution.
- `data/landmark-map.js` — mapping landmark-cell artwork; đang trống vì workbook QC không cung cấp cell-level landmark identity.

