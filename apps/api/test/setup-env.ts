// E2E tests run against a dedicated database — never the development one.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://carebridge:carebridge_dev@localhost:5434/carebridge_test?schema=public';
process.env.JWT_SECRET = 'test-secret-not-used-anywhere-else-0123456789';
// Tests never call the live AI API (the opt-in smoke test does that).
process.env.GEMINI_API_KEY = '';
process.env.AI_RETRY_BASE_MS = '10';
