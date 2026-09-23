import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Enable CORS for cross-device requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Persistent server config file for Google Sheets webhook & applications
const DATA_DIR = path.join(process.cwd(), '.kmdc_data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const CONFIG_FILE = path.join(DATA_DIR, 'sheets_config.json');
const APPLICATIONS_FILE = path.join(DATA_DIR, 'applications.json');

const ACTIVE_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbwxoQADkBVy3OWVBFDzPK1RJ1CIUgi5Kb3anrxNskfMmBaZb_mvhlvEoAMAuE1tEl4ytg/exec';
const ACTIVE_SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1fTCjwZmqwK79w-_NkjZXHTTpQMstlvZ42nrzFMaZLfM/edit';

function readServerSheetsConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      if (cfg && cfg.webhookUrl) return cfg;
    }
  } catch (err) {
    console.error('Error reading sheets config:', err);
  }
  return {
    webhookUrl: process.env.GOOGLE_SHEETS_WEBHOOK_URL || ACTIVE_WEBHOOK_URL,
    sheetUrl: process.env.GOOGLE_SHEETS_SPREADSHEET_URL || ACTIVE_SPREADSHEET_URL,
    autoSync: true,
  };
}

function writeServerSheetsConfig(config: any) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving sheets config:', err);
  }
}

function readServerApplications(): any[] {
  try {
    if (fs.existsSync(APPLICATIONS_FILE)) {
      const data = fs.readFileSync(APPLICATIONS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading server applications:', err);
  }
  return [];
}

function writeServerApplications(apps: any[]) {
  try {
    fs.writeFileSync(APPLICATIONS_FILE, JSON.stringify(apps, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving server applications:', err);
  }
}

function upsertServerApplication(app: any) {
  try {
    const apps = readServerApplications();
    const index = apps.findIndex((a: any) => a.sscRoll === app.sscRoll || a.trackingId === app.trackingId);
    if (index >= 0) {
      apps[index] = { ...apps[index], ...app, updatedAt: new Date().toISOString() };
    } else {
      apps.push(app);
    }
    writeServerApplications(apps);
    return apps;
  } catch (err) {
    console.error('Error upserting server application:', err);
    return [];
  }
}

// -------------------------------------------------------------
// API Routes
// -------------------------------------------------------------

// 1. Get current Google Sheets config
app.get('/api/sheets-config', (req, res) => {
  const cfg = readServerSheetsConfig();
  res.json({
    success: true,
    config: cfg,
  });
});

// 2. Save Google Sheets config
app.post('/api/sheets-config', (req, res) => {
  const { webhookUrl, sheetUrl, autoSync } = req.body;
  const newConfig = {
    webhookUrl: (webhookUrl || '').trim(),
    sheetUrl: (sheetUrl || '').trim(),
    autoSync: autoSync !== false,
    updatedAt: new Date().toISOString(),
  };
  writeServerSheetsConfig(newConfig);
  res.json({
    success: true,
    config: newConfig,
    message: 'Google Sheets configuration saved successfully on server.',
  });
});

// 3. Get all applications from central database (for any device or Admin Portal)
app.get('/api/applications', (req, res) => {
  const apps = readServerApplications();
  res.json({ success: true, applications: apps });
});

// 4. Upsert single application
app.post('/api/applications', (req, res) => {
  const application = req.body.application || req.body;
  if (!application || !application.sscRoll) {
    return res.status(400).json({ success: false, message: 'Invalid application data' });
  }
  const updatedApps = upsertServerApplication(application);
  return res.json({ success: true, count: updatedApps.length });
});

// 5. Bulk sync applications
app.post('/api/applications/bulk', (req, res) => {
  const incomingApps = Array.isArray(req.body.applications) ? req.body.applications : [];
  const currentApps = readServerApplications();
  const appMap = new Map<string, any>();
  currentApps.forEach((a: any) => appMap.set(String(a.sscRoll).trim(), a));
  incomingApps.forEach((a: any) => {
    const roll = String(a.sscRoll).trim();
    if (roll) {
      appMap.set(roll, { ...(appMap.get(roll) || {}), ...a });
    }
  });
  const merged = Array.from(appMap.values());
  writeServerApplications(merged);
  return res.json({ success: true, count: merged.length });
});

// 6. Replace applications (for deletions or full updates)
app.post('/api/applications/replace', (req, res) => {
  const incomingApps = Array.isArray(req.body.applications) ? req.body.applications : [];
  writeServerApplications(incomingApps);
  return res.json({ success: true, count: incomingApps.length });
});

// 3. Central Proxy Route: Send application to Google Sheets from Server
// This completely avoids CORS errors, works across mobile/desktop, and transmits photoBase64
app.post('/api/sync-to-sheet', async (req, res) => {
  try {
    const { application, webhookUrlOverride } = req.body;
    const config = readServerSheetsConfig();
    const targetUrl = (webhookUrlOverride || config.webhookUrl || '').trim();

    if (!targetUrl) {
      return res.status(400).json({
        success: false,
        message: 'Google Sheets Webhook URL is not configured on the server.',
      });
    }

    if (!application) {
      return res.status(400).json({
        success: false,
        message: 'Application payload is missing.',
      });
    }

    // Always ensure application is recorded in central database as well
    upsertServerApplication(application);

    const payload = {
      action: 'SAVE_APPLICATION',
      id: application.id,
      trackingId: application.trackingId,
      academicYear: application.academicYear || '2026-2027',
      group: application.group,
      sscRoll: application.sscRoll,
      sscReg: application.sscReg,
      sscBoard: application.sscBoard,
      passingYear: application.passingYear,
      gpa: application.gpa,
      studentNameBn: application.studentNameBn,
      studentNameEn: application.studentNameEn,
      studentMobile: application.studentMobile,
      photoBase64: application.photoBase64 || '', // Student photo for Google Drive & thumbnail
      fatherNameBn: application.fatherNameBn,
      fatherNameEn: application.fatherNameEn,
      fatherMobile: application.fatherMobile,
      motherNameBn: application.motherNameBn,
      motherNameEn: application.motherNameEn,
      motherMobile: application.motherMobile,
      presentAddress: application.presentAddress,
      permanentAddress: application.permanentAddress,
      compulsorySubjects: application.compulsorySubjects || [],
      electiveSubject4: application.electiveSubject4 || '',
      electiveSubject5: application.electiveSubject5 || '',
      electiveSubject6: application.electiveSubject6 || '',
      optionalSubject7: application.optionalSubject7 || '',
      submittedAt: application.submittedAt || new Date().toISOString(),
      updatedAt: application.updatedAt || new Date().toISOString(),
      status: application.status,
      classRoll: application.classRoll || '',
      syncTimestamp: new Date().toISOString(),
    };

    // Node native fetch to Google Apps Script
    console.log(`[SyncToSheet] Sending app roll=${payload.sscRoll} hasPhoto=${Boolean(payload.photoBase64 && payload.photoBase64.length > 50)} photoLen=${payload.photoBase64?.length || 0} to ${targetUrl.substring(0, 45)}...`);

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
      redirect: 'follow', // Follow Google Apps Script 302 redirect
    });

    const responseText = await response.text();
    console.log(`[SyncToSheet] Apps Script raw response:`, responseText.substring(0, 200));

    let responseJson = null;
    try {
      responseJson = JSON.parse(responseText);
    } catch {
      // Sometimes Apps Script returns plain text
    }

    const scriptSuccess = !responseJson || responseJson.status !== 'error';

    return res.json({
      success: scriptSuccess,
      message: responseJson?.message || (scriptSuccess ? 'গুগল শিটে সফলভাবে রেকর্ড করা হয়েছে!' : 'Apps Script ত্রুটি দিয়েছে'),
      data: responseJson || responseText,
      hasPhoto: Boolean(payload.photoBase64 && payload.photoBase64.length > 50),
    });
  } catch (error: any) {
    console.error('Server sync-to-sheet error:', error);
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to communicate with Google Sheets',
    });
  }
});

