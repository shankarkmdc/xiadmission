import React, { useState, useEffect } from 'react';
import { AdmissionApplication } from '../types';
import {
  GoogleSheetsConfig,
  getGoogleSheetsConfig,
  saveGoogleSheetsConfig,
  fetchServerSheetsConfig,
  sendApplicationToGoogleSheets,
  testGoogleSheetsWebhook,
  GOOGLE_APPS_SCRIPT_CODE,
} from '../services/googleSheetsService';
import {
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Send,
  Sparkles,
  Link,
  ShieldCheck,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface GoogleSheetsSyncPanelProps {
  applications: AdmissionApplication[];
  onApplicationsUpdated: (updatedApps: AdmissionApplication[]) => void;
}

export const GoogleSheetsSyncPanel: React.FC<GoogleSheetsSyncPanelProps> = ({
  applications,
  onApplicationsUpdated,
}) => {
  const [config, setConfig] = useState<GoogleSheetsConfig>(getGoogleSheetsConfig());
  const [webhookUrl, setWebhookUrl] = useState<string>(config.webhookUrl);
  const [sheetUrl, setSheetUrl] = useState<string>(config.sheetUrl);
  const [autoSync, setAutoSync] = useState<boolean>(config.autoSync);

  // Fetch centralized config from server on mount
  useEffect(() => {
    fetchServerSheetsConfig().then((serverCfg) => {
      if (serverCfg && serverCfg.webhookUrl) {
        setConfig(serverCfg);
        setWebhookUrl(serverCfg.webhookUrl);
        setSheetUrl(serverCfg.sheetUrl || '');
        setAutoSync(serverCfg.autoSync !== false);
      }
    });
  }, []);

  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testStatus, setTestStatus] = useState<{ success: boolean; message: string } | null>(null);

  const [isSyncingAll, setIsSyncingAll] = useState<boolean>(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number } | null>(null);
  const [syncAllMessage, setSyncAllMessage] = useState<string | null>(null);

  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [showCodeDetails, setShowCodeDetails] = useState<boolean>(false);

  const isConfigured = Boolean(webhookUrl.trim());

  // Count synced vs unsynced
  const syncedCount = applications.filter((a) => a.syncedToGoogleSheets).length;
  const unsyncedCount = applications.length - syncedCount;

  // Save Settings
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const newConfig: GoogleSheetsConfig = {
      webhookUrl: webhookUrl.trim(),
      sheetUrl: sheetUrl.trim(),
      autoSync,
    };
    saveGoogleSheetsConfig(newConfig);
    setConfig(newConfig);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3500);
  };

  // Test Webhook Connection
  const handleTestConnection = async () => {
    if (!webhookUrl.trim()) {
      setTestStatus({ success: false, message: 'প্রথমে Webhook URL ইনপুট দিন।' });
      return;
    }

    setIsTesting(true);
    setTestStatus(null);

    const result = await testGoogleSheetsWebhook(webhookUrl);
    setIsTesting(false);
    setTestStatus(result);
  };

  // Sync All Applications to Google Sheets
  const handleSyncAll = async () => {
    if (!webhookUrl.trim()) {
      alert('অনুগ্রহ করে প্রথমে Google Apps Script Webhook URL সংরক্ষণ করুন।');
      return;
    }

    if (applications.length === 0) {
      alert('সিঙ্ক করার জন্য কোনো আবেদন পাওয়া যায়নি!');
      return;
    }

    if (!window.confirm(`আপনি কি মোট ${applications.length} জন শিক্ষার্থীর আবেদন গুগল শিটে লাইভ পাঠাতে চান?`)) {
      return;
    }

    setIsSyncingAll(true);
    setSyncAllMessage(null);
    setSyncProgress({ current: 0, total: applications.length });

    const updated = [...applications];
    let successCount = 0;

    for (let i = 0; i < updated.length; i++) {
      const app = updated[i];
      setSyncProgress({ current: i + 1, total: updated.length });

      try {
        const res = await sendApplicationToGoogleSheets(app, webhookUrl);
        if (res.success) {
          updated[i] = {
            ...app,
            syncedToGoogleSheets: true,
            lastSyncedAt: new Date().toISOString(),
          };
          successCount++;
        }
      } catch (err) {
        console.error('Error syncing app:', app.sscRoll, err);
      }

      // Small throttle to avoid hitting Apps Script rate limits
      await new Promise((r) => setTimeout(r, 120));
    }

    setIsSyncingAll(false);
    onApplicationsUpdated(updated);
    setSyncAllMessage(`সফল! মোট ${successCount} টি আবেদন গুগল শিটে সফলভাবে সিঙ্ক হয়েছে।`);
  };

  // Copy Google Apps Script Code
  const handleCopyCode = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Status Overview */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                isConfigured
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900">
                  Google Sheets লাইভ সিঙ্ক সংযোগ
                </h3>
                {isConfigured ? (
                  <span className="inline-flex items-center gap-1 text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                    সক্রিয় ও প্রস্তুত
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-800 font-bold px-2.5 py-0.5 rounded-full">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Webhook URL দেওয়া হয়নি
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                শিক্ষার্থীরা তাদের নিজ নিজ মোবাইল বা কম্পিউটার থেকে আবেদন সাবমিট করলেই তাৎক্ষণিকভাবে লাইভ গুগল শিটে নতুন রো (Row) হিসেবে যুক্ত হবে।
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100 self-start lg:self-auto">
            <div className="text-center px-2">
              <span className="block text-[11px] text-slate-500">মোট আবেদন</span>
              <span className="text-base font-bold text-slate-800">{applications.length}</span>
            </div>
            <div className="w-px h-7 bg-slate-200" />
            <div className="text-center px-2">
              <span className="block text-[11px] text-emerald-600">শিটে সিঙ্কড</span>
              <span className="text-base font-bold text-emerald-700">{syncedCount}</span>
            </div>
            {sheetUrl && (
              <>
                <div className="w-px h-7 bg-slate-200" />
                <a
                  href={sheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>গুগল শিট খুলুন</span>
                </a>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (Configuration Form & Sync Actions) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Webhook Configuration Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <h4 className="font-bold text-slate-900 text-sm sm:text-base mb-1 flex items-center gap-2">
              <Link className="w-4 h-4 text-emerald-600" />
              গুগল শিট Webhook সংযোগ সেটিংস
            </h4>
            <p className="text-xs text-slate-500 mb-4">
              গুগল শিটের Apps Script Deploy থেকে প্রাপ্ত Web App URL-টি নিচে পেস্ট করে সংরক্ষণ করুন।
            </p>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Google Apps Script Web App URL <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <input
                    type="url"
                    required
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-xs sm:text-sm"
                  />
                </div>
                <span className="text-[11px] text-slate-400 block mt-1">
                  URL-টি অবশ্যই <span className="font-mono text-slate-600">/exec</span> দিয়ে শেষ হতে হবে।
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  গুগল শিট ব্রাউজার লিঙ্ক (Google Sheet URL - ঐচ্ছিক):
                </label>
                <input
                  type="url"
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-xs sm:text-sm"
                />
                <span className="text-[11px] text-slate-400 block mt-1">
                  এডমিন যাতে এডমিন প্যানেল থেকে ১-ক্লিকেই সরাসরি গুগল শিটটি নতুন ট্যাবে খুলতে পারেন।
                </span>
              </div>

              {/* Auto Sync Toggle */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    স্বয়ংক্রিয় লাইভ সিঙ্ক (Auto-Sync on Student Submission)
                  </span>
                  <span className="text-[11px] text-slate-500">
                    শিক্ষার্থী আবেদন ফরম সাবমিট করার সাথে সাথেই তার তথ্য স্বয়ংক্রিয়ভাবে গুগল শিটে চলে যাবে।
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer ml-3 shrink-0">
                  <input
                    type="checkbox"
                    checked={autoSync}
                    onChange={(e) => setAutoSync(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {/* Save Success Alert */}
              {saveSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>গুগল শিট সেটিংস সফলভাবে সংরক্ষিত হয়েছে!</span>
                </div>
              )}

              {/* Test Status Alert */}
              {testStatus && (
                <div
                  className={`p-3 rounded-xl text-xs font-medium flex items-start gap-2 border ${
                    testStatus.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  {testStatus.success ? (
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <span>{testStatus.message}</span>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition"
                >
                  সেটিংস সংরক্ষণ করুন
                </button>

                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting || !webhookUrl.trim()}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                >
                  {isTesting ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>{isTesting ? 'টেস্ট হচ্ছে...' : 'কানেকশন টেস্ট করুন'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Bulk Sync Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <h4 className="font-bold text-slate-900 text-sm sm:text-base mb-1 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-emerald-600" />
              সব আবেদন গুগল শিটে পাঠান (Bulk Sync)
            </h4>
            <p className="text-xs text-slate-500 mb-4">
              বর্তমানে সিস্টেমে থাকা {applications.length} টি আবেদন এক ক্লিকে গুগল শিটে পুশ করুন। কোনো কারণে কোনো আবেদন বাদ পড়ে থাকলে এই বাটনে চাপলে তা শিটে আপডেট হয়ে যাবে।
            </p>

            {syncProgress && (
              <div className="mb-4 space-y-1.5">
                <div className="flex justify-between text-xs text-slate-600 font-semibold">
                  <span>সিঙ্ক অগ্রগতি: {syncProgress.current} / {syncProgress.total}</span>
                  <span>{Math.round((syncProgress.current / syncProgress.total) * 100)}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-emerald-600 h-2.5 rounded-full transition-all duration-300"
                    style={{
                      width: `${(syncProgress.current / syncProgress.total) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {syncAllMessage && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{syncAllMessage}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleSyncAll}
              disabled={isSyncingAll || !isConfigured || applications.length === 0}
              className="w-full sm:w-auto px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition flex items-center justify-center gap-2"
            >
              {isSyncingAll ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4" />
              )}
              <span>{isSyncingAll ? 'গুগল শিটে ডেটা পাঠানো হচ্ছে...' : `সব ${applications.length} টি আবেদন গুগল শিটে সিঙ্ক করুন`}</span>
            </button>
          </div>
        </div>

        {/* Right Column (Step-by-Step Setup Guide & Pre-made Code) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900 text-slate-200 rounded-2xl p-6 border border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h4 className="font-bold text-white text-sm">গুগল শিট সেটআপ নির্দেশিকা</h4>
              </div>
              <a
                href="https://sheets.new"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold px-2.5 py-1 rounded-lg border border-slate-700 inline-flex items-center gap-1 transition"
              >
                <span>নতুন শিট খুলুন</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <ol className="text-xs space-y-2.5 text-slate-300 list-decimal list-inside leading-relaxed">
              <li>
                <strong className="text-white">নতুন স্প্রেডশিট:</strong> একটি নতুন Google Sheet খুলুন (যেমন নাম দিন: <span className="font-mono text-amber-300">KMDC_Admission_2026-2027</span>)।
              </li>
              <li>
                <strong className="text-white">Apps Script খুলুন:</strong> গুগল শিটের মেনু থেকে <span className="text-amber-300 font-semibold">Extensions &gt; Apps Script</span>-এ ক্লিক করুন।
              </li>
              <li>
                <strong className="text-white">কোড পেস্ট করুন:</strong> স্ক্রিপ্ট এডিটরের কোড মুছে নিচের বাটনে ক্লিক করে কোডটি কপি করে পেস্ট করুন।
              </li>
              <li>
                <strong className="text-white">Web App ডেপ্লয় / আপডেট করুন:</strong>
                <ul className="list-disc list-inside pl-3 mt-1 space-y-1 text-slate-300 text-[11px]">
                  <li>উপরে ডানে <span className="text-white font-semibold">Deploy &gt; Manage deployments</span>-এ যান (বা New deployment)।</li>
                  <li>পেনসিল (✏️ Edit) আইকনে ক্লিক করে Version-এ <span className="text-amber-300 font-bold">New version</span> নির্বাচন করুন।</li>
                  <li>Execute as: <span className="text-white font-semibold">Me (আপনার ইমেইল)</span></li>
                  <li>Who has access: <span className="text-amber-300 font-bold">Anyone</span> (এটি আবশ্যক)।</li>
                  <li><span className="text-white font-semibold">Deploy</span> বাটনে চাপ দিন। গুগল ড্রাইভে ছবি সেভ করার জন্য <span className="text-emerald-400 font-bold">Authorize access / Allow</span> অনুমতি দিতে বলবে, অনুমতি দিন।</li>
                </ul>
              </li>
              <li>
                <strong className="text-white">URL পেস্ট করুন:</strong> প্রাপ্ত <span className="font-mono text-amber-300">Web app URL</span> কপি করে বামপাশের ইনপুটে পেস্ট করে সংরক্ষণ করুন।
              </li>
            </ol>

            {/* Copy Script Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleCopyCode}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm"
              >
                {copiedCode ? (
                  <Check className="w-4 h-4 text-white" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                <span>{copiedCode ? 'Apps Script কোড কপিকৃত!' : 'Apps Script কোড ১-ক্লিকে কপি করুন'}</span>
              </button>
            </div>

            {/* Toggle Code Preview */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowCodeDetails(!showCodeDetails)}
                className="w-full text-[11px] text-slate-400 hover:text-slate-200 flex items-center justify-between py-1 transition"
              >
                <span>{showCodeDetails ? 'কোড প্রিভিউ লুকান' : 'প্রয়োজনীয় Google Apps Script কোড দেখুন'}</span>
                {showCodeDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showCodeDetails && (
                <div className="mt-2 bg-slate-950 p-3 rounded-xl border border-slate-800 text-[10px] font-mono text-emerald-400 overflow-x-auto max-h-56">
                  <pre>{GOOGLE_APPS_SCRIPT_CODE}</pre>
                </div>
              )}
            </div>
          </div>

          {/* Fields Mapping Card */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm text-xs space-y-2">
            <h5 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
              <Info className="w-4 h-4 text-emerald-600" />
              গুগল শিটে কোন কোন কলাম স্বয়ংক্রিয়ভাবে তৈরি হবে:
            </h5>
            <p className="text-slate-500 text-[11px]">
              প্রথম সাবমিশনের সময় অ্যাপস স্ক্রিপ্ট নিজে থেকেই স্প্রেডশিটে নিম্নোক্ত কলামগুলো তৈরি করবে:
            </p>
            <div className="flex flex-wrap gap-1 text-[10px] text-slate-700 pt-1">
              {[
                'ক্রমিক',
                'শিক্ষার্থীর ছবি (Photo Thumbnail)',
                'ছবির ড্রাইভ লিংক (Drive URL)',
                'ট্র্যাকিং আইডি',
                'শ্রেণি রোল',
                'স্ট্যাটাস',
                'বিভাগ',
                'এসএসসি রোল',
                'রেজিস্ট্রেশন নম্বর',
                'বোর্ড ও সন',
                'GPA',
                'শিক্ষার্থীর নাম',
                'শিক্ষার্থীর মোবাইল',
                'পিতার নাম ও মোবাইল',
                'মাতার নাম ও মোবাইল',
                'বর্তমান ও স্থায়ী ঠিকানা',
                'বাধ্যতামূলক বিষয়',
                '৪র্থ, ৫ম, ৬ষ্ঠ ও ৭ম বিষয়',
                'দাখিলের সময়',
              ].map((col, idx) => (
                <span
                  key={idx}
                  className="bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200"
                >
                  {col}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
