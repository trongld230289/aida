const CONTEXT_REQUIRED: RegExp[] = [
    /\b(cái|đoạn|phần)\s+(này|code|mã|hàm|lớp)/i,
    /giải\s*thích\s+(cái\s+này|đoạn\s+này|function\s+này)/i,
    /sửa\s+(lỗi|bug)\s+(này|ở\s+đây)/i,
    /dòng\s+\d+/i,
    /kiểm\s*tra\s+(code|mã)\s+này/i,
    /tối\s*ưu\s+(cái|đoạn)\s+này/i,
    /phân\s*tích\s+(code|mã)\s+này/i,
    /xem\s*xét\s+(code|mã)\s+này/i,
    /debug\s+(cái|đoạn)\s+này/i,
    /refactor\s+(cái|đoạn)\s+này/i,
    /làm\s+gì\s+(ở\s+đây|dòng\s+này)/i,
    /tại\s+sao\s+.*\s+(lỗi|không\s+hoạt\s+động)/i,
    /có\s+vấn\s+đề\s+gì\s+(ở\s+đây|với\s+cái\s+này)/i,
    /cải\s+thiện\s+(cái|đoạn)\s+này/i,
    /comment\s+(cho\s+)?cái\s+này/i,
    /document\s+(cho\s+)?function\s+này/i,
];

const NO_CONTEXT: RegExp[] = [
    /^(xin\s+)?chào!?$/i,
    /^cảm\s+ơn!?$/i,
    /\w+\s+là\s+gì\s*\??$/i,
    /làm\s+sao\s+để\s+(tạo|xây\s+dựng)\s+\w+/i,
    /thực\s+hành\s+tốt\s+nhất\s+cho\s+\w+/i,
    /khái\s+niệm\s+\w+/i,
    /lý\s+thuyết\s+\w+/i,
    /sự\s+khác\s+biệt\s+giữa\s+\w+\s+và\s+\w+/i,
    /khi\s+nào\s+nên\s+dùng\s+\w+/i,
    /ưu\s+nhược\s+điểm\s+của\s+\w+/i,
    /hướng\s+dẫn\s+(về\s+)?\w+/i,
    /giới\s+thiệu\s+(về\s+)?\w+/i,
    /tutorial\s+(về\s+)?\w+/i,
];

export { CONTEXT_REQUIRED, NO_CONTEXT };
