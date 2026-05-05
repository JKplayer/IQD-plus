import express, { Request, Response, NextFunction } from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { initializeApp as initializeClientApp } from 'firebase/app';
import { getAuth as getClientAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore as getClientFirestore, collection as clientColl, query as clientQuery, where as clientWhere, getDocs as clientGetDocs, doc as clientDoc, setDoc as clientSetDoc, writeBatch as clientWriteBatch, getDoc as clientGetDoc, increment as clientIncrement, limit as clientLimit } from 'firebase/firestore';
import helmet from "helmet";
import cors from "cors";
import { rateLimit } from "express-rate-limit";
import fs from "fs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
let firebaseConfig: any = {};
try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    console.log("Firebase config loaded. DB ID:", firebaseConfig.firestoreDatabaseId);
  }
} catch (error) {
  console.error("Failed to read firebase config:", error);
}

// Global initialization
if (!admin.apps.length) {
  try {
    const projectId = firebaseConfig.projectId;
    if (projectId) {
      // In some environments, this helps the Admin SDK find the right project
      process.env.FIREBASE_CONFIG = JSON.stringify({
        projectId: firebaseConfig.projectId,
        databaseId: firebaseConfig.firestoreDatabaseId
      });
      
      admin.initializeApp();
      console.log("Firebase Admin initialized for project:", projectId);
    } else {
      admin.initializeApp();
      console.log("Firebase Admin initialized with default credentials");
    }
  } catch (error: any) {
    console.error("Firebase Admin initialization error:", error);
  }
}

// Ensure db is a function or getter so it doesn't fail if init was delayed
// Removed getDb as we use client SDK now

let clientDb: any;
let clientAuth: any;
try {
  const clientAppObj = initializeClientApp(firebaseConfig);
  clientAuth = getClientAuth(clientAppObj);
  clientDb = getClientFirestore(clientAppObj, firebaseConfig.firestoreDatabaseId);
} catch (error) {
  console.error("Client SDK init error:", error);
}

async function ensureSystemUser() {
  if (!clientAuth) return;
  try {
    await signInWithEmailAndPassword(clientAuth, 'system@iqdplus.com', 'IQD_PAYOUT_SECRET_2026');
    console.log("System user signed in successfully.");
  } catch (err: any) {
    if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
      try {
        await createUserWithEmailAndPassword(clientAuth, 'system@iqdplus.com', 'IQD_PAYOUT_SECRET_2026');
        console.log("System user created and signed in.");
      } catch (createErr) {
        console.error("Could not create system user:", createErr);
      }
    } else {
      console.error("System user sign in error:", err);
    }
  }
}
ensureSystemUser();


const app = express();
const PORT = 3000;

// Essential for Rate Limiting behind the Nginx proxy
app.set('trust proxy', 1);

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disabled for Vite development
}));
app.use(cors());
app.use(express.json());

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  message: { error: "Too many requests, please try again later." }
});
app.use("/api/", limiter);

// --- Authentication Middleware ---
const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }

  const idToken = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);
    (req as any).user = decodedToken;
    next();
  } catch (error) {
    console.error("Token verification failed:", error);
    res.status(401).json({ error: "Unauthorized: Invalid token" });
  }
};

// --- Authorization Middleware ---
const authorizeAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  // In this app, admins are defined by email in the code or a collection
  // For the server level, we'll check the trusted email list
  const ADMIN_EMAILS = ["wreawali27@gmail.com", "sadakamal951@gmail.com"];
  
  if (ADMIN_EMAILS.includes(user.email)) {
    next();
  } else {
    res.status(403).json({ error: "Forbidden: Admin access required" });
  }
};

