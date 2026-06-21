import { Router } from "express";
import { sendSuccess } from "../../common/response";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  sendSuccess(res, { status: "ok", uptimeSeconds: Math.round(process.uptime()) });
});
