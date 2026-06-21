import express, { Express } from "express";
import cors from "cors";
import { Logger } from "@visionprime/logger";
import { requestContextMiddleware } from "./common/request-context";
import { createErrorFilter, notFoundHandler } from "./common/error-filter";
import { healthRouter } from "./modules/health/health.controller";
import { versionRouter } from "./modules/version/version.controller";

/**
 * Builds the Express app without starting it listening — kept separate
 * from main.ts so tests can import and exercise the app directly.
 */
export function createApp(logger: Logger): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(requestContextMiddleware);

  app.use("/api", healthRouter);
  app.use("/api", versionRouter);

  app.use(notFoundHandler);
  app.use(createErrorFilter(logger));

  return app;
}
