import { Request, Response } from "express";
import { deleteKronToken, setKronToken } from "../db";

export function setToken(req: Request, res: Response) {
  const token = req.body;
  
  if (!token.refresh_token || !token.access_token) {
    res.status(400).json({ error: "Token is required" });
    return;
  }
  deleteKronToken();
  setKronToken(token.refresh_token, token.access_token);
  res.status(200).json({ message: "Token set successfully" });
}