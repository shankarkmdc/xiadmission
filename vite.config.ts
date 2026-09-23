import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { defineConfig, type Plugin, type Connect } from 'vite';

// Persistent server config file for Google Sheets webhook & applications
const DATA_DIR = path.join(process.cwd(), '.kmdc_data');
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch {}
}
const CONFIG_FILE = path.join(DATA_DIR, 'sheets_config.json');
const APPLICATIONS_FILE = path.join(DATA_DIR, 'applications.json');

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

// Helper to read JSON body
function readBody(req: any): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: any) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

// Shared middleware handler for both Dev Server and Preview Server
function setupMiddlewares(middlewares: Connect.Server) {
  middlewares.use(async (req, res, next) => {
    const url = req.url || '';

    // 1. GET /api/sheets-config
    if (url === '/api/sheets-config' && req.method === 'GET') {
      const cfg = readServerSheetsConfig();
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true, config: cfg }));
      return;
    }

    // 2. POST /api/sheets-config
    if (url === '/api/sheets-config' && req.method === 'POST') {
      const body = await readBody(req);
      const newConfig = {
        webhookUrl: (body.webhookUrl || '').trim(),
        sheetUrl: (body.sheetUrl || '').trim(),
        autoSync: body.autoSync !== false,
        updatedAt: new Date().toISOString(),
      };
      writeServerSheetsConfig(newConfig);
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          success: true,
          config: newConfig,
          message: 'Google Sheets configuration saved centrally on server.',
        })
      );
      return;
    }

    // 3. GET /api/applications (Loads all central applications across devices)
    if (url === '/api/applications' && req.method === 'GET') {
      const apps = readServerApplications();
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true, applications: apps }));
      return;
    }

    // 4. POST /api/applications (Save/Update single application)
    if (url === '/api/applications' && req.method === 'POST') {
      const body = await readBody(req);
      const application = body.application || body;
      if (!application || !application.sscRoll) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, message: 'Invalid application data.' }));
        return;
      }
      const updatedApps = upsertServerApplication(application);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true, count: updatedApps.length }));
      return;
    }

    // 5. POST /api/applications/bulk (Bulk sync applications)
    if (url === '/api/applications/bulk' && req.method === 'POST') {
      const body = await readBody(req);
      const incomingApps = Array.isArray(body.applications) ? body.applications : [];
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
      
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true, count: merged.length }));
      return;
    }

    // 5.1 POST /api/applications/replace (Full replace for deletions/status updates)
    if (url === '/api/applications/replace' && req.method === 'POST') {
      const body = await readBody(req);
      const incomingApps = Array.isArray(body.applications) ? body.applications : [];
      writeServerApplications(incomingApps);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true, count: incomingApps.length }));
      return;
    }

    // 6. POST /api/sync-to-sheet
    if (url === '/api/sync-to-sheet' && req.method === 'POST') {
      try {
        const body = await readBody(req);
        const { application, webhookUrlOverride } = body;
        const config = readServerSheetsConfig();

        // If client provided a webhookUrlOverride and server has no URL or different URL, auto-persist to server!
        if (webhookUrlOverride && (!config.webhookUrl || config.webhookUrl !== webhookUrlOverride)) {
          config.webhookUrl = webhookUrlOverride;
          writeServerSheetsConfig(config);
        }

        const targetUrl = (webhookUrlOverride || config.webhookUrl || '').trim();

        if (!targetUrl) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              success: false,
              message: 'Google Sheets Webhook URL is not configured on the central server. Please save it from Admin Portal.',
            })
          );
          return;
        }

        if (!application) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, message: 'Application payload is missing.' }));
          return;
        }

        // Save application locally on the server as well so admin sees it across all devices
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
          photoBase64: application.photoBase64 || '',
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

        const response = await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload),
          redirect: 'follow',
        });

        const responseText = await response.text();
        let responseJson = null;
        try {
          responseJson = JSON.parse(responseText);
        } catch {}

        const scriptSuccess = !responseJson || responseJson.status !== 'error';

        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            success: scriptSuccess,
            message:
              responseJson?.message ||
              (scriptSuccess ? 'গুগল শিটে সফলভাবে রেকর্ড করা হয়েছে!' : 'Apps Script ত্রুটি দিয়েছে'),
            data: responseJson || responseText,
            hasPhoto: Boolean(payload.photoBase64 && payload.photoBase64.length > 50),
          })
        );
        return;
      } catch (err: any) {
        console.error('Vite middleware sync-to-sheet error:', err);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, message: err?.message || 'Sync failed' }));
        return;
      }
    }

    // 7. POST /api/test-sheets-connection
    if (url === '/api/test-sheets-connection' && req.method === 'POST') {
      try {
        const body = await readBody(req);
        const config = readServerSheetsConfig();
        const targetUrl = (body.webhookUrl || config.webhookUrl || '').trim();

        if (!targetUrl) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, message: 'Webhook URL is required.' }));
          return;
        }

        // Auto-persist valid test url if provided
        if (body.webhookUrl && !config.webhookUrl) {
          config.webhookUrl = body.webhookUrl;
          writeServerSheetsConfig(config);
        }

        const testPayload = {
          action: 'TEST_PING',
          testTime: new Date().toISOString(),
          college: 'কসবা মহিলা ডিগ্রি কলেজ',
        };

        const response = await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(testPayload),
          redirect: 'follow',
        });

        const responseText = await response.text();
        let responseJson = null;
        try {
          responseJson = JSON.parse(responseText);
        } catch {}

        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            success: true,
            message: 'গুগল শিট কানেকশন টেস্ট সফল হয়েছে!',
            data: responseJson || responseText,
          })
        );
        return;
      } catch (err: any) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, message: err?.message || 'Connection failed' }));
        return;
      }
    }

    next();
  });
}

// Vite plugin providing /api/sync-to-sheet, /api/sheets-config, and /api/applications endpoints
function googleSheetsApiPlugin(): Plugin {
  return {
    name: 'google-sheets-api-plugin',
    configureServer(server) {
      setupMiddlewares(server.middlewares);
    },
    configurePreviewServer(server) {
      setupMiddlewares(server.middlewares);
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), googleSheetsApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
