import { AdmissionApplication } from '../types';

export interface GoogleSheetsConfig {
  webhookUrl: string;
  sheetUrl: string;
  autoSync: boolean;
}

const STORAGE_KEYS = {
  SHEETS_CONFIG: 'kmdc_google_sheets_config_v1',
};

export const DEFAULT_GOOGLE_SHEETS_CONFIG: GoogleSheetsConfig = {
  webhookUrl: 'https://script.google.com/macros/s/AKfycbwxoQADkBVy3OWVBFDzPK1RJ1CIUgi5Kb3anrxNskfMmBaZb_mvhlvEoAMAuE1tEl4ytg/exec',
  sheetUrl: 'https://docs.google.com/spreadsheets/d/1fTCjwZmqwK79w-_NkjZXHTTpQMstlvZ42nrzFMaZLfM/edit',
  autoSync: true,
};

// In-memory cache for fast access
let inMemoryConfig: GoogleSheetsConfig | null = null;

/**
 * Get config from memory / localStorage (synchronous)
 */
export function getGoogleSheetsConfig(): GoogleSheetsConfig {
  if (inMemoryConfig && inMemoryConfig.webhookUrl) {
    return inMemoryConfig;
  }
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SHEETS_CONFIG);
    if (data) {
      const parsed = JSON.parse(data);
      if (parsed && parsed.webhookUrl) {
        inMemoryConfig = parsed;
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed to parse Google Sheets config:', err);
  }
  return DEFAULT_GOOGLE_SHEETS_CONFIG;
}

/**
 * Fetch centralized server config so ANY student device immediately has the Webhook URL.
 * If server is empty but current device has a local webhook URL, automatically upload to server!
 */
export async function fetchServerSheetsConfig(): Promise<GoogleSheetsConfig> {
  const currentConfig = getGoogleSheetsConfig();
  try {
    const res = await fetch('/api/sheets-config');
    if (res.ok) {
      const json = await res.json();
      if (json.config && json.config.webhookUrl) {
        // Server has config - update local storage & memory
        saveGoogleSheetsConfig(json.config, false);
        inMemoryConfig = json.config;
        return json.config;
      }
    }
  } catch (err) {
    console.warn('Could not fetch server sheets config, using current:', err);
  }
  return currentConfig.webhookUrl ? currentConfig : DEFAULT_GOOGLE_SHEETS_CONFIG;
}

/**
 * Save config both to localStorage and central server
 */
