import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { defineConfig, type Plugin } from 'vite';

// Persistent server config file for Google Sheets webhook & applications
const DATA_DIR = path.join(process.cwd(), '.kmdc_data');
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch {}
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

// Vite plugin providing /api/sync-to-sheet and /api/sheets-config endpoints
function googleSheetsApiPlugin(): Plugin {
  return {
    name: 'google-sheets-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';

        // Helper to read JSON body
        const readBody = (): Promise<any> => {
          return new Promise((resolve, reject) => {
            let body = '';
            req.on('data', (chunk) => {
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
        };

        // 1. GET /api/sheets-config
        if (url === '/api/sheets-config' && req.method === 'GET') {
          const cfg = readServerSheetsConfig();
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, config: cfg }));
          return;
        }

        // 2. POST /api/sheets-config
        if (url === '/api/sheets-config' && req.method === 'POST') {
          const body = await readBody();
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
              message: 'Google Sheets configuration saved.',
            })
          );
          return;
        }

        // 3. POST /api/sync-to-sheet
        if (url === '/api/sync-to-sheet' && req.method === 'POST') {
          try {
            const body = await readBody();
            const { application, webhookUrlOverride } = body;
            const config = readServerSheetsConfig();
            const targetUrl = (webhookUrlOverride || config.webhookUrl || '').trim();

            if (!targetUrl) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  success: false,
                  message: 'Google Sheets Webhook URL is not configured.',
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

        // 4. POST /api/test-sheets-connection
        if (url === '/api/test-sheets-connection' && req.method === 'POST') {
          try {
            const body = await readBody();
            const config = readServerSheetsConfig();
            const targetUrl = (body.webhookUrl || config.webhookUrl || '').trim();

            if (!targetUrl) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, message: 'Webhook URL is required.' }));
              return;
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
