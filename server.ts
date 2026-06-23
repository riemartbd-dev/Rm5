/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import compression from "compression";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, getDoc, getDocs, collection, setDoc, deleteDoc } from "firebase/firestore";
import fs from "fs";

const firebaseConfig = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf8")
);

const DB_PATH = path.join(process.cwd(), "db.json");

// Robust JSON file reading / writing
function readDb() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, "utf8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error("Error reading db.json, returning empty database:", err);
  }
  return {};
}

function writeDb(data: any) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error("Error writing db.json database:", err);
  }
}

// Initialize Firestore on Backend using Firebase Web SDK
let db: any = null;
try {
  let app;
  const apps = getApps();
  if (apps.length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }
  db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  console.log("Firebase Firestore Web SDK initialized on backend successfully!");

  // Dynamic search and self-correction hook for Bigen product price (correcting 78000tk to 650tk)
  (async () => {
    try {
      console.log("RIEMART Self-correction: Scanning Firestore products for price issues (e.g. 78000tk)...");
      const q = await getDocs(collection(db, "products"));
      let correctedCount = 0;
      for (const d of q.docs) {
        const item = d.data();
        const str = JSON.stringify(item).toLowerCase();
        const isBigen = str.includes("bigen") || str.includes("begin") || String(item.id).toLowerCase().includes("bigen") || String(item.id).toLowerCase().includes("begin");
        const hasWrongPrice = item.price === 78000 || item.regularPrice === 78000 || item.price === 780000 || item.price === "78000" || item.regularPrice === "78000";
        
        if (isBigen && (hasWrongPrice || item.price > 10000)) {
          console.log(`[RIEMART FIXED] Self-correcting Firestore product ID: "${d.id}"`);
          console.log(`Original Name: "${item.nameEn}"`);
          console.log(`Original Price: ${item.price} -> Setting to 650`);
          
          const updatedItem = {
            ...item,
            price: 650,
            regularPrice: 750
          };
          await setDoc(doc(db, "products", d.id), updatedItem);
          correctedCount++;
        }
      }
      console.log(`RIEMART Self-correction scan complete. Restored metadata integrity for ${correctedCount} product(s).`);
      
      console.log("RIEMART Warm Boot: Priming and pre-warming in-memory Firestore cache...");
      await getFirestoreDbState();
      console.log("RIEMART Warm Boot: Pre-warmed initial cache ready.");
    } catch (err: any) {
      console.error("RIEMART Self-correction/preload error:", err.message || err);
    }
  })();
} catch (e) {
  console.error("Failed to initialize Firebase Firestore Web SDK, falling back to db.json local storage:", e);
}

// In-memory caching for ultra-fast, sub-second responses on the Admin panel
let cachedState: any = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 10000; // Cache database query for 10s to bypass heavy Firestore bills & roundtrip latencies

// Bulletproof Firestore daily read units quota exhaustion tracking & automated cooldown failover
let isFirestoreQuotaExceeded = false;
let lastQuotaCheckTime = 0;
const QUOTA_COOLDOWN_MS = 5 * 60 * 1000; // 5-minute cooldown before retrying cloud database connections

function checkQuotaError(err: any) {
  const msg = String(err?.message || err || "").toLowerCase();
  if (
    msg.includes("quota limit exceeded") ||
    msg.includes("quota exceeded") ||
    msg.includes("resource_exhausted") ||
    msg.includes("quota metrics") ||
    msg.includes("limit 'free daily read units") ||
    msg.includes("daily read units") ||
    msg.includes("quota checks")
  ) {
    if (!isFirestoreQuotaExceeded) {
      console.warn("[RIEMART Server Coherence] Quota Limit Exceeded detected! Entering local-only database failover mode.");
      isFirestoreQuotaExceeded = true;
      lastQuotaCheckTime = Date.now();
    }
  }
}

