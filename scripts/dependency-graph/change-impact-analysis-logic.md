# Change-Impact Analysis Logic

## 1. Core Concept
Mục tiêu của quy trình này là xây dựng một **Change-Impact Graph** chính xác dựa trên **Code Changes** thực tế, thay vì chỉ dựa trên dependency tĩnh của file. Điều này giúp phát hiện các "Hidden Impacts" - những file bị ảnh hưởng bởi thay đổi nhưng không nằm trong danh sách file của Pull Request (PR).

## 2. Step-by-Step Process

### Step 1: Identify Initial Nodes (PR Files)
*   **Input**: Danh sách các file có trong PR (Changed Files).
*   **Action**: Tạo các node ban đầu cho Graph tương ứng với các file này.
*   **Ví dụ**: PR có 10 file => Graph khởi tạo có 10 node.

### Step 2: Extract Code Changes (The "What")
*   **Input**: Nội dung thay đổi (diff) của từng file trong PR.
*   **Action**: Xác định chính xác các thành phần code đã thay đổi hoặc được thêm mới.
    *   *Added/Modified Exports*: Tên hàm, tên biến, class, interface.
    *   *Added Keys*: Các key mới trong object (ví dụ: key trong file resource/config).
    *   *Logic Changes*: Thay đổi trong body hàm (ảnh hưởng đến behavior).

### Step 3: Scan Workspace for Usages (The "Where")
*   **Input**: Các thành phần code thay đổi từ Step 2.
*   **Action**: Scan toàn bộ workspace để tìm tất cả các file đang sử dụng (reference) các thành phần thay đổi đó.
*   **Lưu ý**:
    *   Bỏ qua các file trung gian (như `index.ts` barrel files) trừ khi chúng chứa logic thay đổi.
    *   Tìm đến "Consumer" cuối cùng thực sự sử dụng code.

### Step 4: Construct & Expand Graph
Với mỗi file tìm được ở Step 3 (Consumer File):
*   **Case A: File đã có trong PR**
    *   **Action**: Tạo một liên kết (Edge) từ file thay đổi sang file consumer này.
    *   **Result**: Không tăng số lượng node. Graph thể hiện mối quan hệ nội bộ trong PR.
*   **Case B: File KHÔNG có trong PR (Hidden Impact)**
    *   **Action**: Thêm file này vào Graph như một node mới.
    *   **Result**: Graph mở rộng (ví dụ: từ 10 lên 11 node). Đây là các file có nguy cơ bị lỗi (regression) cần được kiểm tra.

## 3. Example Scenario (Based on Discussion)

**Context**:
*   **PR Files**: `message-resources.ts`, `maintain-equipment-list.component.ts`, ... (Tổng 10 file).
*   **Change**: Thêm key `limitedEquipment` và `removeEquipmentFromTab` vào `message-resources.ts`.

**Analysis**:
1.  **Scan Usage**: Tìm thấy 2 file sử dụng các key mới này:
    *   `maintain-equipment-list.component.ts`
    *   `maintain-equipment-paging.component.ts`
2.  **Graph Construction**:
    *   `maintain-equipment-list.component.ts`: Đã có trong PR -> **Nối dây**.
    *   `maintain-equipment-paging.component.ts`: **Chưa có trong PR** -> **Tạo Node Mới (Node 11)**.

**Kết luận**: PR này có impact đến `maintain-equipment-paging.component.ts` nhưng developer có thể đã quên include hoặc test file này.


📄 File: constants.ts
🔤 Changed Symbols:
  - SYMBOL_NAME
    📁 Used by:
      - file1.ts
      - file2.ts