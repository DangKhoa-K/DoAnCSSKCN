import express from 'express';
import registerHydrationRoutes from './routes/hydration.js';
// import các route khác...

const app = express();

// BẮT BUỘC: parse JSON cho application/json
app.use(express.json());

// Đăng ký routes
registerHydrationRoutes(app);

// Xuất app
export default app;