import { Request, Response } from "express";

export function handleHealthCheck(_req: Request, res: Response): void {
  res.status(200).json({ status: "ok" });
}
