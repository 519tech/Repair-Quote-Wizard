import type { Express } from "express";
import bcrypt from "bcrypt";
import { storage } from "../storage";
import { requireAdmin } from "../middleware";
import { sendTestEmail } from "../gmail";
import { sendTestSms } from "../sms";

const loginAttempts = new Map<string, { count: number; firstAttempt: number }>();
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export function registerAdminRoutes(app: Express) {
  app.post("/api/admin/login", async (req, res) => {
    try {
      const ip = req.ip || req.socket.remoteAddress || "unknown";
      const now = Date.now();
      const record = loginAttempts.get(ip);

      if (record) {
        if (now - record.firstAttempt > LOGIN_WINDOW_MS) {
          loginAttempts.delete(ip);
        } else if (record.count >= LOGIN_MAX_ATTEMPTS) {
          return res.status(429).json({ error: "Too many login attempts. Please try again later." });
        }
      }

      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
      }

      const user = await storage.getUserByUsername(username);
      if (!user) {
        const entry = loginAttempts.get(ip);
        if (entry) { entry.count++; } else { loginAttempts.set(ip, { count: 1, firstAttempt: now }); }
        return res.status(401).json({ error: "Invalid username or password" });
      }

      const validPassword = await bcrypt.compare(password, user.passwordHash);
      if (!validPassword) {
        const entry = loginAttempts.get(ip);
        if (entry) { entry.count++; } else { loginAttempts.set(ip, { count: 1, firstAttempt: now }); }
        return res.status(401).json({ error: "Invalid username or password" });
      }

      loginAttempts.delete(ip);
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.isAdmin = true;

      res.json({ success: true, username: user.username });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/admin/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      res.json({ success: true });
    });
  });

  app.get("/api/admin/me", (req, res) => {
    res.json({
      isAdmin: req.session?.isAdmin === true,
      username: req.session?.username || null,
    });
  });

  app.post("/api/admin/test-email", requireAdmin, async (req, res) => {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: "Email is required" });
    }

    try {
      const success = await sendTestEmail(email);
      if (success) {
        res.json({ success: true, message: `Test email sent to ${email}` });
      } else {
        res.status(500).json({ error: "Failed to send test email" });
      }
    } catch (error: any) {
      console.error('Test email error:', error);
      res.status(500).json({ error: error.message || "Failed to send test email" });
    }
  });

  app.post("/api/admin/test-sms", requireAdmin, async (req, res) => {
    const { phone } = req.body;
    if (!phone || typeof phone !== 'string') {
      return res.status(400).json({ error: "Phone number is required" });
    }

    try {
      const success = await sendTestSms(phone);
      if (success) {
        res.json({ success: true, message: `Test SMS sent to ${phone}` });
      } else {
        res.status(500).json({ error: "Failed to send test SMS" });
      }
    } catch (error: any) {
      console.error('Test SMS error:', error);
      res.status(500).json({ error: error.message || "Failed to send test SMS" });
    }
  });
}
