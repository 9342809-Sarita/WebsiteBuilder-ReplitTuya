import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

// GET /api/app-settings - Get current PF source setting
router.get("/app-settings", async (req, res) => {
  try {
    const settings = await prisma.appSettings.findFirst();
    const pfSource = settings?.pfSource || "calculated";
    
    res.json({ ok: true, pfSource });
  } catch (error) {
    console.error("[/api/app-settings] GET error:", error);
    res.status(500).json({ ok: false, error: "Failed to get settings" });
  }
});

// POST /api/app-settings - Update PF source setting
router.post("/app-settings", async (req, res) => {
  try {
    const { pfSource } = req.body;
    
    // Validate input
    if (!pfSource || !["tuya", "calculated"].includes(pfSource)) {
      return res.status(400).json({ 
        ok: false, 
        error: "pfSource must be 'tuya' or 'calculated'" 
      });
    }
    
    // Upsert the singleton row (id=1)
    await prisma.appSettings.upsert({
      where: { id: 1 },
      update: { pfSource },
      create: { id: 1, pfSource }
    });
    
    res.json({ ok: true, pfSource });
  } catch (error) {
    console.error("[/api/app-settings] POST error:", error);
    res.status(500).json({ ok: false, error: "Failed to update settings" });
  }
});

export default router;