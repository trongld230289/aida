module.exports = {
  // Patterns that indicate context is needed
  CONTEXT_REQUIRED: [
    /\b(this|current|above|below|here)\s+(code|function|class|method|file|line)/i,
    /explain\s+(this|the\s+code|what\s+this)/i,
    /what\s+(does|is)\s+this/i,
    /how\s+does\s+this\s+work/i,
    /(fix|refactor|optimize|improve|debug|test|document)\s+(this|it|the\s+code)?/i,
    /line\s+\d+/i,
    /lines?\s+\d+(-\d+)?/i,
    /(error|bug|issue|problem)\s+(here|in\s+this|on\s+line)/i,
    // Vietnamese patterns
    /\b(cái|đoạn|phần)\s+(này|code|mã|hàm|lớp)/i,
    /giải\s*thích\s+(cái\s+này|đoạn\s+này)/i,
    /sửa\s+(lỗi|bug)\s+(này|ở\s+đây)/i,
    /dòng\s+\d+/i,
    /kiểm\s*tra\s+(code|mã)\s+này/i,
    /tối\s*ưu\s+(cái|đoạn)\s+này/i,
    // Additional contextual patterns
    /review\s+(this|the\s+code)/i,
    /analyze\s+(this|the\s+code)/i,
    /comment\s+(this|the\s+code)/i,
    /trace\s+(this|the\s+bug)/i,
  ],

  // Patterns that DON'T need context
  NO_CONTEXT: [
    /^(hello|hi|hey|good\s+(morning|afternoon|evening))!?$/i,
    /^(thanks|thank\s+you|goodbye|bye)!?$/i,
    /^how\s+are\s+you\??$/i,
    /^what\s+can\s+you\s+do\??$/i,
    /^(what|how)\s+(is|to)\s+\w+\s+in\s+(general|theory)/i,
    /best\s+practices?\s+for/i,
    /how\s+to\s+(create|build|make)\s+\w+/i,
    /what\s+is\s+\w+\s*\??$/i,
    /explain\s+\w+\s+(concept|pattern|principle)/i,
    // Vietnamese greetings and general questions
    /^(xin\s+)?chào!?$/i,
    /^cảm\s+ơn!?$/i,
    /là\s+gì\s*\??$/i,
    /làm\s+sao\s+để\s+(tạo|xây\s+dựng)/i,
    /thực\s+hành\s+tốt/i,
    /khái\s+niệm\s+\w+/i,
    /lý\s+thuyết\s+\w+/i,
  ],

  // Context keywords
  CONTEXT_KEYWORDS: [
    'this', 'that', 'these', 'those',
    'here', 'there', 'above', 'below',
    'current', 'present', 'existing',
    'fix', 'debug', 'refactor', 'optimize',
    'review', 'analyze', 'trace', 'comment',
    // Vietnamese context keywords
    'này', 'đây', 'đó', 'kia', 'cái', 'đoạn',
    'hiện tại', 'sửa', 'tối ưu', 'kiểm tra',
    'phân tích', 'xem xét'
  ],

  // General keywords
  GENERAL_KEYWORDS: [
    'hello', 'hi', 'thanks', 'bye',
    'theory', 'concept', 'general',
    'best practice', 'convention',
    'tutorial', 'guide', 'how to',
    // Vietnamese general
    'chào', 'cảm ơn', 'lý thuyết', 'khái niệm',
    'chung', 'tổng quát', 'hướng dẫn'
  ]
};