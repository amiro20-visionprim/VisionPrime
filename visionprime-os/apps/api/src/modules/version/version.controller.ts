import { Router } from "express";
import { sendSuccess } from "../../common/response";

export const versionRouter = Router();

const API_NAME = "@visionprime/api";
const API_VERSION = "0.1.0";

versionRouter.get("/version", (_req, res) => {
  sendSuccess(res, {
    name: API_NAME,
    version: API_VERSION,
    phase: "phase-01-foundation",
  });
});
