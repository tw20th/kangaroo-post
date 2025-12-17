// firebase/functions/src/http/workspaces.ts
import * as functions from "firebase-functions/v1";
import * as logger from "firebase-functions/logger";
import type { Response } from "express"; // Responseだけ express から
import { ZodError } from "zod";

import type {
  WorkspaceCreateInput,
  WorkspaceUpdateInput,
} from "../lib/workspaces.js";
import {
  getWorkspaceById,
  createWorkspace,
  updateWorkspace,
} from "../lib/workspaces.js";

import { requireUid, adminDb } from "../lib/admin.js";

const REGION = process.env.FUNCTIONS_REGION || "asia-northeast1";

type Handler = (
  req: functions.https.Request,
  res: Response
) => void | Promise<void>;

const withCors =
  (handler: Handler): Handler =>
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type,Authorization");

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    await handler(req, res);
  };

function sendValidationError(res: Response, err: ZodError) {
  res.status(400).json({
    error: "validation_error",
    issues: err.issues,
  });
}

function isOwner(workspace: { ownerUserId: string }, uid: string): boolean {
  return workspace.ownerUserId === uid;
}

/** GET /?id=workspaceId */
export const getWorkspace = functions.region(REGION).https.onRequest(
  withCors(async (req, res) => {
    if (req.method !== "GET") {
      res.status(405).send("GET only");
      return;
    }

    try {
      const uid = await requireUid(req);

      const id = req.query.id;
      if (!id || typeof id !== "string") {
        res.status(400).json({ error: "missing id" });
        return;
      }

      const workspace = await getWorkspaceById(id);
      if (!workspace) {
        res.status(404).json({ error: "not_found" });
        return;
      }

      if (!isOwner(workspace, uid)) {
        res.status(403).json({ error: "forbidden" });
        return;
      }

      res.status(200).json({ data: workspace });
    } catch (err) {
      logger.error("getWorkspace error", err);
      res.status(401).json({ error: "unauthorized" });
    }
  })
);

/** ✅ GET /me */
export const getMyWorkspace = functions.region(REGION).https.onRequest(
  withCors(async (req, res) => {
    if (req.method !== "GET") {
      res.status(405).send("GET only");
      return;
    }

    try {
      const uid = await requireUid(req);

      // index 作成を増やしたくないので orderBy しない（MVP優先）
      const snap = await adminDb
        .collection("workspaces")
        .where("ownerUserId", "==", uid)
        .limit(1)
        .get();

      if (snap.empty) {
        res.status(200).json({ data: null });
        return;
      }

      const doc = snap.docs[0];
      const data = doc.data() as Record<string, unknown>;

      // getWorkspaceById と同じ形に寄せる
      res.status(200).json({
        data: {
          id: doc.id,
          ...(data as object),
        },
      });
    } catch (err) {
      logger.error("getMyWorkspace error", err);
      res.status(401).json({ error: "unauthorized" });
    }
  })
);

/** POST / */
export const createWorkspaceHandler = functions.region(REGION).https.onRequest(
  withCors(async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("POST only");
      return;
    }

    try {
      const uid = await requireUid(req);

      const body = req.body as Omit<WorkspaceCreateInput, "ownerUserId">;
      if (!body) {
        res.status(400).json({ error: "missing body" });
        return;
      }

      const input: WorkspaceCreateInput = {
        ...body,
        ownerUserId: uid,
      };

      const workspace = await createWorkspace(input);
      res.status(201).json({ data: workspace });
    } catch (err) {
      logger.error("createWorkspace error", err);

      if (err instanceof ZodError) {
        sendValidationError(res, err);
        return;
      }

      const msg = err instanceof Error ? err.message : "";
      if (msg === "missing_authorization") {
        res.status(401).json({ error: "unauthorized" });
        return;
      }

      res.status(500).json({ error: "internal_error" });
    }
  })
);
/** PATCH /?id=workspaceId */
export const updateWorkspaceHandler = functions.region(REGION).https.onRequest(
  withCors(async (req, res) => {
    if (req.method !== "PATCH") {
      res.status(405).send("PATCH only");
      return;
    }

    try {
      const uid = await requireUid(req);

      const id = req.query.id;
      if (!id || typeof id !== "string") {
        res.status(400).json({ error: "missing id" });
        return;
      }

      // まず所有者チェック
      const current = await getWorkspaceById(id);
      if (!current) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      if (!isOwner(current, uid)) {
        res.status(403).json({ error: "forbidden" });
        return;
      }

      const body = (req.body ?? {}) as WorkspaceUpdateInput;
      const workspace = await updateWorkspace(id, body);

      res.status(200).json({ data: workspace });
    } catch (err) {
      logger.error("updateWorkspace error", err);

      if (err instanceof ZodError) {
        sendValidationError(res, err);
        return;
      }

      const msg = err instanceof Error ? err.message : "";
      if (msg === "missing_authorization") {
        res.status(401).json({ error: "unauthorized" });
        return;
      }

      if (err instanceof Error && err.message.includes("not found")) {
        res.status(404).json({ error: "not_found" });
        return;
      }

      res.status(500).json({ error: "internal_error" });
    }
  })
);
