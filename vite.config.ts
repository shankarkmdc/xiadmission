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

// Helper to read JSON body
function readBody(req: any): Promise<any> {
  if (req.body && typeof req.body === 'object') {
    return Promise.resolve(req.body);
  }
  if (req.readableEnded && !req.readable) {
    return Promise.resolve({});
  }
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: any) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        console.error('Error parsing body in readBody:', e);
        resolve({});
      }
    });
    req.on('error', (err: any) => {
      reject(err);
    });
  });
}

function parseRowsToApplications(rows: any[][]): any[] {
  if (!rows || rows.length < 2) return [];
  const headers = rows[0].map((h: any) => String(h || '').trim().toLowerCase());
  const findCol = (...names: string[]) => headers.findIndex((h: string) => names.some((n) => h.includes(n.toLowerCase())));
  const colRoll = findCol('এসএসসি রোল', 'ssc roll', 'ssc_roll', 'রোল');
  const colTracking = findCol('ট্র্যাকিং আইডি', 'tracking', 'tracking_id', 'আইডি');
  const colNameBn = findCol('শিক্ষার্থীর নাম (বাংলা)', 'শিক্ষার্থীর নাম', 'নাম (বাংলা)', 'name_bn');
  const colNameEn = findCol('শিক্ষার্থীর নাম (english)', 'নাম (english)', 'name_en', 'student_name_en');
  const colGroup = findCol('বিভাগ', 'group', 'শাখা');
  const colGpa = findCol('প্রাপ্ত gpa', 'gpa', 'পয়েন্ট', 'জিপিএ');
  const colReg = findCol('রেজিস্ট্রেশন', 'reg', 'registration');
  const colBoard = findCol('বোর্ড', 'board');
  const colYear = findCol('পাসের সন', 'পাস সন', 'passing_year', 'year');
  const colMobile = findCol('শিক্ষার্থীর মোবাইল', 'মোবাইল', 'mobile', 'phone');
  const colPhoto = findCol('ড্রাইভ লিংক', 'ছবির ড্রাইভ', 'photo', 'ছবি', 'drive');
  const colStatus = findCol('ভর্তির স্ট্যাটাস', 'স্ট্যাটাস', 'status');
  const colClassRoll = findCol('শ্রেণি রোল', 'ক্লাস রোল', 'class roll', 'class_roll');
  const colFatherBn = findCol('পিতার নাম (বাংলা)', 'পিতার নাম', 'father_name_bn');
  const colFatherEn = findCol('পিতার নাম (english)', 'father_name_en');
  const colFatherMob = findCol('পিতার মোবাইল', 'father_mobile');
  const colMotherBn = findCol('মাতার নাম (বাংলা)', 'মাতার নাম', 'mother_name_bn');
  const colMotherEn = findCol('মাতার নাম (english)', 'mother_name_en');
  const colMotherMob = findCol('মাতার মোবাইল', 'mother_mobile');
  const colPresentAddr = findCol('বর্তমান ঠিকানা', 'present_address');
  const colPermAddr = findCol('স্থায়ী ঠিকানা', 'permanent_address');
  const colComp = findCol('বাধ্যতামূলক', 'compulsory');
  const colEl4 = findCol('৪র্থ বিষয়', 'elective 4', '৪র্থ');
  const colEl5 = findCol('৫ম বিষয়', 'elective 5', '৫ম');
  const colEl6 = findCol('৬ষ্ঠ বিষয়', 'elective 6', '৬ষ্ঠ');
  const colOp7 = findCol('৭ম বিষয়', 'optional 7', '৭ম', 'ঐচ্ছিক');
  const colSubDate = findCol('আবেদন দাখিলের সময়', 'দাখিল', 'submitted_at');

  const list: any[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;
    const sscRoll = String((colRoll >= 0 ? r[colRoll] : '') || (colTracking >= 0 ? r[colTracking] : '') || r[8] || r[0] || '').trim();
    if (!sscRoll || sscRoll === 'এসএসসি রোল' || sscRoll.toLowerCase() === 'ssc roll' || sscRoll === 'ক্রমিক') continue;

    const trackingId = String((colTracking >= 0 ? r[colTracking] : '') || r[3] || `KMDC-2026-${String(i).padStart(3, '0')}`).trim();
    const studentNameBn = String((colNameBn >= 0 ? r[colNameBn] : '') || r[13] || 'শিক্ষার্থী').trim();
    const studentNameEn = String((colNameEn >= 0 ? r[colNameEn] : '') || r[14] || 'STUDENT').trim().toUpperCase();
    const groupRaw = String((colGroup >= 0 ? r[colGroup] : '') || r[6] || 'HUMANITIES').toUpperCase();
    let group = 'HUMANITIES';
    if (groupRaw.includes('SCI') || groupRaw.includes('বিজ্ঞান')) group = 'SCIENCE';
    else if (groupRaw.includes('BUS') || groupRaw.includes('ব্যবসা') || groupRaw.includes('বাণিজ্য')) group = 'BUSINESS STUDIES';

    const gpa = String((colGpa >= 0 ? r[colGpa] : '') || r[12] || '5.00').trim();
    const sscReg = String((colReg >= 0 ? r[colReg] : '') || r[9] || '').trim();
    const sscBoard = String((colBoard >= 0 ? r[colBoard] : '') || r[10] || 'COMILLA').trim();
    const passingYear = String((colYear >= 0 ? r[colYear] : '') || r[11] || '2026').trim();
    const studentMobile = String((colMobile >= 0 ? r[colMobile] : '') || r[15] || '').trim();
    const photoDriveUrl = String((colPhoto >= 0 ? r[colPhoto] : '') || r[2] || '').trim();

    const rawStatus = String((colStatus >= 0 ? r[colStatus] : '') || r[5] || '').trim();
    let status = 'SUBMITTED';
    if (rawStatus.includes('গৃহীত') || rawStatus.toUpperCase().includes('ACCEPTED')) status = 'ACCEPTED';
    else if (rawStatus.includes('অনুমোদিত') || rawStatus.toUpperCase().includes('EDIT')) status = 'EDIT_PERMITTED';

    const classRoll = String((colClassRoll >= 0 ? r[colClassRoll] : '') || r[4] || '').replace('Not Allocated', '').trim();
    const compStr = String((colComp >= 0 ? r[colComp] : '') || r[24] || '');
    const compulsorySubjects = compStr ? compStr.split(',').map((s: string) => s.trim()).filter(Boolean) : ['বাংলা', 'ইংরেজি', 'তথ্য ও যোগাযোগ প্রযুক্তি'];

    list.push({
      id: `app_${sscRoll}`,
      trackingId,
      classRoll,
      status,
      group,
      academicYear: '2026-2027',
      sscRoll,
      sscReg,
      sscBoard,
      passingYear,
      gpa: isNaN(parseFloat(gpa)) ? '5.00' : parseFloat(gpa).toFixed(2),
      studentNameBn,
      studentNameEn,
      studentMobile,
      photoBase64: photoDriveUrl,
      fatherNameBn: String((colFatherBn >= 0 ? r[colFatherBn] : '') || r[16] || '').trim(),
      fatherNameEn: String((colFatherEn >= 0 ? r[colFatherEn] : '') || r[17] || '').trim().toUpperCase(),
      fatherMobile: String((colFatherMob >= 0 ? r[colFatherMob] : '') || r[18] || '').trim(),
      motherNameBn: String((colMotherBn >= 0 ? r[colMotherBn] : '') || r[19] || '').trim(),
      motherNameEn: String((colMotherEn >= 0 ? r[colMotherEn] : '') || r[20] || '').trim().toUpperCase(),
      motherMobile: String((colMotherMob >= 0 ? r[colMotherMob] : '') || r[21] || '').trim(),
      presentAddress: String((colPresentAddr >= 0 ? r[colPresentAddr] : '') || r[22] || '').trim(),
      permanentAddress: String((colPermAddr >= 0 ? r[colPermAddr] : '') || r[23] || '').trim(),
      compulsorySubjects,
      electiveSubject4: String((colEl4 >= 0 ? r[colEl4] : '') || r[25] || '').trim(),
      electiveSubject5: String((colEl5 >= 0 ? r[colEl5] : '') || r[26] || '').trim(),
      electiveSubject6: String((colEl6 >= 0 ? r[colEl6] : '') || r[27] || '').trim(),
      optionalSubject7: String((colOp7 >= 0 ? r[colOp7] : '') || r[28] || '').trim(),
      submittedAt: String((colSubDate >= 0 ? r[colSubDate] : '') || r[29] || new Date().toISOString()),
      updatedAt: new Date().toISOString(),
      syncedToGoogleSheets: true,
      lastSyncedAt: new Date().toISOString(),
    });
  }
  return list;
}

