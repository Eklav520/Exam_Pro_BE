// Loaded before every test file, so a local .env cannot change the results or
// point the tests at a real database.
process.env.NODE_ENV = "test";
process.env.CORS_ORIGINS = "http://localhost:5173";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017";
process.env.MONGODB_DB_NAME = "exam_pro_test";
process.env.TRUST_PROXY_HOPS = "0";
process.env.JWT_SECRET = "test-secret-that-is-at-least-32-characters";
process.env.JWT_EXPIRES_IN_HOURS = "12";
