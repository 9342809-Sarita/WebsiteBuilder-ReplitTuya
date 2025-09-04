import express from "express";
import cors from "cors";
import { proxyDevices, proxyLive, proxySummary, proxySeries } from "./proxy.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ ok: true, tz: "Asia/Kolkata" });
});

app.get("/api/devices", proxyDevices);
app.get("/api/live", proxyLive);
app.get("/api/summary", proxySummary);
app.get("/api/series", proxySeries);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server on :" + PORT));