// Shared middleware handler for both Dev Server and Preview Server
function setupMiddlewares(middlewares: Connect.Server) {
  middlewares.use(async (req, res, next) => {
    const rawUrl = req.url || '';
    const pathname = rawUrl.split('?')[0];

    // Common CORS & no-cache headers for all API responses
    if (pathname.startsWith('/api/')) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
      }
    }

    // 1. GET /api/sheets-config
    if (pathname === '/api/sheets-config' && req.method === 'GET') {
      const cfg = readServerSheetsConfig();
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true, config: cfg }));
      return;
    }

    // 2. POST /api/sheets-config
    if (pathname === '/api/sheets-config' && req.method === 'POST') {
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
    if (pathname === '/api/applications' && req.method === 'GET') {
      const apps = readServerApplications();
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true, applications: apps }));
      return;
    }

    // 4. POST /api/applications (Save/Update single application)
    if (pathname === '/api/applications' && req.method === 'POST') {
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
    if (pathname === '/api/applications/bulk' && req.method === 'POST') {
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
    if (pathname === '/api/applications/replace' && req.method === 'POST') {
      const body = await readBody(req);
      const incomingApps = Array.isArray(body.applications) ? body.applications : [];
      writeServerApplications(incomingApps);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true, count: incomingApps.length }));
      return;
    }

    // 6. POST /api/sync-to-sheet
    if (pathname === '/api/sync-to-sheet' && req.method === 'POST') {
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
    if (pathname === '/api/test-sheets-connection' && req.method === 'POST') {
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

    // 8. GET or POST /api/sync-from-sheet: Pulls applications from Google Sheets directly to Server
    if (pathname === '/api/sync-from-sheet' && (req.method === 'GET' || req.method === 'POST')) {
      try {
        const config = readServerSheetsConfig();
        const targetUrl = (config.webhookUrl || ACTIVE_WEBHOOK_URL || '').trim();

        let fetchedApps: any[] = [];
        let syncSource = 'none';

        // 1. Try Google Apps Script Webhook
        if (targetUrl) {
          try {
            const separator = targetUrl.includes('?') ? '&' : '?';
            const fetchUrl = `${targetUrl}${separator}action=GET_APPLICATIONS&_t=${Date.now()}`;
            const gasRes = await fetch(fetchUrl, { redirect: 'follow' });
            if (gasRes.ok) {
              const gasText = await gasRes.text();
              let gasJson: any = null;
              try {
                gasJson = JSON.parse(gasText);
              } catch {}

              if (gasJson && gasJson.status === 'success' && Array.isArray(gasJson.rows) && gasJson.rows.length > 1) {
                fetchedApps = parseRowsToApplications(gasJson.rows);
                if (fetchedApps.length > 0) {
                  syncSource = 'google_apps_script_webhook';
                }
              }
            }
          } catch (gasErr) {
            console.warn('Vite /api/sync-from-sheet Apps Script fetch warning:', gasErr);
          }
        }

        // 2. Try Google Sheets CSV Export if sheet URL exists
        const sheetUrl = (config.sheetUrl || ACTIVE_SPREADSHEET_URL || '').trim();
        if (fetchedApps.length === 0 && sheetUrl.includes('/d/')) {
          try {
            const match = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
            if (match && match[1]) {
              const sheetId = match[1];
              const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
              const csvRes = await fetch(csvUrl, { redirect: 'follow' });
              if (csvRes.ok) {
                const csvText = await csvRes.text();
                // Simple CSV row parser
                const rows = csvText
                  .split('\n')
                  .filter(Boolean)
                  .map((line) => {
                    const row: string[] = [];
                    let inQuotes = false;
                    let current = '';
                    for (let c = 0; c < line.length; c++) {
                      const char = line[c];
                      if (char === '"') {
                        inQuotes = !inQuotes;
                      } else if (char === ',' && !inQuotes) {
                        row.push(current.trim());
                        current = '';
                      } else {
                        current += char;
                      }
                    }
                    row.push(current.trim());
                    return row;
                  });

                if (rows.length > 1) {
                  const csvApps = parseRowsToApplications(rows);
                  if (csvApps.length > 0) {
                    fetchedApps = csvApps;
                    syncSource = 'google_sheets_csv_export';
                  }
                }
              }
            }
          } catch (csvErr) {
            console.warn('Vite /api/sync-from-sheet CSV export warning:', csvErr);
          }
        }

        // Merge newly fetched apps with server apps
        const currentServerApps = readServerApplications();
        const appMap = new Map<string, any>();
        currentServerApps.forEach((a: any) => {
          if (a.sscRoll) appMap.set(String(a.sscRoll).trim(), a);
        });

        let newOrUpdatedCount = 0;
        fetchedApps.forEach((a: any) => {
          const roll = String(a.sscRoll).trim();
          if (roll) {
            const existing = appMap.get(roll);
            if (!existing || JSON.stringify(existing) !== JSON.stringify(a)) {
              newOrUpdatedCount++;
            }
            appMap.set(roll, { ...(existing || {}), ...a, syncedToGoogleSheets: true, lastSyncedAt: new Date().toISOString() });
          }
        });

        const merged = Array.from(appMap.values());
        if (newOrUpdatedCount > 0) {
          writeServerApplications(merged);
        }

        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            success: true,
            source: syncSource,
            fetchedFromSheetCount: fetchedApps.length,
            newOrUpdatedCount,
            totalCount: merged.length,
            applications: merged,
          })
        );
        return;
      } catch (syncErr: any) {
        console.error('Vite /api/sync-from-sheet error:', syncErr);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, message: syncErr?.message || 'Sync failed' }));
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
        '@': path.resolve(process.cwd(), '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