async function startServer() {
  // --- API Routes ---
  
  // Investment Packages (Sensitive: Only for authenticated users)
  const PACKAGES = [
    { id: "pkg_1", name: "Bronze I", priceIQD: 10000, monthlyReturn: 0.02, description: "Entry level passive income" },
    { id: "pkg_2", name: "Bronze II", priceIQD: 25000, monthlyReturn: 0.02, description: "Sustainable growth" },
    { id: "pkg_3", name: "Silver I", priceIQD: 50000, monthlyReturn: 0.02, description: "Steady returns" },
    { id: "pkg_4", name: "Silver II", priceIQD: 100000, monthlyReturn: 0.02, description: "Professional tier" },
    { id: "pkg_5", name: "Gold I", priceIQD: 200000, monthlyReturn: 0.02, description: "Wealth builder" },
    { id: "pkg_6", name: "Gold II", priceIQD: 500000, monthlyReturn: 0.02, description: "Premium investment" },
    { id: "pkg_7", name: "Platinum I", priceIQD: 1000000, monthlyReturn: 0.02, description: "Elite portfolio" },
    { id: "pkg_8", name: "Platinum II", priceIQD: 2500000, monthlyReturn: 0.02, description: "Institutional grade" },
    { id: "pkg_9", name: "Diamond", priceIQD: 10000000, monthlyReturn: 0.02, description: "Legacy wealth" },
    { id: "pkg_10", name: "Founder", priceIQD: 100000000, monthlyReturn: 0.02, description: "Sovereign tier" },
  ];

  app.get("/api/packages", authenticate, (req, res) => {
    res.json(PACKAGES);
  });

  // Currency conversion (Reference)
  app.get("/api/currency/convert", (req, res) => {
    const { amount, from, to } = req.query;
    const IQD_RATE = 1310;
    
    let result = 0;
    const val = parseFloat(amount as string);
    if (isNaN(val)) return res.status(400).json({ error: "Invalid amount" });
    
    if (from === "USD" && to === "IQD") result = val * IQD_RATE;
    else if (from === "IQD" && to === "USD") result = val / IQD_RATE;
    else return res.status(400).json({ error: "Invalid conversion parameters" });
    
    res.json({ amount: val, from, to, result, rate: IQD_RATE });
  });

  // Health check
  app.get("/api/health", async (req, res) => {
    let clientStatus = "untested";
    let clientError = null;

    try {
      if (clientDb) {
        await clientGetDocs(clientQuery(clientColl(clientDb, 'health_check'), clientLimit(1)));
        clientStatus = "connected";
      } else {
        throw new Error("Client DB not initialized");
      }
    } catch (error: any) {
      clientStatus = "failed";
      clientError = error.message;
    }

    res.json({ 
      status: clientStatus === "connected" ? "ok" : "error", 
      firestore_client: clientStatus,
      client_error: clientError,
      time: new Date().toISOString(),
      dbId: firebaseConfig.firestoreDatabaseId,
      projectId: firebaseConfig.projectId
    });
  });

  // Example Admin Protected Route
  app.get("/api/admin/stats", authenticate, authorizeAdmin, (req, res) => {
    res.json({ message: "Welcome to the secure admin territory." });
  });

  // Admin: Delete User account (Auth + Firestore)
  app.delete("/api/admin/users/:uid", authenticate, authorizeAdmin, async (req, res) => {
    const { uid } = req.params;
    try {
      await getAuth().deleteUser(uid);
      res.json({ success: true, message: `User ${uid} successfully purged.` });
    } catch (error: any) {
      console.error("User deletion failed:", error);
      
      // Detect and handle the "Identity Toolkit API Disabled" error specifically
      if (error.code === 'auth/internal-error' && error.message.includes('identitytoolkit.googleapis.com')) {
        return res.status(403).json({ 
          error: "API_DISABLED", 
          message: "The Identity Toolkit API is disabled. Please enable it here: https://console.developers.google.com/apis/api/identitytoolkit.googleapis.com/overview?project=258012273293" 
        });
      }

      res.status(500).json({ error: error.message || "Failed to delete user" });
    }
  });

  // --- API 404 Handler ---
  // Ensure that /api/ routes never fall back to index.html (SPA fallback)
  app.use("/api/*", (req, res) => {
    res.status(404).json({ error: "API endpoint not found" });
  });

  // --- Global Error Handler ---
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error("Unhandle Server Error:", err);
    res.status(err.status || 500).json({
      error: err.name || "Internal Server Error",
      message: err.message || "An unexpected error occurred"
    });
  });

  // --- Vite / Static Handling ---
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // If the server is running from the root, use 'dist'. 
    // If it's already in 'dist' (bundled), use current directory.
    const distPath = __dirname.endsWith('dist') ? __dirname : path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`IQD+ Server: http://localhost:${PORT}`);
    
    // Start automated payout sentinel (runs every 30 minutes)
    // Using a slight delay to ensure everything is initialized
    setTimeout(() => {
      // Primary Yield Engine: Payouts go to profitBalance
      setInterval(processAutomatedPayouts, 30 * 60 * 1000);
      processAutomatedPayouts().catch(err => console.error("Initial Payout Task Failed:", err));

      // Settlement Sentinel: Transfers profitBalance to total balance at 23:59
      setInterval(processMidnightSettlement, 60 * 1000); // Check every minute for precision
      processMidnightSettlement().catch(err => console.error("Initial Settlement Task Failed:", err));
    }, 5000);
  });
}

