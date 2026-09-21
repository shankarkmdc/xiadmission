import { AdmissionApplication } from '../types';

export interface GoogleSheetsConfig {
  webhookUrl: string;
  sheetUrl: string;
  autoSync: boolean;
}

const STORAGE_KEYS = {
  SHEETS_CONFIG: 'kmdc_google_sheets_config_v1',
};

// In-memory cache for fast access
let inMemoryConfig: GoogleSheetsConfig | null = null;

/**
 * Get config from memory / localStorage (synchronous)
 */
export function getGoogleSheetsConfig(): GoogleSheetsConfig {
  if (inMemoryConfig) {
    return inMemoryConfig;
  }
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SHEETS_CONFIG);
    if (data) {
      const parsed = JSON.parse(data);
      inMemoryConfig = parsed;
      return parsed;
    }
  } catch (err) {
    console.error('Failed to parse Google Sheets config:', err);
  }
  return {
    webhookUrl: '',
    sheetUrl: '',
    autoSync: true,
  };
}

/**
 * Fetch centralized server config so ANY student device immediately has the Webhook URL
 */
export async function fetchServerSheetsConfig(): Promise<GoogleSheetsConfig> {
  try {
    const res = await fetch('/api/sheets-config');
    if (res.ok) {
      const json = await res.json();
      if (json.config && json.config.webhookUrl) {
        saveGoogleSheetsConfig(json.config, false);
        inMemoryConfig = json.config;
        return json.config;
      }
    }
  } catch (err) {
    console.warn('Could not fetch server sheets config, using local cache:', err);
  }
  return getGoogleSheetsConfig();
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

// Automatically fetch on startup
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
export const GOOGLE_APPS_SCRIPT_CODE = `function getOrCreatePhotoFolder() {
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

  const targetUrl = (webhookUrlOverride || config.webhookUrl || '').trim();

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
