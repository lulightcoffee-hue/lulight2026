import express from "express";
import { google } from "googleapis";
import { JWT } from "google-auth-library";
import path from "path";
import { createServer as createViteServer } from "vite";
import bodyParser from "body-parser";
import cors from "cors";
import fs from "fs";

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

// Simple Auth (as requested)
const USERS = {
  lulight: { password: "2025", role: "staff" },
  admin: { password: "0902", role: "admin" },
};

// Config Management
const CONFIG_FILE = path.join(process.cwd(), "sheet-config.json");

function getConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
    }
  } catch (e) {
    console.error("Failed to read config file", e);
  }
  return {
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "",
    privateKey: process.env.GOOGLE_PRIVATE_KEY || "",
    spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID || "",
  };
}

function saveConfig(config: any) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// Google Sheets Setup
const getSheetsClient = () => {
  const config = getConfig();
  let privateKey = config.privateKey || "";
  
  // 1. If user accidentally pasted the entire JSON file content
  try {
    const parsed = JSON.parse(privateKey);
    if (parsed.private_key) {
      privateKey = parsed.private_key;
    }
  } catch (e) {
    // Not JSON, continue
  }

  // 2. Remove surrounding quotes if accidentally included
  if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.slice(1, -1);
  }
  if (privateKey.startsWith("'") && privateKey.endsWith("'")) {
    privateKey = privateKey.slice(1, -1);
  }

  // 3. Replace escaped newlines with actual newlines
  privateKey = privateKey.replace(/\\n/g, "\n");

  const auth = new JWT({
    email: config.email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
};

// API Routes
app.get("/api/config/status", (req, res) => {
  const config = getConfig();
  const isConfigured = Boolean(config.email && config.privateKey && config.spreadsheetId);
  res.json({ isConfigured });
});

app.get("/api/config", (req, res) => {
  const config = getConfig();
  res.json({
    email: config.email,
    spreadsheetId: config.spreadsheetId,
    hasPrivateKey: !!config.privateKey
  });
});

app.post("/api/config", (req, res) => {
  const { email, privateKey, spreadsheetId } = req.body;
  const currentConfig = getConfig();
  const newConfig = {
    email: email !== undefined ? email : currentConfig.email,
    privateKey: privateKey ? privateKey : currentConfig.privateKey, // Only update if provided
    spreadsheetId: spreadsheetId !== undefined ? spreadsheetId : currentConfig.spreadsheetId
  };
  saveConfig(newConfig);
  res.json({ success: true });
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const user = USERS[username as keyof typeof USERS];
  if (user && user.password === password) {
    res.json({ success: true, role: user.role, username });
  } else {
    res.status(401).json({ success: false, message: "帳號或密碼錯誤" });
  }
});

// Get current sheet name (e.g., "0304月")
const getCurrentSheetName = () => {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
  const month = now.getMonth() + 1;
  const startMonth = month % 2 === 0 ? month - 1 : month;
  const endMonth = startMonth + 1;
  return `${startMonth.toString().padStart(2, "0")}${endMonth.toString().padStart(2, "0")}月`;
};

app.get("/api/sheets/current", async (req, res) => {
  const config = getConfig();
  if (!config.spreadsheetId) return res.status(500).json({ error: "未設定 Google Spreadsheet ID" });
  res.json({ sheetName: getCurrentSheetName() });
});

app.get("/api/sheets", async (req, res) => {
  const config = getConfig();
  if (!config.spreadsheetId) return res.status(500).json({ error: "未設定 Google Spreadsheet ID" });
  const SPREADSHEET_ID = config.spreadsheetId;

  try {
    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });
    const sheetNames = response.data.sheets?.map(s => s.properties?.title).filter(Boolean) || [];
    res.json(sheetNames);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/sheets/create", async (req, res) => {
  const { sheetName } = req.body;
  const config = getConfig();
  if (!config.spreadsheetId) return res.status(500).json({ error: "未設定 Google Spreadsheet ID" });
  const SPREADSHEET_ID = config.spreadsheetId;

  try {
    const sheets = getSheetsClient();
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: { title: sheetName },
            },
          },
        ],
      },
    });

    // Add headers
    const headers = [
      "日期", "發票號碼", "廠商名稱", "項目分類", "品項", "單價", "數量", "小計", "備註"
    ];
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1:I1`,
      valueInputOption: "RAW",
      requestBody: { values: [headers] },
    });

    res.json({ success: true });
  } catch (error: any) {
    if (error.errors?.[0]?.message?.includes("already exists")) {
      return res.json({ success: true, message: "工作表已存在" });
    }
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/data/add", async (req, res) => {
  const { sheetName, data } = req.body;
  if (!sheetName || !data) return res.status(400).json({ error: "缺少必要參數" });
  
  const config = getConfig();
  if (!config.spreadsheetId) return res.status(500).json({ error: "未設定 Google Spreadsheet ID" });
  const SPREADSHEET_ID = config.spreadsheetId;

  try {
    const sheets = getSheetsClient();
    
    // Check if sheet exists, if not, create it
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const sheetExists = spreadsheet.data.sheets?.some(s => s.properties?.title === sheetName);
    
    if (!sheetExists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [{
            addSheet: {
              properties: { title: sheetName }
            }
          }]
        }
      });
      // Add headers
      const headers = [
        "日期", "發票號碼", "廠商名稱", "項目分類", "品項", "單價", "數量", "小計", "備註", "ID"
      ];
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A1:J1`,
        valueInputOption: "RAW",
        requestBody: { values: [headers] },
      });
    }

    const id = Date.now().toString();
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:J`,
      valueInputOption: "RAW",
      requestBody: {
        values: [
          [
            data.date,
            data.invoiceNumber,
            data.vendorName,
            data.category,
            data.itemName,
            data.unitPrice,
            data.quantity,
            data.total,
            data.remarks,
            id
          ],
        ],
      },
    });
    res.json({ success: true });
  } catch (error: any) {
    console.error("Add Error:", error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data?.error?.message || error.message });
  }
});

app.get("/api/data/list", async (req, res) => {
  const { sheetName } = req.query;
  if (!sheetName) return res.status(400).json({ error: "缺少工作表名稱" });
  
  const config = getConfig();
  if (!config.spreadsheetId) return res.status(500).json({ error: "未設定 Google Spreadsheet ID" });
  const SPREADSHEET_ID = config.spreadsheetId;

  try {
    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A2:J`,
    });
    const rows = response.data.values || [];
    const formattedRows = rows.map((row, index) => ({
      id: row[9] || (index + 2).toString(), // Use stored ID or fallback to row number
      rowNumber: index + 2, // Keep track of actual row number for updates
      date: row[0] || "",
      invoiceNumber: row[1] || "",
      vendorName: row[2] || "",
      category: row[3] || "",
      itemName: row[4] || "",
      unitPrice: row[5] || "",
      quantity: row[6] || "",
      total: row[7] || "",
      remarks: row[8] || "",
    }));

    // Sort by date descending (newest to oldest)
    formattedRows.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (!isNaN(dateA) && !isNaN(dateB) && dateA !== dateB) {
        return dateB - dateA;
      }
      return b.rowNumber - a.rowNumber;
    });

    res.json(formattedRows);
  } catch (error: any) {
    console.error("List Error:", error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data?.error?.message || error.message });
  }
});