export async function saveGoogleSheetsConfig(config: GoogleSheetsConfig, syncToServer: boolean = true): Promise<void> {
  inMemoryConfig = config;
  try {
    localStorage.setItem(STORAGE_KEYS.SHEETS_CONFIG, JSON.stringify(config));
  } catch (err) {
    console.error('Failed to save to localStorage:', err);
  }

  if (syncToServer) {
    try {
      await fetch('/api/sheets-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
    } catch (err) {
      console.error('Failed to save config to server:', err);
    }
  }
}

// Automatically fetch & sync on startup
if (typeof window !== 'undefined') {
  fetchServerSheetsConfig().catch(() => {});
}

/**
 * Pre-formatted Google Apps Script code to paste into Google Sheet Script Editor.
 * Includes:
 * 1. Automatic Column Headers initialization (and automatic migration for existing sheets)
 * 2. Student Passport Photo upload to Google Drive folder ('KMDC_Admission_Student_Photos_2026')
 * 3. Direct IMAGE() formula thumbnail inside Google Sheet cell
 * 4. Clickable direct view link for the student's photo
 * 5. Automatic Row Appending / Updating without duplicates by SSC Roll
 * 6. Detailed error logging in return JSON
 */
export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * ধাপ ১ (অনুমোদন পরীক্ষা):
 * কোড পেস্ট ও সেভ করার পর উপরের টুলবারের ড্রপডাউন থেকে এই ফাংশনটি (initialSetupAndAuthorizeDrive) সিলেক্ট করে "▷ Run" বাটনে ক্লিক করুন।
 * এতে ড্রাইভের পারমিশনের জন্য গুগল থেকে "Authorization Required" পপআপ আসবে। Review Permissions > Advanced > Go to Untitled project (unsafe) > Allow দিন।
 */
function initialSetupAndAuthorizeDrive() {
  var folder = getOrCreatePhotoFolder();
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  ensureCorrectHeaders(sheet);
  Logger.log("Folder created/verified successfully: " + folder.getName() + " URL: " + folder.getUrl());
  return "সফল! গুগল ড্রাইভ ফোল্ডার তৈরি হয়েছে এবং ড্রাইভ পারমিশন অনুমোদন সম্পন্ন হয়েছে: " + folder.getUrl();
}

function getOrCreatePhotoFolder() {
  var folderName = "KMDC_Admission_Student_Photos_2026";
  var folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(folderName);
}

function savePhotoToDrive(base64Data, filename) {
  var debugLog = [];
  try {
    if (!base64Data || typeof base64Data !== 'string') {
      return { url: "", directUrl: "", error: "No base64 string provided" };
    }
    
    // Clean base64 data
    var rawBase64 = base64Data;
    var contentType = "image/jpeg";
    if (base64Data.indexOf("base64,") !== -1) {
      var parts = base64Data.split("base64,");
      contentType = parts[0].split(";")[0].replace("data:", "") || "image/jpeg";
      rawBase64 = parts[1];
    }
    
    var decoded = Utilities.base64Decode(rawBase64);
    var blob = Utilities.newBlob(decoded, contentType, filename);
    
    var folder = getOrCreatePhotoFolder();
    
    // Remove duplicate file with same name if any
    var existingFiles = folder.getFilesByName(filename);
    while (existingFiles.hasNext()) {
      existingFiles.next().setTrashed(true);
    }
    
    var file = folder.createFile(blob);
    // Set view access so thumbnail and direct link work
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch(shareErr) {
      Logger.log("Sharing error (non-fatal): " + shareErr);
    }
    
    var fileId = file.getId();
    var viewUrl = file.getUrl();
    // Direct thumbnail URL for IMAGE() formula in Google Sheets
    var directUrl = "https://lh3.googleusercontent.com/d/" + fileId;
    
    return { url: viewUrl, directUrl: directUrl, fileId: fileId, folderId: folder.getId() };
  } catch (e) {
    Logger.log("Error saving photo to Drive: " + e.toString());
    return { url: "", directUrl: "", error: e.toString() };
  }
}

function ensureCorrectHeaders(sheet) {
  var standardHeaders = [
    "ক্রমিক",
    "শিক্ষার্থীর ছবি (Photo)",
    "ছবির ড্রাইভ লিংক (Drive URL)",
    "ট্র্যাকিং আইডি",
    "শ্রেণি রোল (বরাদ্দকৃত)",
    "ভর্তির স্ট্যাটাস",
    "বিভাগ (Group)",
    "শিক্ষাবর্ষ",
    "এসএসসি রোল",
    "রেজিস্ট্রেশন নম্বর",
    "শিক্ষা বোর্ড",
    "পাসের সন",
    "প্রাপ্ত GPA",
    "শিক্ষার্থীর নাম (বাংলা)",
    "শিক্ষার্থীর নাম (English)",
    "শিক্ষার্থীর মোবাইল",
    "পিতার নাম (বাংলা)",
    "পিতার নাম (English)",
    "পিতার মোবাইল",
    "মাতার নাম (বাংলা)",
    "মাতার নাম (English)",
    "মাতার মোবাইল",
    "বর্তমান ঠিকানা",
    "স্থায়ী ঠিকানা",
    "বাধ্যতামূলক বিষয়",
    "৪র্থ বিষয় (Elective 4)",
    "৫ম বিষয় (Elective 5)",
    "৬ষ্ঠ বিষয় (Elective 6)",
    "৭ম বিষয় (ঐচ্ছিক)",
    "আবেদন দাখিলের সময়",
    "সিঙ্ক সময়"
  ];
  
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(standardHeaders);
  } else {
    // If existing sheet has old headers (where col B is not photo), auto-update header row
    var firstRow = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), standardHeaders.length)).getValues()[0];
    var col2 = String(firstRow[1] || '').trim();
    if (!col2.includes("ছবি") && !col2.includes("Photo")) {
      // Old header layout detected, overwrite first row with new header structure
      sheet.getRange(1, 1, 1, standardHeaders.length).setValues([standardHeaders]);
    }
  }
  
  var headerRange = sheet.getRange(1, 1, 1, standardHeaders.length);
  headerRange.setBackground("#047857");
  headerRange.setFontColor("#ffffff");
  headerRange.setFontWeight("bold");
  headerRange.setHorizontalAlignment("center");
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 35);
  sheet.setColumnWidth(2, 95);
  sheet.setColumnWidth(3, 130);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = spreadsheet.getActiveSheet();
    
    ensureCorrectHeaders(sheet);
    
    var data = JSON.parse(e.postData.contents);
    
    if (data.action === 'TEST_PING') {
      var folder = getOrCreatePhotoFolder();
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        message: 'গুগল শিট ও গুগল ড্রাইভ কানেকশন সফলভাবে কাজ করছে!',
        folderName: folder.getName(),
        folderUrl: folder.getUrl()
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var sscRoll = String(data.sscRoll || '').trim();
    var trackingId = String(data.trackingId || '').trim();
    var studentNameEn = String(data.studentNameEn || 'STUDENT').trim().replace(/[^a-zA-Z0-9]/g, '_');
    
    // Check for existing record by SSC Roll (Col 9 in 1-based, index 8 in 0-based)
    var dataRange = sheet.getDataRange();
    var values = dataRange.getValues();
    var rowIndexToUpdate = -1;
    
    for (var i = 1; i < values.length; i++) {
      var rowRoll = String(values[i][8]).trim();
      // If old format was 7th col, check that too
      if (rowRoll === sscRoll || String(values[i][6]).trim() === sscRoll) {
        rowIndexToUpdate = i + 1;
        break;
      }
    }
    
    var serial = rowIndexToUpdate > 0 ? values[rowIndexToUpdate - 1][0] : (values.length);
    var nowStr = Utilities.formatDate(new Date(), "Asia/Dhaka", "dd/MM/yyyy hh:mm:ss a");
    
    // Process student photo
    var photoFormula = "";
    var photoDriveUrl = "";
    var photoDebug = null;
    
    if (data.photoBase64 && String(data.photoBase64).length > 50) {
      var photoFileName = sscRoll + "_" + studentNameEn + ".jpg";
      var photoResult = savePhotoToDrive(data.photoBase64, photoFileName);
      photoDebug = photoResult;
      if (photoResult.directUrl) {
        photoFormula = '=IMAGE("' + photoResult.directUrl + '", 1)';
        photoDriveUrl = photoResult.url;
      } else if (photoResult.error) {
        photoDriveUrl = "Error: " + photoResult.error;
      }
    } else if (rowIndexToUpdate > 0) {
      photoFormula = values[rowIndexToUpdate - 1][1] || "";
      photoDriveUrl = values[rowIndexToUpdate - 1][2] || "";
    }
    
    var rowData = [
      serial,
      photoFormula, // Column 2: In-cell Image thumbnail
      photoDriveUrl, // Column 3: Drive Full Photo View URL
      trackingId,
      data.classRoll || 'Not Allocated',
      data.status === 'ACCEPTED' ? 'ভর্তি গৃহীত' : (data.status === 'EDIT_PERMITTED' ? 'সংশোধন অনুমোদিত' : 'দাখিলকৃত'),
      data.group || '',
      data.academicYear || '2026-2027',
      data.sscRoll || '',
      data.sscReg || '',
      data.sscBoard || '',
      data.passingYear || '',
      data.gpa || '',
      data.studentNameBn || '',
      data.studentNameEn || '',
      data.studentMobile || '',
      data.fatherNameBn || '',
      data.fatherNameEn || '',
      data.fatherMobile || '',
      data.motherNameBn || '',
      data.motherNameEn || '',
      data.motherMobile || '',
      data.presentAddress || '',
      data.permanentAddress || '',
      (data.compulsorySubjects || []).join(', '),
      data.electiveSubject4 || '',
      data.electiveSubject5 || '',
      data.electiveSubject6 || '',
      data.optionalSubject7 || '',
      data.submittedAt ? Utilities.formatDate(new Date(data.submittedAt), "Asia/Dhaka", "dd/MM/yyyy hh:mm a") : nowStr,
      nowStr
    ];
    
    var targetRow = rowIndexToUpdate > 0 ? rowIndexToUpdate : (values.length + 1);
    
    if (rowIndexToUpdate > 0) {
      sheet.getRange(rowIndexToUpdate, 1, 1, rowData.length).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
    }
    
    // Set row height for photo visibility
    sheet.setRowHeight(targetRow, 70);
    
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      message: 'শিক্ষার্থীর তথ্য ও ছবি সফলভাবে গুগল শিটে রেকর্ড করা হয়েছে।',
      trackingId: trackingId,
      photoResult: photoDebug,
      rowUpdated: targetRow
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || '';
  
  // Real-time bidirectional sync: return all sheet rows directly to Admin Portal across any device
  if (action === 'GET_APPLICATIONS' || action === 'FETCH' || action === 'SYNC' || action === 'READ_ALL') {
    try {
      var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = spreadsheet.getActiveSheet();
      var values = sheet.getDataRange().getValues();
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        count: Math.max(0, values.length - 1),
        rows: values,
        timestamp: new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    } catch(err) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: err.toString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }
  
  return ContentService.createTextOutput("KMDC Online Admission Google Sheets Webhook is active and running!");
}`;

/**
 * Sends single application to Google Sheets webhook via robust Server Proxy (or direct fallback)
 */
export async function sendApplicationToGoogleSheets(
  app: AdmissionApplication,
  webhookUrlOverride?: string
): Promise<{ success: boolean; message: string }> {
  let config = getGoogleSheetsConfig();
  if (!config.webhookUrl) {
    config = await fetchServerSheetsConfig();
  }

  const targetUrl = (webhookUrlOverride || config.webhookUrl || DEFAULT_GOOGLE_SHEETS_CONFIG.webhookUrl).trim();

  // 1. First attempt: Use central server proxy (/api/sync-to-sheet)
  // This completely bypasses browser CORS restrictions, works across devices, and transmits photoBase64
  try {
    const serverRes = await fetch('/api/sync-to-sheet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        application: app,
        webhookUrlOverride: targetUrl || undefined,
      }),
    });

    if (serverRes.ok) {
      const json = await serverRes.json();
      if (json.success) {
        return {
          success: true,
          message: 'গুগল শিটে লাইভ ডেটা ও ছবি পাঠানো হয়েছে!',
        };
      }
    }
  } catch (serverErr) {
    console.warn('Server sync endpoint error, attempting client fallback:', serverErr);
  }

  // 2. Fallback: Direct browser fetch if server is unreachable
  if (!targetUrl) {
    return {
      success: false,
      message: 'গুগল শিট Webhook URL সেট করা হয়নি। এডমিন প্যানেল থেকে Webhook URL সেট করুন।',
    };
  }

  const payload = {
    action: 'SAVE_APPLICATION',
    id: app.id,
    trackingId: app.trackingId,
    academicYear: app.academicYear,
    group: app.group,
    sscRoll: app.sscRoll,
    sscReg: app.sscReg,
    sscBoard: app.sscBoard,
    passingYear: app.passingYear,
    gpa: app.gpa,
    studentNameBn: app.studentNameBn,
    studentNameEn: app.studentNameEn,
    studentMobile: app.studentMobile,
    photoBase64: app.photoBase64 || '', // Student photo
    fatherNameBn: app.fatherNameBn,
    fatherNameEn: app.fatherNameEn,
    fatherMobile: app.fatherMobile,
    motherNameBn: app.motherNameBn,
    motherNameEn: app.motherNameEn,
    motherMobile: app.motherMobile,
    presentAddress: app.presentAddress,
    permanentAddress: app.permanentAddress,
    compulsorySubjects: app.compulsorySubjects,
    electiveSubject4: app.electiveSubject4,
    electiveSubject5: app.electiveSubject5,
    electiveSubject6: app.electiveSubject6,
    optionalSubject7: app.optionalSubject7,
    submittedAt: app.submittedAt,
    updatedAt: app.updatedAt,
    status: app.status,
    classRoll: app.classRoll || '',
    syncTimestamp: new Date().toISOString(),
  };

  try {
    await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
      mode: 'no-cors',
    });

    return {
      success: true,
      message: 'গুগল শিটে লাইভ ডেটা পাঠানো হয়েছে!',
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('Google Sheets sync error:', err);
    return {
      success: false,
      message: `গুগল শিটে পাঠাতে সমস্যা হয়েছে: ${errMsg}`,
    };
  }
}

/**
 * Test ping to Google Sheets Webhook
 */
export async function testGoogleSheetsWebhook(
  url: string
): Promise<{ success: boolean; message: string }> {
  const trimmed = url.trim();
  if (!trimmed) {
    return { success: false, message: 'অনুগ্রহ করে Webhook URL ইনপুট দিন।' };
  }

  // 1. Try server test route
  try {
    const serverRes = await fetch('/api/test-sheets-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhookUrl: trimmed }),
    });

    if (serverRes.ok) {
      const json = await serverRes.json();
      if (json.success) {
        return {
          success: true,
          message: 'সংযোগ টেস্ট সফল হয়েছে! গুগল শিটে টেস্ট সিগন্যাল পৌঁছেছে।',
        };
      }
    }
  } catch (err) {
    console.warn('Server test failed, trying direct:', err);
  }

  // 2. Direct fallback
  try {
    const testPayload = {
      action: 'TEST_PING',
      testTime: new Date().toISOString(),
      college: 'কসবা মহিলা ডিগ্রি কলেজ',
    };

    await fetch(trimmed, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(testPayload),
      mode: 'no-cors',
    });

    return {
      success: true,
      message: 'সংযোগ টেস্ট সম্পন্ন হয়েছে! গুগল শিটে টেস্ট কানেকশন সিগন্যাল পাঠানো হয়েছে।',
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `টেস্ট করতে সমস্যা হয়েছে: ${errMsg}`,
    };
  }
}

/**
 * Robust parser converting Google Sheet rows (from Apps Script or CSV) into typed AdmissionApplication objects
 */
export function parseApplicationRows(rows: any[][]): AdmissionApplication[] {
  if (!rows || rows.length < 2) return [];

  const headers = rows[0].map((h: any) => String(h || '').trim().toLowerCase());

  const findCol = (...names: string[]) => {
    return headers.findIndex((h: string) => names.some((n) => h.includes(n.toLowerCase())));
  };

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

  const parsedApps: AdmissionApplication[] = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;

    const sscRoll = String(
      (colRoll >= 0 ? r[colRoll] : '') ||
      (colTracking >= 0 ? r[colTracking] : '') ||
      r[8] ||
      r[0] ||
      ''
    ).trim();

    if (!sscRoll || sscRoll === 'এসএসসি রোল' || sscRoll.toLowerCase() === 'ssc roll' || sscRoll === 'ক্রমিক') continue;

    const trackingId = String(
      (colTracking >= 0 ? r[colTracking] : '') ||
      r[3] ||
      `KMDC-2026-${String(i).padStart(3, '0')}`
    ).trim();

    const studentNameBn = String(
      (colNameBn >= 0 ? r[colNameBn] : '') ||
      r[13] ||
      'শিক্ষার্থী'
    ).trim();

    const studentNameEn = String(
      (colNameEn >= 0 ? r[colNameEn] : '') ||
      r[14] ||
      'STUDENT'
    ).trim().toUpperCase();

    const groupRaw = String((colGroup >= 0 ? r[colGroup] : '') || r[6] || 'HUMANITIES').toUpperCase();
    let group: AdmissionApplication['group'] = 'HUMANITIES';
    if (groupRaw.includes('SCI') || groupRaw.includes('বিজ্ঞান')) group = 'SCIENCE';
    else if (groupRaw.includes('BUS') || groupRaw.includes('ব্যবসা') || groupRaw.includes('বাণিজ্য')) group = 'BUSINESS STUDIES';

    const gpa = String((colGpa >= 0 ? r[colGpa] : '') || r[12] || '5.00').trim();
    const sscReg = String((colReg >= 0 ? r[colReg] : '') || r[9] || '').trim();
    const sscBoard = String((colBoard >= 0 ? r[colBoard] : '') || r[10] || 'COMILLA').trim();
    const passingYear = String((colYear >= 0 ? r[colYear] : '') || r[11] || '2026').trim();
    const studentMobile = String((colMobile >= 0 ? r[colMobile] : '') || r[15] || '').trim();
    const photoDriveUrl = String((colPhoto >= 0 ? r[colPhoto] : '') || r[2] || '').trim();

    const rawStatus = String((colStatus >= 0 ? r[colStatus] : '') || r[5] || '').trim();
    let status: AdmissionApplication['status'] = 'SUBMITTED';
    if (rawStatus.includes('গৃহীত') || rawStatus.toUpperCase().includes('ACCEPTED')) status = 'ACCEPTED';
    else if (rawStatus.includes('অনুমোদিত') || rawStatus.toUpperCase().includes('EDIT')) status = 'EDIT_PERMITTED';

    const classRoll = String((colClassRoll >= 0 ? r[colClassRoll] : '') || r[4] || '').replace('Not Allocated', '').trim();

    const compStr = String((colComp >= 0 ? r[colComp] : '') || r[24] || '');
    const compulsorySubjects = compStr
      ? compStr.split(',').map((s) => s.trim()).filter(Boolean)
      : ['বাংলা', 'ইংরেজি', 'তথ্য ও যোগাযোগ প্রযুক্তি'];

    const app: AdmissionApplication = {
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
    };

    parsedApps.push(app);
  }

  return parsedApps;
}

/**
 * Automatically queries Google Sheets Webhook and Server to pull all applications in real time without any upload or paste
 */
export async function syncApplicationsFromGoogleSheets(): Promise<{
  success: boolean;
  message: string;
  count: number;
  applications: AdmissionApplication[];
}> {
  // 1. Try server-side live sync endpoint first (bypasses browser CORS & persists to server disk)
  try {
    const serverRes = await fetch(`/api/sync-from-sheet?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' },
    });
    if (serverRes.ok) {
      const json = await serverRes.json();
      if (json.success && Array.isArray(json.applications) && json.applications.length > 0) {
        return {
          success: true,
          message: `সার্ভার ও গুগল শিট থেকে ${json.applications.length} টি আবেদন সফলভাবে সিঙ্ক হয়েছে।`,
          count: json.applications.length,
          applications: json.applications,
        };
      }
    }
  } catch (serverErr) {
    console.warn('Server sync-from-sheet failed, falling back to direct:', serverErr);
  }

  // 2. Direct browser GET to Google Apps Script Webhook
  const config = getGoogleSheetsConfig();
  const targetUrl = (config.webhookUrl || DEFAULT_GOOGLE_SHEETS_CONFIG.webhookUrl).trim();

  if (targetUrl) {
    try {
      const separator = targetUrl.includes('?') ? '&' : '?';
      const fetchUrl = `${targetUrl}${separator}action=GET_APPLICATIONS&_t=${Date.now()}`;

      const res = await fetch(fetchUrl);
      if (res.ok) {
        const text = await res.text();
        let json: any = null;
        try {
          json = JSON.parse(text);
        } catch {}

        if (json && json.status === 'success' && Array.isArray(json.rows) && json.rows.length > 1) {
          const parsed = parseApplicationRows(json.rows);
          if (parsed.length > 0) {
            // Upload parsed apps to central server so other devices get them
            fetch('/api/applications/bulk', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ applications: parsed }),
            }).catch(() => {});

            return {
              success: true,
              message: `গুগল শিট থেকে সরাসরি ${parsed.length} টি আবেদন লোড করা হয়েছে!`,
              count: parsed.length,
              applications: parsed,
            };
          }
        }
      }
    } catch (directErr) {
      console.warn('Direct Apps Script fetch notice:', directErr);
    }
  }

  return {
    success: false,
    message: 'গুগল শিট থেকে নতুন কোনো আবেদন পাওয়া যায়নি।',
    count: 0,
    applications: [],
  };
}
