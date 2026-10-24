import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";

import appRoutes from "./routes/app.routes.js";
import { errorMiddleware } from "./middlewares/error/error.middleware.js";
import { savePerformanceMiddleware } from "./utils/savePerformance.util.js";

const app = express();
app.use(savePerformanceMiddleware);

/**
 * Security
 */
app.use(helmet());
app.use(cookieParser());
app.use(
    cors({
        origin: "http://localhost:4200",
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true,
    }),
);

/**
 * Performance
 */
app.use(compression());

/**
 * Body parsing
 */
app.use(
    express.json({
        verify: (req: any, _res, buf) => {
            req.rawBody = buf;
        },
    }),
);
app.use(express.urlencoded({ extended: true }));

/**
 * Routes
 */
app.use("/api/v1", appRoutes);
app.use(errorMiddleware);

export default app;