async function processMidnightSettlement() {
  const now = new Date();
  
  // Requirement: Every day at 23:59 (We run logic between 23:59:00 and 23:59:59)
  if (now.getHours() !== 23 || now.getMinutes() !== 59) {
    return;
  }

  const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
  
  try {
    const markerRef = clientDoc(clientDb, 'global', 'payouts');
    const markerSnap = await clientGetDoc(markerRef);
    if (markerSnap.exists() && markerSnap.data()?.lastSettlementDate === todayStr) {
      // Already settled today
      return;
    }

    console.log(`--- [23:59 SETTLEMENT] Moving Earned Money to Total Balance for ${todayStr} ---`);
    
    // 1. Mark as started to prevent double execution
    await clientSetDoc(markerRef, { lastSettlementDate: todayStr }, { merge: true });

    // 2. Fetch all users with accrued profit
    const usersSnap = await clientGetDocs(clientQuery(clientColl(clientDb, 'users'), clientWhere('profitBalance', '>', 0)));
    
    if (usersSnap.empty) {
      console.log("[Settlement] No profits to settle today.");
      return;
    }

    console.log(`[Settlement] Found ${usersSnap.size} users with pending profits.`);

    const SYSTEM_TOKEN = 'IQD_PAYOUT_SECRET_2026';
    let count = 0;

    for (const uDoc of usersSnap.docs) {
      const uData = uDoc.data();
      const amount = uData.profitBalance;
      
      const batch = clientWriteBatch(clientDb);
      const userRef = clientDoc(clientDb, 'users', uDoc.id);
      const transRef = clientDoc(clientColl(clientDb, 'transactions'));
      
      // Move profit to balance
      batch.update(userRef, {
        balance: clientIncrement(amount),
        profitBalance: 0,
        system_token: SYSTEM_TOKEN
      });

      // Log settlement transaction
      batch.set(transRef, {
        userId: uDoc.id,
        type: 'payout',
        amountIQD: amount,
        description: 'Daily Earnings Settlement (23:59 Protocol)',
        timestamp: now.toISOString(),
        status: 'completed',
        system_token: SYSTEM_TOKEN
      });

      // Send notification
      const notifRef = clientDoc(clientColl(clientDb, 'notifications'));
      batch.set(notifRef, {
        userId: uDoc.id,
        title: 'Daily Earnings Settled!',
        message: `Your accrued profit of ${amount.toLocaleString()} IQD from today's cycles has been transferred to your total balance.`,
        type: 'payout',
        read: false,
        timestamp: now.toISOString(),
        system_token: SYSTEM_TOKEN
      });

      await batch.commit();
      count++;
    }

    console.log(`--- [23:59 SETTLEMENT] Successful: ${count} users processed ---`);
  } catch (error) {
    console.error("Critical Failure in Midnight Settlement:", error);
  }
}

async function processAutomatedPayouts() {
  console.log("--- Executing Daily Automated Payout Protocol (Client SDK with auth) ---");
  
  try {
    const invSnap = await clientGetDocs(clientQuery(clientColl(clientDb, 'investments'), clientWhere('status', '==', 'active')));

    console.log(`[Payout Sentinel] Found ${invSnap.size} active investments.`);

    if (invSnap.empty) {
      console.log("No active investments found for payout.");
      return;
    }

    const now = new Date();
    let count = 0;

    for (const d of invSnap.docs) {
      const inv = d.data();
      const lastPayoutStr = inv.lastDailyPayoutAt || inv.purchaseDate;
      const lastPayout = new Date(lastPayoutStr);
      
      const timeDiff = now.getTime() - lastPayout.getTime();
      const hoursDiff = timeDiff / (1000 * 3600);

      if (hoursDiff >= 24) {
        const daysToPay = Math.floor(hoursDiff / 24);
        const dailyRate = (inv.amountIQD * 0.02) / 30;
        const totalPayout = Math.floor(dailyRate * daysToPay);

        if (totalPayout <= 0) continue;

        console.log(`Processing payout for User ${inv.userId}: ${totalPayout} IQD for ${daysToPay} days.`);

        const SYSTEM_TOKEN = 'IQD_PAYOUT_SECRET_2026';

        const batch = clientWriteBatch(clientDb);
        const userRef = clientDoc(clientDb, 'users', inv.userId);
        const invRef = clientDoc(clientDb, 'investments', d.id);

        batch.update(userRef, {
          profitBalance: clientIncrement(totalPayout),
          system_token: SYSTEM_TOKEN
        });

        batch.update(invRef, {
          lastDailyPayoutAt: now.toISOString(),
          system_token: SYSTEM_TOKEN
        });

        await batch.commit();
        count++;
      }
    }
    console.log(`--- Automated Payout Protocol Completed: ${count} yield events accumulated ---`);
  } catch (error) {
    console.error("Critical Failure in Automated Payout Protocol (Client SDK):", error);
  }
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