// Compile full db state from Firestore or fall back to db.json
async function getFirestoreDbState() {
  if (!db) {
    return readDb();
  }
  
  const now = Date.now();
  
  // Under quota exhaustion, leverage the local-only database bypass to stop failing calls and protect app performance
  if (isFirestoreQuotaExceeded) {
    if (now - lastQuotaCheckTime < QUOTA_COOLDOWN_MS) {
      return cachedState || readDb();
    } else {
      isFirestoreQuotaExceeded = false; // Cooldown elapsed, attempt live Firestore query once
    }
  }
  
  if (cachedState && (now - lastCacheTime < CACHE_TTL_MS)) {
    return cachedState;
  }
  
  try {
    let products: any[] = [];
    let orders: any[] = [];
    let logs: any[] = [];
    let registeredUsers: any[] = [];
    let subscriptions: any[] = [];
    let customerNotifications: any[] = [];
    let userOrders: any[] = [];
    let settings: any = null;
    let hasErrors = false;

    // Use parallel Promise.all to fetch all collections concurrently (major performance boost!)
    const queries = [
      getDocs(collection(db, "products"))
        .then(q => { products = q.docs.map(d => d.data()); })
        .catch(e => { console.error("FAIL: products query failed:", e.message || e); hasErrors = true; checkQuotaError(e); }),
      getDocs(collection(db, "orders"))
        .then(q => { orders = q.docs.map(d => d.data()); })
        .catch(e => { console.error("FAIL: orders query failed:", e.message || e); hasErrors = true; checkQuotaError(e); }),
      getDocs(collection(db, "logs"))
        .then(q => { logs = q.docs.map(d => d.data()); })
        .catch(e => { console.error("FAIL: logs query failed:", e.message || e); hasErrors = true; checkQuotaError(e); }),
      getDocs(collection(db, "registeredUsers"))
        .then(q => { registeredUsers = q.docs.map(d => d.data()); })
        .catch(e => { console.error("FAIL: registeredUsers query failed:", e.message || e); hasErrors = true; checkQuotaError(e); }),
      getDocs(collection(db, "subscriptions"))
        .then(q => { subscriptions = q.docs.map(d => d.data()); })
        .catch(e => { console.error("FAIL: subscriptions query failed:", e.message || e); hasErrors = true; checkQuotaError(e); }),
      getDocs(collection(db, "customerNotifications"))
        .then(q => { customerNotifications = q.docs.map(d => d.data()); })
        .catch(e => { console.error("FAIL: customerNotifications query failed:", e.message || e); hasErrors = true; checkQuotaError(e); }),
      getDocs(collection(db, "userOrders"))
        .then(q => { userOrders = q.docs.map(d => d.data()); })
        .catch(e => { console.error("FAIL: userOrders query failed:", e.message || e); hasErrors = true; checkQuotaError(e); }),
      getDoc(doc(db, "settings", "store"))
        .then(docSnap => { settings = docSnap.exists() ? docSnap.data() : null; })
        .catch(e => { console.error("FAIL: settings doc query failed:", e.message || e); hasErrors = true; checkQuotaError(e); })
    ];

    await Promise.all(queries);

    if (hasErrors) {
      console.warn("[RIEMART Server Coherence] One or more Firestore collection reads failed. Failing over to previous disk state/cache to protect catalog lists from deletions.");
      return cachedState || readDb();
    }

    // Automated runtime migration: if Firestore collections are completely empty, seed them from local db.json
    const isNewDb = !hasErrors && products.length === 0 && orders.length === 0 && (!settings);
    if (isNewDb) {
      console.log("Firestore empty! Migrating local db.json data to Cloud Firestore...");
      const fileDb = readDb();
      if (fileDb.products && Array.isArray(fileDb.products)) {
        for (const p of fileDb.products) {
          if (p && p.id) await setDoc(doc(db, "products", p.id), p);
        }
      }
      if (fileDb.orders && Array.isArray(fileDb.orders)) {
        for (const o of fileDb.orders) {
          if (o && o.id) await setDoc(doc(db, "orders", o.id), o);
        }
      }
      if (fileDb.logs && Array.isArray(fileDb.logs)) {
        for (const l of fileDb.logs) {
          if (l && l.id) await setDoc(doc(db, "logs", l.id), l);
        }
      }
      if (fileDb.registeredUsers && Array.isArray(fileDb.registeredUsers)) {
        for (const u of fileDb.registeredUsers) {
          if (u && u.phone) await setDoc(doc(db, "registeredUsers", u.phone), u);
        }
      }
      if (fileDb.subscriptions && Array.isArray(fileDb.subscriptions)) {
        for (const s of fileDb.subscriptions) {
          if (s && s.id) await setDoc(doc(db, "subscriptions", s.id), s);
        }
      }
      if (fileDb.customerNotifications && Array.isArray(fileDb.customerNotifications)) {
        for (const n of fileDb.customerNotifications) {
          if (n && n.id) await setDoc(doc(db, "customerNotifications", n.id), n);
        }
      }
      if (fileDb.userOrders && Array.isArray(fileDb.userOrders)) {
        for (const uo of fileDb.userOrders) {
          if (uo && uo.id) await setDoc(doc(db, "userOrders", uo.id), uo);
        }
      }
      if (fileDb.settings) {
        await setDoc(doc(db, "settings", "store"), fileDb.settings);
      }
      cachedState = fileDb;
      lastCacheTime = Date.now();
      return fileDb;
    }

    // Stable-sort lists consistently to prevent JSON comparison discrepancies or flickering on client loads
    products.sort((a: any, b: any) => String(a.id || "").localeCompare(String(b.id || "")));
    orders.sort((a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
    logs.sort((a: any, b: any) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
    registeredUsers.sort((a: any, b: any) => String(a.phone || "").localeCompare(String(b.phone || "")));
    subscriptions.sort((a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
    customerNotifications.sort((a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
    userOrders.sort((a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

    const state = {
      products,
      orders,
      logs,
      registeredUsers,
      subscriptions,
      customerNotifications,
      userOrders,
      settings: settings || readDb().settings // fallback settings if doc doesn't exist
    };

    // Save a backup copy locally
    writeDb(state);
    
    // Update in-memory cache
    cachedState = state;
    lastCacheTime = Date.now();
    return state;
  } catch (err) {
    console.error("Error reading from Firestore Web SDK, falling back to db.json:", err);
    return readDb();
  }
}

let saveQueue: Promise<any> = Promise.resolve();

async function saveFirestoreDbState(key: string, data: any): Promise<any> {
  return new Promise((resolve, reject) => {
    saveQueue = saveQueue
      .then(async () => {
        try {
          const result = await saveFirestoreDbStateInternal(key, data);
          resolve(result);
        } catch (err) {
          reject(err);
        }
      })
      .catch((err) => {
        // Ensure queue is always recovered even if a job encounters a fatal error
        console.error("[Firestore Sync Queue] Error caught in chain:", err);
        reject(err);
      });
  });
}

async function saveFirestoreDbStateInternal(key: string, data: any) {
  let previousData: any[] = [];
  try {
    const fileDb = readDb();
    previousData = Array.isArray(fileDb[key]) ? fileDb[key] : [];
    
    // Back up new data state locally to db.json instantly
    fileDb[key] = data;
    fileDb[key + "_updatedVal"] = Date.now();
    writeDb(fileDb);

    // Warm update the in-memory state so any immediate sync check returns the saved data instantly without Firestore fetch wait
    if (cachedState) {
      cachedState[key] = data;
      lastCacheTime = Date.now();
    } else {
      cachedState = fileDb;
      lastCacheTime = Date.now();
    }
  } catch (e) {
    console.error("Local db.json write failed:", e);
  }

  if (!db) return { success: true, key };

  if (isFirestoreQuotaExceeded) {
    console.log(`[RIEMART Server Coherence] Under local failover mode, bypassing direct Firestore write for key [${key}] to conserve resources.`);
    return { success: true, key };
  }

  // Run Firestore operations and AWAIT them to ensure serverless Cloud Run environment does not freeze the threads mid-transit
  try {
    if (key === "settings") {
      await setDoc(doc(db, "settings", "store"), data);
    } else if (Array.isArray(data)) {
      const idKey = key === "registeredUsers" ? "phone" : "id";

      // Reconstruct incoming elements Set
      const incomingIds = new Set(
        data
          .filter((item: any) => item && item[idKey])
          .map((item: any) => String(item[idKey]))
      );

      // Identify items that were recently deleted in local state
      const deletedIds = previousData
        .filter((item: any) => item && item[idKey] && !incomingIds.has(String(item[idKey])))
        .map((item: any) => String(item[idKey]));

      // 1. Delete items that were removed (STRICT RETENTION POLICY: we do NOT hard-delete products automatically via sync discrepancy)
      let deletePromises: any[] = [];
      if (key !== "products") {
        deletePromises = deletedIds.map(id => deleteDoc(doc(db, key, id)));
      } else {
        if (deletedIds.length > 0) {
          console.log(`[Firestore Sync Protection] Skipping automatic hard deletion of ${deletedIds.length} products to preserve items strictly.`, deletedIds);
          // Instead, since these products were temporarily or permanently missing in incoming data set, we retain them in Firestore.
          // This prevents any loss/deletion due to frontend initialization/race glitches.
        }
      }

      // 2. Identify incoming items that are actually new or have changed to avoid writing unchanged records
      const previousMap = new Map(
        previousData
          .filter((item: any) => item && item[idKey])
          .map((item: any) => [String(item[idKey]), item])
      );

      const changedOrNewItems = data.filter((item: any) => {
        if (!item || !item[idKey]) return false;
        const id = String(item[idKey]);
        const prev = previousMap.get(id);
        if (!prev) return true; // Brand new item
        // Simple stringified comparison to check for modifications
        return JSON.stringify(item) !== JSON.stringify(prev);
      });

      const writePromises = changedOrNewItems.map((item: any) =>
        setDoc(doc(db, key, String(item[idKey])), item)
      );

      // Save changes in parallel and await completion
      await Promise.all([...deletePromises, ...writePromises]);
      console.log(`[Firestore Sync] Successfully synchronized key [${key}]. Wrote ${writePromises.length} updates, processed ${deletePromises.length} deletions.`);
    }
  } catch (err: any) {
    console.error(`[Firestore Sync Error] Sync failed for key [${key}]:`, err.message || err);
    checkQuotaError(err);
    throw err; // throw so the API handler can catch and respond with 500
  }

  return { success: true, key };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Enable fast, lightweight Gzip compression for static files and API responses
  app.use(compression());

  // Add robust CORS headers to allow smooth, uninterrupted asset loading in WebViews/WhatsApp
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use(express.json({ limit: "150mb" })); // Increased limit of upload_max_filesize equivalent in Node to 150mb for larger bulk image payloads
  app.use(express.urlencoded({ limit: "150mb", extended: true })); // Handle large URL encoded payloads as well

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // Synced state storage endpoints for multi-device cross-platform coherence
  app.get("/api/sync/get", async (req, res) => {
    try {
      const dbState = await getFirestoreDbState();
      res.json(dbState);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/sync/save", async (req, res) => {
    try {
      const { key, data } = req.body;
      if (!key) {
        res.status(400).json({ error: "Missing key parameter" });
        return;
      }
      const response = await saveFirestoreDbState(key, data);
      res.json(response);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/settings/update", async (req, res) => {
    try {
      const dbState = await getFirestoreDbState();
      const currentSettings = dbState.settings || {};
      const updatedSettings = {
        ...currentSettings,
        ...req.body,
      };

      // Ensure compatibility between multiple_buy_discount and buyMoreSaveMoreEnabled
      if (req.body.multiple_buy_discount !== undefined) {
        updatedSettings.buyMoreSaveMoreEnabled = req.body.multiple_buy_discount;
        updatedSettings.multiple_buy_discount = req.body.multiple_buy_discount;
      }
      if (req.body.buyMoreSaveMoreEnabled !== undefined) {
        updatedSettings.multiple_buy_discount = req.body.buyMoreSaveMoreEnabled;
      }

      await saveFirestoreDbState("settings", updatedSettings);
      res.json({ success: true, settings: updatedSettings });
    } catch (err: any) {
      console.error("Failed to update settings:", err);
      res.status(500).json({ error: err.message || "Failed to update settings" });
    }
  });

  // Server-side lazy-initialized Gemini SDK proxy
  app.post("/api/gemini/generate", async (req, res) => {
    try {
      const { prompt, systemInstruction } = req.body;
      if (!prompt) {
        res.status(400).json({ error: "Missing prompt parameter" });
        return;
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        res.status(500).json({
          error: "GEMINI_API_KEY environment variable is not configured. Please add it in Settings > Secrets."
        });
        return;
      }

      // Lazy initialization of the SDK
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: systemInstruction || "You are a professional retail and e-commerce copywriter. Generate clean, highly engaging descriptions, translations, or product text in a luxurious studio tone.",
        },
      });

      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Gemini proxy error:", error);
      res.status(500).json({ error: error.message || "An error occurred with the Gemini API call." });
    }
  });

  // Server-side lazy-initialized Gemini SDK image proxy
  app.post("/api/gemini/generate-image", async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt) {
        res.status(400).json({ error: "Missing prompt parameter" });
        return;
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        res.status(500).json({
          error: "GEMINI_API_KEY environment variable is not configured. Please add it in Settings > Secrets."
        });
        return;
      }

      // Lazy initialization of the SDK
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      // Try gemini-2.5-flash-image first (fast, standard, and highly compatible)
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: {
            parts: [{ text: prompt }],
          },
          config: {
            imageConfig: {
              aspectRatio: "1:1",
            },
          },
        });

        let imageUrl = "";
        if (response.candidates?.[0]?.content?.parts) {
          for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
              const base64EncodeString = part.inlineData.data;
              const mime = part.inlineData.mimeType || "image/png";
              imageUrl = `data:${mime};base64,${base64EncodeString}`;
              break;
            }
          }
        }

        if (imageUrl) {
          res.json({ imageUrl });
          return;
        }
      } catch (innerErr: any) {
        console.warn("First option gemini-2.5-flash-image failed, trying fallback...", innerErr);
      }

      // Try imagen-3.0-generate-002 as fallback
      try {
        const response = await ai.models.generateImages({
          model: "imagen-3.0-generate-002",
          prompt: prompt,
          config: {
            numberOfImages: 1,
            outputMimeType: "image/jpeg",
            aspectRatio: "1:1",
          },
        });

        if (response.generatedImages && response.generatedImages.length > 0) {
          const base64EncodeString = response.generatedImages[0].image.imageBytes;
          const imageUrl = `data:image/jpeg;base64,${base64EncodeString}`;
          res.json({ imageUrl });
          return;
        }
      } catch (innerErr2: any) {
        console.warn("Second option imagen-3.0 failed, trying next fallback...", innerErr2);
      }

      // Final attempt: imagen-4.0-generate-001
      const response = await ai.models.generateImages({
        model: "imagen-4.0-generate-001",
        prompt: prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: "image/jpeg",
          aspectRatio: "1:1",
        },
      });

      if (!response.generatedImages || response.generatedImages.length === 0) {
        res.status(500).json({ error: "No images were generated by the model" });
        return;
      }

      const base64EncodeString = response.generatedImages[0].image.imageBytes;
      const imageUrl = `data:image/jpeg;base64,${base64EncodeString}`;

      res.json({ imageUrl });
    } catch (error: any) {
      console.error("Gemini image generation proxy error:", error);
      res.status(500).json({ error: error.message || "An error occurred with image generation." });
    }
  });

  // Vite middleware for dev or direct serving for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    // Cache production bundle assets aggressively (1 year) to run immediately on low-end devices
    app.use(express.static(distPath, {
      maxAge: "30d",
      immutable: true,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(".html") || filePath.endsWith("index.html")) {
          // Do not cache the principal HTML document to guarantee updates
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        } else {
          // Cache JS, CSS, images, SVGs, and fonts heavily
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      }
    }));
    let cachedHtml: string | null = null;
    app.get("*", (req, res) => {
      // If the request is for an asset or has a file extension, return a clean 404 instead of serving index.html
      if (req.path.startsWith("/assets/") || req.path.includes(".")) {
        res.status(404).send("Asset Not Found");
        return;
      }
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      
      try {
        const indexPath = path.join(distPath, "index.html");
        if (!cachedHtml) {
          cachedHtml = fs.readFileSync(indexPath, "utf8");
        }
        
        // Find current hostname dynamically. Force protocol to HTTPS for metadata sharing
        // because WhatsApp, Facebook, and Instagram require HTTPS URLs for og:image previews.
        const host = req.get("host") || "riemartbd.com";
        const origin = `https://${host}`;
        
        // Replace riemartbd.com with dynamic origin so metadata images and URLs render perfectly in link previews
        const dynamicHtml = cachedHtml
          .replace(/https:\/\/riemartbd\.com\/riemart_logo\.jpg/g, `${origin}/riemart_logo.jpg`)
          .replace(/https:\/\/riemartbd\.com/g, origin);
          
        res.send(dynamicHtml);
      } catch (err) {
        console.error("Error sending index.html dynamically:", err);
        res.sendFile(path.join(distPath, "index.html"));
      }
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`RIEMART Server running at http://0.0.0.0:${PORT} in ${process.env.NODE_ENV || "development"} mode`);
  });

  // Optimize Server-side connection preservation limits (representing PHP's max_execution_time)
  // We establish a ten-minute (600,000ms) safety margin so highly-dense consecutive/parallel image data uploads and bulky payloads never timeout.
  server.timeout = 600000;
  server.headersTimeout = 605000;
  server.requestTimeout = 600000;
  server.keepAliveTimeout = 600000;
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