app.post("/api/data/update", async (req, res) => {
  const { sheetName, rowId, data } = req.body;
  if (!sheetName || !rowId || !data) return res.status(400).json({ error: "缺少必要參數" });
  
  const config = getConfig();
  if (!config.spreadsheetId) return res.status(500).json({ error: "未設定 Google Spreadsheet ID" });
  const SPREADSHEET_ID = config.spreadsheetId;

  try {
    const sheets = getSheetsClient();
    
    // First, find the row by ID
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A2:J`,
    });
    const rows = response.data.values || [];
    const rowIndex = rows.findIndex((row, index) => {
      const storedId = row[9] ? String(row[9]).trim() : undefined;
      const fallbackId = String(index + 2);
      const targetId = String(rowId).trim();
      return (storedId && storedId === targetId) || fallbackId === targetId;
    });
    
    if (rowIndex === -1) {
      return res.status(404).json({ error: "找不到該筆資料" });
    }
    
    const actualRowNumber = rowIndex + 2;

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A${actualRowNumber}:J${actualRowNumber}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [
          [
            data.date,
            data.invoiceNumber,
            data.vendorName,
            data.category,
            data.itemName,
            data.unitPrice,
            data.quantity,
            data.total,
            data.remarks,
            rowId // Keep the same ID
          ],
        ],
      },
    });
    res.json({ success: true });
  } catch (error: any) {
    console.error("Update Error:", error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data?.error?.message || error.message });
  }
});

app.post("/api/data/delete", async (req, res) => {
  const { sheetName, rowId } = req.body;
  if (!sheetName || !rowId) return res.status(400).json({ error: "缺少必要參數" });
  
  const config = getConfig();
  if (!config.spreadsheetId) return res.status(500).json({ error: "未設定 Google Spreadsheet ID" });
  const SPREADSHEET_ID = config.spreadsheetId;

  try {
    const sheets = getSheetsClient();
    
    // 1. Get sheet ID
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const sheet = spreadsheet.data.sheets?.find(s => s.properties?.title === sheetName);
    const sheetId = sheet?.properties?.sheetId;
    if (sheetId === undefined) throw new Error("找不到工作表或工作表 ID");

    // 2. Find the row index by ID
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A2:J`,
    });
    const rows = response.data.values || [];
    const rowIndex = rows.findIndex((row, index) => {
      const storedId = row[9] ? String(row[9]).trim() : undefined;
      const fallbackId = String(index + 2);
      const targetId = String(rowId).trim();
      return (storedId && storedId === targetId) || fallbackId === targetId;
    });
    
    if (rowIndex === -1) {
      return res.status(404).json({ error: "找不到該筆資料" });
    }
    
    const actualRowNumber = rowIndex + 2;

    // 3. Delete the row
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheetId,
                dimension: "ROWS",
                startIndex: actualRowNumber - 1,
                endIndex: actualRowNumber,
              },
            },
          },
        ],
      },
    });
    res.json({ success: true });
  } catch (error: any) {
    console.error("Delete Error:", error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data?.error?.message || error.message });
  }
});

// Vite middleware for development
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
