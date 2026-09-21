import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Persistent server config file for Google Sheets webhook & applications
const DATA_DIR = path.join(process.cwd(), '.kmdc_data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const CONFIG_FILE = path.join(DATA_DIR, 'sheets_config.json');

function readServerSheetsConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('Error reading sheets config:', err);
  }
  return {
    webhookUrl: process.env.GOOGLE_SHEETS_WEBHOOK_URL || '',
    sheetUrl: process.env.GOOGLE_SHEETS_SPREADSHEET_URL || '',
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

// -------------------------------------------------------------
// API Routes
// -------------------------------------------------------------

// 1. Get current Google Sheets config (so student devices get the Webhook URL)
app.get('/api/sheets-config', (req, res) => {
  const cfg = readServerSheetsConfig();
  res.json({
    success: true,
    config: cfg,
  });
});

// 2. Save Google Sheets config from Admin Portal
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

// 3. Central Proxy Route: Send application to Google Sheets from Server
// This completely avoids CORS errors and works seamlessly across all mobile/desktop devices!
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

    // Node-fetch / native fetch to Google Apps Script
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
      redirect: 'follow', // Follow Google Apps Script 302 redirect
    });

    const responseText = await response.text();
    let responseJson = null;
    try {
      responseJson = JSON.parse(responseText);
    } catch {
      // Sometimes Apps Script returns text
    }

    return res.json({
      success: true,
      message: 'গুগল শিটে সফলভাবে রেকর্ড করা হয়েছে!',
      data: responseJson || responseText,
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