// 4. Test Webhook Connection Route
app.post('/api/test-sheets-connection', async (req, res) => {
  try {
    const { webhookUrl } = req.body;
    const config = readServerSheetsConfig();
    const targetUrl = (webhookUrl || config.webhookUrl || '').trim();

    if (!targetUrl) {
      return res.status(400).json({
        success: false,
        message: 'Webhook URL is required.',
      });
    }

    const testPayload = {
      action: 'TEST_PING',
      testTime: new Date().toISOString(),
      college: 'কসবা মহিলা ডিগ্রি কলেজ',
    };

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(testPayload),
      redirect: 'follow',
    });

    const responseText = await response.text();
    let responseJson = null;
    try {
      responseJson = JSON.parse(responseText);
    } catch {}

    return res.json({
      success: true,
      message: 'গুগল শিট কানেকশন টেস্ট সফল হয়েছে!',
      data: responseJson || responseText,
    });
  } catch (error: any) {
    console.error('Server test-sheets-connection error:', error);
    return res.status(500).json({
      success: false,
      message: error?.message || 'Connection failed',
    });
  }
});

// -------------------------------------------------------------
// Vite middleware for development & static files for production
// -------------------------------------------------------------
async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`KMDC Admission Server running on http://0.0.0.0:${PORT}`);
  });
}

start();
