import React, { useState, useRef } from 'react';
import { AdmissionApplication, EligibleStudent, StudyGroup } from '../types';
import {
  getAdminPassword,
  setAdminPassword,
  resetAdminPassword,
  getApplications,
  saveApplications,
  getEligibleStudents,
  saveEligibleStudents,
  exportApplicationsToExcel,
  downloadEligibleStudentsTemplate,
  downloadPhotosZip,
  fetchServerApplications,
} from '../services/storage';
import {
  getGoogleSheetsConfig,
  sendApplicationToGoogleSheets,
} from '../services/googleSheetsService';
import { GoogleSheetsSyncPanel } from './GoogleSheetsSyncPanel';
import { EDUCATION_BOARDS, PASSING_YEARS } from '../constants/collegeData';
import * as XLSX from 'xlsx';
import {
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  LogOut,
  Upload,
  FileSpreadsheet,
  Download,
  Search,
  CheckCircle,
  Check,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  Archive,
  Users,
  FileCheck,
  Award,
  AlertTriangle,
  KeyRound,
  Filter,
  ExternalLink,
  Printer,
} from 'lucide-react';

interface AdminPortalProps {
  onViewApplication: (app: AdmissionApplication) => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({ onViewApplication }) => {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [enteredPassword, setEnteredPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Admin Active View Tab
  const [adminTab, setAdminTab] = useState<'applications' | 'eligible' | 'sheets' | 'settings'>('applications');

  // Application Data State
  const [applications, setApplications] = useState<AdmissionApplication[]>(getApplications());
  const [eligibleStudents, setEligibleStudents] = useState<EligibleStudent[]>(getEligibleStudents());

  // Filter & Search States
  const [appSearch, setAppSearch] = useState<string>('');
  const [appGroupFilter, setAppGroupFilter] = useState<string>('ALL');
  const [appYearFilter, setAppYearFilter] = useState<string>('2026-2027');
  const [appStatusFilter, setAppStatusFilter] = useState<string>('ALL');

  const [elSearch, setElSearch] = useState<string>('');
  const [elGroupFilter, setElGroupFilter] = useState<string>('ALL');

  // Action Modals State
  // 1. Accept Admission & Assign Class Roll
  const [acceptModalApp, setAcceptModalApp] = useState<AdmissionApplication | null>(null);
  const [classRollInput, setClassRollInput] = useState<string>('');

  // 2. Direct Edit Application Modal
  const [editAppModal, setEditAppModal] = useState<AdmissionApplication | null>(null);

  // 3. Add/Edit Eligible Student Modal
  const [eligibleModal, setEligibleModal] = useState<{
    mode: 'add' | 'edit';
    student: Partial<EligibleStudent>;
  } | null>(null);

  // 4. Password Change State
  const [newPasswordInput, setNewPasswordInput] = useState<string>('');
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState<boolean>(false);

  // 5. File upload reference
  const fileUploadRef = useRef<HTMLInputElement>(null);
  const [uploadFeedback, setUploadFeedback] = useState<{ success?: string; error?: string } | null>(null);
  const [isZipping, setIsZipping] = useState<boolean>(false);
  const [syncingAppId, setSyncingAppId] = useState<string | null>(null);

  // Reload data
  const refreshData = async () => {
    try {
      const serverApps = await fetchServerApplications();
      setApplications(serverApps);
    } catch {
      setApplications(getApplications());
    }
    setEligibleStudents(getEligibleStudents());
  };

  React.useEffect(() => {
    if (isAuthenticated) {
      refreshData();
    }
  }, [isAuthenticated, adminTab]);

  // Login handler
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const correctPassword = getAdminPassword();
    if (enteredPassword.trim() === correctPassword.trim()) {
      setIsAuthenticated(true);
      setAuthError(null);
      refreshData();
    } else {
      setAuthError('ভুল পাসওয়ার্ড! অনুগ্রহ করে সঠিক পাসওয়ার্ড দিয়ে চেষ্টা করুন।');
    }
  };

  // Logout handler
  const handleLogout = () => {
    setIsAuthenticated(false);
    setEnteredPassword('');
  };

  // -------------------------------------------------------------
  // Applications Actions
  // -------------------------------------------------------------
  const handleOpenAcceptModal = (app: AdmissionApplication) => {
    setAcceptModalApp(app);
    setClassRollInput(app.classRoll || '');
  };

  const handleSaveAdmissionAccept = () => {
    if (!acceptModalApp) return;
    if (!classRollInput.trim()) {
      alert('অনুগ্রহ করে শ্রেণি রোল নম্বর লিখুন।');
      return;
    }

    const updatedApp = {
      ...acceptModalApp,
      status: 'ACCEPTED' as const,
      classRoll: classRollInput.trim(),
      updatedAt: new Date().toISOString(),
    };

    const updated = applications.map((a) => {
      if (a.id === acceptModalApp.id) {
        return updatedApp;
      }
      return a;
    });

    saveApplications(updated);
    setApplications(updated);
    setAcceptModalApp(null);

    // Auto-sync update to Google Sheets if configured
    const sheetsConfig = getGoogleSheetsConfig();
    if (sheetsConfig.webhookUrl && sheetsConfig.autoSync) {
      sendApplicationToGoogleSheets(updatedApp).then((res) => {
        if (res.success) {
          const syncedList = updated.map((a) =>
            a.id === updatedApp.id ? { ...a, syncedToGoogleSheets: true, lastSyncedAt: new Date().toISOString() } : a
          );
          saveApplications(syncedList);
          setApplications(syncedList);
        }
      }).catch(console.error);
    }
  };

  const handleGrantEditPermission = (appId: string) => {
    if (!window.confirm('আপনি কি এই শিক্ষার্থীকে তার আবেদন সংশোধনের অনুমোদন দিতে চান?')) {
      return;
    }

    const updated = applications.map((a) => {
      if (a.id === appId) {
        return {
          ...a,
          status: 'EDIT_PERMITTED' as const,
          editPermissionGiven: true,
          updatedAt: new Date().toISOString(),
        };
      }
      return a;
    });

    saveApplications(updated);
    setApplications(updated);
  };

  const handleDeleteApplication = (appId: string) => {
    if (!window.confirm('সতর্কতা: আপনি কি নিশ্চিত যে এই শিক্ষার্থীর আবেদনটি স্থায়ীভাবে মুছে ফেলতে চান?')) {
      return;
    }

    const updated = applications.filter((a) => a.id !== appId);
    saveApplications(updated);
    setApplications(updated);
  };

  const handleSaveEditedApplication = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAppModal) return;

    const updated = applications.map((a) => (a.id === editAppModal.id ? editAppModal : a));
    saveApplications(updated);
    setApplications(updated);

    // Auto-sync update to Google Sheets if configured
    const sheetsConfig = getGoogleSheetsConfig();
    if (sheetsConfig.webhookUrl && sheetsConfig.autoSync) {
      sendApplicationToGoogleSheets(editAppModal).then((res) => {
        if (res.success) {
          const syncedList = updated.map((a) =>
            a.id === editAppModal.id ? { ...a, syncedToGoogleSheets: true, lastSyncedAt: new Date().toISOString() } : a
          );
          saveApplications(syncedList);
          setApplications(syncedList);
        }
      }).catch(console.error);
    }

    setEditAppModal(null);
  };

  // Sync single application to Google Sheets on demand
  const handleSyncSingleApp = async (app: AdmissionApplication) => {
    const config = getGoogleSheetsConfig();
    if (!config.webhookUrl) {
      alert('প্রথমে "গুগল শিট লাইভ সিঙ্ক" ট্যাবে গিয়ে আপনার Google Apps Script Webhook URL সংরক্ষণ করুন।');
      setAdminTab('sheets');
      return;
    }

    setSyncingAppId(app.id);
    try {
      const res = await sendApplicationToGoogleSheets(app);
      if (res.success) {
        const updated = applications.map((a) =>
          a.id === app.id
            ? {
                ...a,
                syncedToGoogleSheets: true,
                lastSyncedAt: new Date().toISOString(),
              }
            : a
        );
        saveApplications(updated);
        setApplications(updated);
        alert(`রোল ${app.sscRoll} (${app.studentNameEn})-এর তথ্য গুগল শিটে সফলভাবে রেকর্ড করা হয়েছে!`);
      } else {
        alert(res.message);
      }
    } catch (err: any) {
      alert(`গুগল শিটে পাঠাতে সমস্যা হয়েছে: ${err.message || err}`);
    } finally {
      setSyncingAppId(null);
    }
  };

  // -------------------------------------------------------------
  // Eligible Students Actions
  // -------------------------------------------------------------
  const handleDeleteEligibleStudent = (id: string) => {
    if (!window.confirm('আপনি কি এই শিক্ষার্থীকে তালিকা থেকে মুছে ফেলতে চান?')) {
      return;
    }

    const updated = eligibleStudents.filter((s) => s.id !== id);
    saveEligibleStudents(updated);
    setEligibleStudents(updated);
  };

  const handleSaveEligibleStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eligibleModal) return;

    const { mode, student } = eligibleModal;
    if (!student.studentName || !student.sscRoll || !student.sscBoard || !student.group) {
      alert('অনুগ্রহ করে সকল আবশ্যকীয় তথ্য পূরণ করুন।');
      return;
    }

    let updated: EligibleStudent[];
    if (mode === 'add') {
      const newEntry: EligibleStudent = {
        id: `el-${Date.now()}`,
        studentName: student.studentName.trim().toUpperCase(),
        sscRoll: student.sscRoll.trim(),
        sscBoard: student.sscBoard || 'COMILLA',
        passingYear: student.passingYear || '2026',
        group: student.group as StudyGroup,
        academicYear: student.academicYear || '2026-2027',
      };
      updated = [newEntry, ...eligibleStudents];
    } else {
      updated = eligibleStudents.map((s) =>
        s.id === student.id
          ? ({
              ...s,
              ...student,
              studentName: student.studentName?.toUpperCase() || s.studentName,
            } as EligibleStudent)
          : s
      );
    }

    saveEligibleStudents(updated);
    setEligibleStudents(updated);
    setEligibleModal(null);
  };

  // Upload CSV or XLSX
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadFeedback(null);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet);

        if (!rawJson || rawJson.length === 0) {
          setUploadFeedback({ error: 'ফাইলে কোনো তথ্য পাওয়া যায়নি।' });
          return;
        }

        // Map columns (supporting both Bengali and English column headers)
        const parsedStudents: EligibleStudent[] = [];
        let skipped = 0;

        rawJson.forEach((row, idx) => {
          const name =
            row['Student Name'] ||
            row['শিক্ষার্থীর নাম'] ||
            row['Name'] ||
            row['নাম'] ||
            '';
          const roll =
            row['SSC/Dakhil Roll Number'] ||
            row['এসএসসি/দাখিল পরীক্ষার রোল নম্বর'] ||
            row['SSC Roll'] ||
            row['রোল'] ||
            '';
          const board =
            row['SSC/Dakhil Board'] ||
            row['এসএসসি/দাখিল পরীক্ষার বোর্ড'] ||
            row['Board'] ||
            row['বোর্ড'] ||
            'COMILLA';
          const year =
            row['Passing Year'] ||
            row['এসএসসি/দাখিল পাসের সন'] ||
            row['Year'] ||
            row['পাসের সন'] ||
            '2026';
          const rawGroup =
            row['Group'] ||
            row['ভর্তিচ্ছুক বিভাগ'] ||
            row['বিভাগ'] ||
            row['Department'] ||
            'HUMANITIES';
          const session =
            row['Academic Year'] ||
            row['শিক্ষাবর্ষ'] ||
            row['Session'] ||
            '2026-2027';

          // Normalize group
          let group: StudyGroup = 'HUMANITIES';
          const upperG = String(rawGroup).toUpperCase();
          if (upperG.includes('SCI') || upperG.includes('বিজ্ঞান')) {
            group = 'SCIENCE';
          } else if (upperG.includes('BUS') || upperG.includes('COMM') || upperG.includes('ব্যবসা')) {
            group = 'BUSINESS STUDIES';
          }

          if (roll && name) {
            parsedStudents.push({
              id: `el-upload-${Date.now()}-${idx}`,
              studentName: String(name).trim().toUpperCase(),
              sscRoll: String(roll).trim(),
              sscBoard: String(board).trim().toUpperCase(),
              passingYear: String(year).trim(),
              group,
              academicYear: String(session).trim(),
            });
          } else {
            skipped++;
          }
        });

        if (parsedStudents.length === 0) {
          setUploadFeedback({
            error:
              'ফাইলের কলামগুলো মিল পাওয়া যায়নি। দয়া করে প্রদত্ত নমুনা ফাইল অনুযায়ী কলাম নাম দিন।',
          });
          return;
        }

        // Merge or replace: Avoid duplicate roll numbers
        const currentList = getEligibleStudents();
        const existingRolls = new Set(currentList.map((s) => s.sscRoll));

        const newEntries = parsedStudents.filter((s) => !existingRolls.has(s.sscRoll));
        const combined = [...newEntries, ...currentList];

        saveEligibleStudents(combined);
        setEligibleStudents(combined);

        setUploadFeedback({
          success: `সফলভাবে ${newEntries.length} জন নতুন শিক্ষার্থীর তথ্য আপলোড করা হয়েছে! (ইতিমধ্যে বিদ্যমান ছিল: ${parsedStudents.length - newEntries.length} জন)`,
        });

        if (fileUploadRef.current) {
          fileUploadRef.current.value = '';
        }
      } catch (err) {
        console.error(err);
        setUploadFeedback({ error: 'ফাইল রিড করতে ব্যর্থ হয়েছে। সঠিক CSV বা XLSX ফাইল দিন।' });
      }
    };

    reader.readAsBinaryString(file);
  };

  // Export filtered applications to Excel
  const handleExportApplications = (format: 'xlsx' | 'csv') => {
    const filtered = getFilteredApplications();
    if (filtered.length === 0) {
      alert('ডাউনলোড করার মতো কোনো আবেদন পাওয়া যায়নি!');
      return;
    }
    const filename = `KMDC_Applications_${appGroupFilter}_${appYearFilter}_${Date.now()}`;
    exportApplicationsToExcel(filtered, filename, format);
  };

  // Download Photos ZIP
  const handleDownloadZip = async () => {
    const filtered = getFilteredApplications();
    if (filtered.length === 0) {
      alert('কোন শিক্ষার্থীর তথ্য পাওয়া যায়নি!');
      return;
    }
    setIsZipping(true);
    try {
      const zipName = `KMDC_Student_Photos_${appGroupFilter}_${appYearFilter}`;
      await downloadPhotosZip(filtered, zipName);
    } catch (err: any) {
      alert(err.message || 'ছবি ডাউনলোড করতে ত্রুটি দেখা দিয়েছে।');
    } finally {
      setIsZipping(false);
    }
  };

  // Filtered Applications logic
  const getFilteredApplications = (): AdmissionApplication[] => {
    return applications.filter((app) => {
      // Group filter
      if (appGroupFilter !== 'ALL' && app.group !== appGroupFilter) return false;
      // Year filter
      if (appYearFilter !== 'ALL' && app.academicYear !== appYearFilter) return false;
      // Status filter
      if (appStatusFilter !== 'ALL' && app.status !== appStatusFilter) return false;
      // Search
      if (appSearch.trim()) {
        const q = appSearch.toLowerCase().trim();
        const matchRoll = app.sscRoll.toLowerCase().includes(q);
        const matchTracking = app.trackingId.toLowerCase().includes(q);
        const matchNameEn = app.studentNameEn.toLowerCase().includes(q);
        const matchNameBn = app.studentNameBn.toLowerCase().includes(q);
        const matchMobile = app.studentMobile.includes(q);
        if (!matchRoll && !matchTracking && !matchNameEn && !matchNameBn && !matchMobile) {
          return false;
        }
      }
      return true;
    });
  };

  // Filtered Eligible Students logic
  const getFilteredEligible = (): EligibleStudent[] => {
    return eligibleStudents.filter((el) => {
      if (elGroupFilter !== 'ALL' && el.group !== elGroupFilter) return false;
      if (elSearch.trim()) {
        const q = elSearch.toLowerCase().trim();
        const matchRoll = el.sscRoll.toLowerCase().includes(q);
        const matchName = el.studentName.toLowerCase().includes(q);
        if (!matchRoll && !matchName) return false;
      }
      return true;
    });
  };

  // Handle password change
  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPasswordInput.length < 6) {
      alert('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।');
      return;
    }
    setAdminPassword(newPasswordInput.trim());
    setPasswordChangeSuccess(true);
    setNewPasswordInput('');
    setTimeout(() => setPasswordChangeSuccess(false), 3000);
  };

  // -------------------------------------------------------------
  // Render: Login Screen if not authenticated
  // -------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto py-12 px-4">
        <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-xl text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-700 text-white flex items-center justify-center mx-auto mb-4 shadow-md">
            <Lock className="w-8 h-8 text-amber-300" />
          </div>

          <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-3 py-0.5 rounded-full uppercase tracking-wider">
            এডমিন কন্ট্রোল প্যানেল
          </span>

          <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
            কলেজ কর্তৃপক্ষ লগইন
          </h2>
          <p className="text-xs text-slate-500 mt-1 mb-6">
            ভর্তি কার্যক্রম পরিচালনা ও শিক্ষার্থী ডাটা ব্যবস্থাপনার জন্য পাসওয়ার্ড দিন
          </p>

          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                এডমিন পাসওয়ার্ড (Admin Password):
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  id="admin-login-password-input"
                  value={enteredPassword}
                  onChange={(e) => setEnteredPassword(e.target.value)}
                  placeholder="পাসওয়ার্ড লিখুন..."
                  className="w-full pl-4 pr-10 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {authError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              id="admin-login-submit-btn"
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-sm font-bold shadow-md shadow-emerald-700/20 transition flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              লগইন করুন
            </button>
          </form>

          {/* Secure Admin Portal Notice (Password hidden) */}
          <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-400 text-center flex items-center justify-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>শুধুমাত্র অনুমোদিত কলেজ প্রশাসনের ব্যবহারের জন্য সংরক্ষিত</span>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // Render: Authenticated Dashboard
  // -------------------------------------------------------------
  const filteredApps = getFilteredApplications();
  const filteredEligible = getFilteredEligible();

  const totalEligible = eligibleStudents.length;
  const totalApps = applications.length;
  const acceptedApps = applications.filter((a) => a.status === 'ACCEPTED').length;
  const pendingApps = applications.filter((a) => a.status === 'SUBMITTED').length;

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 space-y-6">
      {/* Admin Subheader & Navigation */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="text-xl sm:text-2xl font-black text-slate-900">
              কলেজ ভর্তি প্রশাসন পোর্টাল
            </h2>
            <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
              সেশন ২০২৬-২০২৭
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            ভর্তিযোগ্য শিক্ষার্থী তালিকা আপলোড, আবেদন অনুমোদন, শ্রেণি রোল বরাদ্দ ও রিপোর্ট ডাউনলোড
          </p>
        </div>

        <div className="flex items-center gap-3 self-end md:self-auto">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              id="admin-tab-apps-btn"
              onClick={() => setAdminTab('applications')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition ${
                adminTab === 'applications'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileCheck className="w-4 h-4" />
              ভর্তি আবেদনসমূহ ({totalApps})
            </button>
            <button
              type="button"
              id="admin-tab-eligible-btn"
              onClick={() => setAdminTab('eligible')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition ${
                adminTab === 'eligible'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-4 h-4" />
              ভর্তিযোগ্য তালিকা ({totalEligible})
            </button>
            <button
              type="button"
              id="admin-tab-sheets-btn"
              onClick={() => setAdminTab('sheets')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition ${
                adminTab === 'sheets'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              গুগল শিট লাইভ সিঙ্ক
            </button>
            <button
              type="button"
              id="admin-tab-settings-btn"
              onClick={() => setAdminTab('settings')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition ${
                adminTab === 'settings'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <KeyRound className="w-4 h-4" />
              নিরাপত্তা
            </button>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-rose-100 hover:text-rose-700 text-slate-700 rounded-xl text-xs font-semibold transition"
            title="লগআউট"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">লগআউট</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-slate-400 text-xs font-bold block mb-1">মোট ভর্তিযোগ্য শিক্ষার্থী</span>
          <span className="text-2xl font-black text-slate-800 font-mono">{totalEligible}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-slate-400 text-xs font-bold block mb-1">মোট দাখিলকৃত আবেদন</span>
          <span className="text-2xl font-black text-emerald-800 font-mono">{totalApps}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-slate-400 text-xs font-bold block mb-1">ভর্তি চূড়ান্ত গৃহীত</span>
          <span className="text-2xl font-black text-blue-700 font-mono">{acceptedApps}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-slate-400 text-xs font-bold block mb-1">যাচাই অপেক্ষমান</span>
          <span className="text-2xl font-black text-amber-600 font-mono">{pendingApps}</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: APPLICATIONS (ভর্তি আবেদনসমূহ) */}
      {/* ========================================================================= */}
      {adminTab === 'applications' && (
        <div className="space-y-4">
          {/* Action & Filter Toolbar */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
            {/* Search & Filters */}
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={appSearch}
                  onChange={(e) => setAppSearch(e.target.value)}
                  placeholder="রোল, ট্র্যাকিং আইডি, নাম বা মোবাইল দিয়ে খুঁজুন..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs sm:text-sm"
                />
              </div>

              {/* Group Filter */}
              <select
                value={appGroupFilter}
                onChange={(e) => setAppGroupFilter(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs sm:text-sm font-semibold focus:outline-none"
              >
                <option value="ALL">সকল বিভাগ</option>
                <option value="HUMANITIES">মানবিক (HUMANITIES)</option>
                <option value="SCIENCE">বিজ্ঞান (SCIENCE)</option>
                <option value="BUSINESS STUDIES">ব্যবসায় শিক্ষা (BUSINESS)</option>
              </select>

              {/* Status Filter */}
              <select
                value={appStatusFilter}
                onChange={(e) => setAppStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs sm:text-sm font-semibold focus:outline-none"
              >
                <option value="ALL">সকল অবস্থা</option>
                <option value="SUBMITTED">দাখিলকৃত (SUBMITTED)</option>
                <option value="ACCEPTED">ভর্তি গৃহীত (ACCEPTED)</option>
                <option value="EDIT_PERMITTED">সংশোধন অনুমোদিত</option>
              </select>

              {/* Academic Year */}
              <select
                value={appYearFilter}
                onChange={(e) => setAppYearFilter(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs sm:text-sm font-semibold focus:outline-none"
              >
                <option value="ALL">সকল শিক্ষাবর্ষ</option>
                <option value="2026-2027">২০২৬-২০২৭</option>
                <option value="2025-2026">২০২৫-২০২৬</option>
              </select>
            </div>

            {/* Export & ZIP Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                id="export-applications-excel-btn"
                onClick={() => handleExportApplications('xlsx')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold shadow-xs transition"
                title="Excel এ ডাউনলোড করুন"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Excel ডাউনলোড
              </button>

              <button
                type="button"
                id="export-applications-csv-btn"
                onClick={() => handleExportApplications('csv')}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-xs transition"
                title="CSV এ ডাউনলোড করুন"
              >
                <Download className="w-4 h-4" />
                CSV
              </button>

              <button
                type="button"
                id="download-photos-zip-btn"
                onClick={handleDownloadZip}
                disabled={isZipping}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs transition disabled:opacity-50"
                title="শিক্ষার্থীদের ছবি ZIP আকারে ডাউনলোড করুন"
              >
                <Archive className="w-4 h-4" />
                {isZipping ? 'জিপ তৈরি হচ্ছে...' : 'ছবি ZIP ডাউনলোড'}
              </button>
            </div>
          </div>

          {/* Applications Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase tracking-wider text-[11px]">
                    <th className="p-3 w-10 text-center">ছবি</th>
                    <th className="p-3">ট্র্যাকিং আইডি</th>
                    <th className="p-3">এসএসসি রোল</th>
                    <th className="p-3">শিক্ষার্থীর নাম</th>
                    <th className="p-3">বিভাগ</th>
                    <th className="p-3">GPA</th>
                    <th className="p-3">মোবাইল নম্বর</th>
                    <th className="p-3">অবস্থা ও শ্রেণি রোল</th>
                    <th className="p-3 text-right">কার্যক্রম (Action)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredApps.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400">
                        কোনো ভর্তি আবেদন পাওয়া যায়নি।
                      </td>
                    </tr>
                  ) : (
                    filteredApps.map((app) => (
                      <tr key={app.id} className="hover:bg-slate-50 transition">
                        {/* Photo */}
                        <td className="p-3 text-center">
                          <div
                            className="w-9 h-11 rounded border border-slate-300 overflow-hidden mx-auto bg-slate-100 shrink-0"
                            style={{ width: '36px', height: '45px' }}
                          >
                            {app.photoBase64 ? (
                              <img
                                src={app.photoBase64}
                                alt={app.studentNameEn}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-[8px] text-slate-400">ছবি নেই</span>
                            )}
                          </div>
                        </td>

                        {/* Tracking ID */}
                        <td className="p-3 font-mono font-bold text-emerald-800">
                          {app.trackingId}
                        </td>

                        {/* SSC Roll */}
                        <td className="p-3 font-mono font-semibold text-slate-900">
                          {app.sscRoll}
                        </td>

                        {/* Student Name */}
                        <td className="p-3">
                          <div className="font-bold text-slate-900">{app.studentNameBn || '—'}</div>
                          <div className="text-[10px] font-mono text-slate-500 uppercase">
                            {app.studentNameEn}
                          </div>
                        </td>

                        {/* Group */}
                        <td className="p-3 font-semibold text-slate-700">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              app.group === 'SCIENCE'
                                ? 'bg-blue-100 text-blue-800'
                                : app.group === 'HUMANITIES'
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {app.group}
                          </span>
                        </td>

                        {/* GPA */}
                        <td className="p-3 font-mono font-bold text-emerald-700">
                          {app.gpa}
                        </td>

                        {/* Mobile */}
                        <td className="p-3 font-mono text-slate-700">
                          {app.studentMobile}
                        </td>

                        {/* Status & Class Roll */}
                        <td className="p-3">
                          {app.status === 'ACCEPTED' ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                                <CheckCircle className="w-3 h-3 text-emerald-600" />
                                ভর্তি গৃহীত
                              </span>
                              <div className="text-xs font-mono font-bold text-slate-900">
                                শ্রেণি রোল: <span className="text-emerald-700">{app.classRoll}</span>
                              </div>
                            </div>
                          ) : app.status === 'EDIT_PERMITTED' ? (
                            <span className="text-[11px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">
                              সংশোধন অনুমোদিত
                            </span>
                          ) : (
                            <span className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-semibold">
                              দাখিলকৃত (যাচাই বাকি)
                            </span>
                          )}

                          {app.syncedToGoogleSheets && (
                            <div className="mt-1">
                              <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                <Check className="w-2.5 h-2.5" /> শিটে সিঙ্কড
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Sync to Google Sheets */}
                            <button
                              type="button"
                              onClick={() => handleSyncSingleApp(app)}
                              disabled={syncingAppId === app.id}
                              className={`p-1.5 rounded-lg border transition ${
                                app.syncedToGoogleSheets
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200'
                              }`}
                              title={
                                app.syncedToGoogleSheets
                                  ? 'গুগল শিটে সিঙ্ক হয়েছে (পুনরায় আপডেট করতে ক্লিক করুন)'
                                  : 'গুগল শিটে লাইভ পাঠান'
                              }
                            >
                              {syncingAppId === app.id ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                              ) : (
                                <FileSpreadsheet className="w-3.5 h-3.5" />
                              )}
                            </button>

                            {/* View / Print A4 */}
                            <button
                              type="button"
                              onClick={() => onViewApplication(app)}
                              className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-2xs"
                              title="আবেদন ফরম প্রিন্ট ও A4 PDF ডাউনলোড"
                            >
                              <Printer className="w-3.5 h-3.5 text-emerald-700" />
                              <span>প্রিন্ট / PDF</span>
                            </button>

                            {/* Accept Admission & Assign Roll */}
                            <button
                              type="button"
                              onClick={() => handleOpenAcceptModal(app)}
                              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1"
                              title="ভর্তি এক্সেপ্ট করুন ও শ্রেণি রোল দিন"
                            >
                              <Award className="w-3.5 h-3.5" />
                              <span>{app.status === 'ACCEPTED' ? 'রোল বদলান' : 'ভর্তি গ্রহণ'}</span>
                            </button>

                            {/* Grant Edit Permission */}
                            <button
                              type="button"
                              onClick={() => handleGrantEditPermission(app.id)}
                              className="p-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg transition"
                              title="শিক্ষার্থীকে সংশোধনের অনুমতি দিন"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                            </button>

                            {/* Direct Edit */}
                            <button
                              type="button"
                              onClick={() => setEditAppModal(app)}
                              className="p-1.5 bg-slate-100 hover:bg-blue-100 hover:text-blue-700 text-slate-700 rounded-lg transition"
                              title="তথ্য সরাসরি সংশোধন করুন"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete Application */}
                            <button
                              type="button"
                              onClick={() => handleDeleteApplication(app.id)}
                              className="p-1.5 bg-slate-100 hover:bg-rose-100 hover:text-rose-700 text-slate-700 rounded-lg transition"
                              title="আবেদন মুছে ফেলুন"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ELIGIBLE STUDENTS LIST (ভর্তিযোগ্য শিক্ষার্থী তালিকা) */}
      {/* ========================================================================= */}
      {adminTab === 'eligible' && (
        <div className="space-y-4">
          {/* Upload Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Upload className="w-5 h-5 text-emerald-600" />
                  ভর্তিযোগ্য শিক্ষার্থীদের প্রাথমিক তথ্য আপলোড (CSV / XLSX)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  ৬টি কলাম বিশিষ্ট এক্সেল বা সিএসভি ফাইল: "শিক্ষার্থীর নাম", "এসএসসি/দাখিল পরীক্ষার রোল নম্বর", "এসএসসি/দাখিল পরীক্ষার বোর্ড", "এসএসসি/দাখিল পাসের সন", "ভর্তিচ্ছুক বিভাগ", "শিক্ষাবর্ষ"
                </p>
              </div>

              {/* Download Template Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => downloadEligibleStudentsTemplate('xlsx')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                  নমুনা Excel টেমপ্লেট
                </button>
                <button
                  type="button"
                  onClick={() => downloadEligibleStudentsTemplate('csv')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  নমুনা CSV
                </button>
              </div>
            </div>

            {/* File Upload Trigger */}
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileUploadRef}
                type="file"
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                onChange={handleFileUpload}
                className="hidden"
                id="eligible-file-upload-input"
              />
              <button
                type="button"
                onClick={() => fileUploadRef.current?.click()}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-emerald-700/20 transition"
              >
                <Upload className="w-4 h-4" />
                ফাইল নির্বাচন ও আপলোড করুন
              </button>

              <button
                type="button"
                onClick={() =>
                  setEligibleModal({
                    mode: 'add',
                    student: {
                      academicYear: '2026-2027',
                      sscBoard: 'COMILLA',
                      passingYear: '2026',
                      group: 'HUMANITIES',
                    },
                  })
                }
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs sm:text-sm font-semibold transition"
              >
                <Plus className="w-4 h-4" />
                ম্যানুয়ালি নতুন শিক্ষার্থী যোগ করুন
              </button>
            </div>

            {/* Feedback notifications */}
            {uploadFeedback?.success && (
              <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{uploadFeedback.success}</span>
              </div>
            )}
            {uploadFeedback?.error && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{uploadFeedback.error}</span>
              </div>
            )}
          </div>

          {/* Search & Filter Bar */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={elSearch}
                  onChange={(e) => setElSearch(e.target.value)}
                  placeholder="রোল বা নাম দিয়ে তালিকা খুঁজুন..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs sm:text-sm"
                />
              </div>

              <select
                value={elGroupFilter}
                onChange={(e) => setElGroupFilter(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs sm:text-sm font-semibold focus:outline-none"
              >
                <option value="ALL">সকল বিভাগ</option>
                <option value="HUMANITIES">মানবিক (HUMANITIES)</option>
                <option value="SCIENCE">বিজ্ঞান (SCIENCE)</option>
                <option value="BUSINESS STUDIES">ব্যবসায় শিক্ষা (BUSINESS)</option>
              </select>
            </div>

            <span className="text-xs font-semibold text-slate-500">
              মোট প্রদর্শিত: {filteredEligible.length} জন
            </span>
          </div>

          {/* Eligible Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase tracking-wider text-[11px]">
                    <th className="p-3 w-12 text-center">ক্রমিক</th>
                    <th className="p-3">শিক্ষার্থীর নাম (ইংরেজিতে)</th>
                    <th className="p-3">এসএসসি রোল</th>
                    <th className="p-3">শিক্ষা বোর্ড</th>
                    <th className="p-3">পাসের সন</th>
                    <th className="p-3">বিভাগ</th>
                    <th className="p-3">শিক্ষাবর্ষ</th>
                    <th className="p-3 text-right">কার্যক্রম</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEligible.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        কোনো শিক্ষার্থী পাওয়া যায়নি।
                      </td>
                    </tr>
                  ) : (
                    filteredEligible.map((student, idx) => (
                      <tr key={student.id} className="hover:bg-slate-50 transition">
                        <td className="p-3 text-center font-mono text-slate-400">{idx + 1}</td>
                        <td className="p-3 font-mono font-bold text-slate-900 uppercase">
                          {student.studentName}
                        </td>
                        <td className="p-3 font-mono font-bold text-emerald-800">
                          {student.sscRoll}
                        </td>
                        <td className="p-3 text-slate-700">{student.sscBoard}</td>
                        <td className="p-3 font-mono text-slate-700">{student.passingYear}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              student.group === 'SCIENCE'
                                ? 'bg-blue-100 text-blue-800'
                                : student.group === 'HUMANITIES'
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {student.group}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-slate-600">{student.academicYear}</td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setEligibleModal({ mode: 'edit', student })}
                              className="p-1.5 bg-slate-100 hover:bg-blue-100 hover:text-blue-700 text-slate-700 rounded-lg transition"
                              title="সংশোধন"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteEligibleStudent(student.id)}
                              className="p-1.5 bg-slate-100 hover:bg-rose-100 hover:text-rose-700 text-slate-700 rounded-lg transition"
                              title="মুছুন"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: GOOGLE SHEETS LIVE SYNC (গুগল শিট লাইভ সিঙ্ক) */}
      {/* ========================================================================= */}
      {adminTab === 'sheets' && (
        <GoogleSheetsSyncPanel
          applications={applications}
          onApplicationsUpdated={(updated) => {
            saveApplications(updated);
            setApplications(updated);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* TAB 4: SETTINGS & SECURITY (নিরাপত্তা ও পাসওয়ার্ড পরিবর্তন) */}
      {/* ========================================================================= */}
      {adminTab === 'settings' && (
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Password Change Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 mb-2 flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-emerald-600" />
              এডমিন পাসওয়ার্ড পরিবর্তন করুন
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              ভর্তি পোর্টালের নিরাপত্তার জন্য নতুন সুরক্ষিত পাসওয়ার্ড নির্ধারণ করুন।
            </p>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  নতুন পাসওয়ার্ড (New Password):
                </label>
                <input
                  type="text"
                  required
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  placeholder="কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড..."
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-sm"
                />
              </div>

              {passwordChangeSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে!</span>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition"
                >
                  পাসওয়ার্ড সংরক্ষণ করুন
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetAdminPassword();
                    setPasswordChangeSuccess(true);
                    setNewPasswordInput('');
                    setTimeout(() => setPasswordChangeSuccess(false), 3000);
                  }}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
                >
                  মূল পাসওয়ার্ডে (kmdc@admin2026) রিসেট করুন
                </button>
              </div>
            </form>
          </div>

          {/* College Information Card */}
          <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 text-xs space-y-2">
            <h4 className="font-bold text-slate-800 text-sm mb-2">কলেজের তথ্য ও যোগাযোগের বিবরণী:</h4>
            <p><strong>নাম:</strong> কসবা মহিলা ডিগ্রি কলেজ (KASBA MOHILA DEGREE COLLEGE)</p>
            <p><strong>EIIN:</strong> 103379</p>
            <p><strong>ঠিকানা:</strong> আখাউড়া রোড, কসবা পৌরসভা, ব্রাহ্মণবাড়িয়া, ৩৪৬০</p>
            <p><strong>হেল্পলাইন:</strong> 01309103379, 01822721111</p>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: ACCEPT ADMISSION & ASSIGN CLASS ROLL */}
      {/* ========================================================================= */}
      {acceptModalApp && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">ভর্তি চূড়ান্ত অনুমোদন</h3>
                <p className="text-xs text-slate-500">
                  শিক্ষার্থীকে শ্রেণি রোল বরাদ্দ করে ভর্তি এক্সেপ্ট করুন
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs mb-4 space-y-1">
              <p><strong>শিক্ষার্থীর নাম:</strong> {acceptModalApp.studentNameBn} ({acceptModalApp.studentNameEn})</p>
              <p><strong>ট্র্যাকিং আইডি:</strong> <span className="font-mono text-emerald-800 font-bold">{acceptModalApp.trackingId}</span></p>
              <p><strong>বিভাগ:</strong> {acceptModalApp.group}</p>
              <p><strong>এসএসসি রোল:</strong> {acceptModalApp.sscRoll}</p>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                বরাদ্ধকৃত শ্রেণি রোল নম্বর (Class Roll) <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                autoFocus
                required
                id="assign-class-roll-input"
                value={classRollInput}
                onChange={(e) => setClassRollInput(e.target.value)}
                placeholder="যেমন: 101, 102..."
                className="w-full px-3.5 py-2.5 rounded-lg border-2 border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-base font-mono font-bold"
              />
              <span className="text-[11px] text-slate-400 block mt-1">
                এই শ্রেণি রোল নম্বরটি শিক্ষার্থীর চূড়ান্ত ভর্তির তথ্যে সংরক্ষিত হবে।
              </span>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAcceptModalApp(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
              >
                বাতিল
              </button>
              <button
                type="button"
                id="save-class-roll-btn"
                onClick={handleSaveAdmissionAccept}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm"
              >
                ভর্তি সংরক্ষণ করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: ADD / EDIT ELIGIBLE STUDENT */}
      {/* ========================================================================= */}
      {eligibleModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 my-auto animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              {eligibleModal.mode === 'add' ? 'নতুন ভর্তিযোগ্য শিক্ষার্থী যোগ করুন' : 'শিক্ষার্থীর তথ্য সংশোধন'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              ভর্তি সার্ভারে শিক্ষার্থী সংক্রান্ত প্রাথমিক তথ্য
            </p>

            <form onSubmit={handleSaveEligibleStudent} className="space-y-3 text-xs sm:text-sm">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  শিক্ষার্থীর নাম (ইংরেজিতে CAPITAL) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={eligibleModal.student.studentName || ''}
                  onChange={(e) =>
                    setEligibleModal({
                      ...eligibleModal,
                      student: { ...eligibleModal.student, studentName: e.target.value.toUpperCase() },
                    })
                  }
                  placeholder="STUDENT NAME IN CAPITAL"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-sm uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    এসএসসি রোল নম্বর <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={eligibleModal.student.sscRoll || ''}
                    onChange={(e) =>
                      setEligibleModal({
                        ...eligibleModal,
                        student: { ...eligibleModal.student, sscRoll: e.target.value.replace(/\D/g, '') },
                      })
                    }
                    placeholder="রোল নম্বর"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    শিক্ষা বোর্ড <span className="text-rose-600">*</span>
                  </label>
                  <select
                    value={eligibleModal.student.sscBoard || 'COMILLA'}
                    onChange={(e) =>
                      setEligibleModal({
                        ...eligibleModal,
                        student: { ...eligibleModal.student, sscBoard: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                  >
                    {EDUCATION_BOARDS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    ভর্তিচ্ছুক বিভাগ <span className="text-rose-600">*</span>
                  </label>
                  <select
                    value={eligibleModal.student.group || 'HUMANITIES'}
                    onChange={(e) =>
                      setEligibleModal({
                        ...eligibleModal,
                        student: { ...eligibleModal.student, group: e.target.value as StudyGroup },
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold"
                  >
                    <option value="HUMANITIES">HUMANITIES</option>
                    <option value="SCIENCE">SCIENCE</option>
                    <option value="BUSINESS STUDIES">BUSINESS STUDIES</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">পাসের সন</label>
                  <select
                    value={eligibleModal.student.passingYear || '2026'}
                    onChange={(e) =>
                      setEligibleModal({
                        ...eligibleModal,
                        student: { ...eligibleModal.student, passingYear: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono"
                  >
                    {PASSING_YEARS.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">শিক্ষাবর্ষ</label>
                <input
                  type="text"
                  value={eligibleModal.student.academicYear || '2026-2027'}
                  onChange={(e) =>
                    setEligibleModal({
                      ...eligibleModal,
                      student: { ...eligibleModal.student, academicYear: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEligibleModal(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-semibold"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-sm"
                >
                  সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: DIRECT EDIT APPLICATION */}
      {/* ========================================================================= */}
      {editAppModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 my-auto animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              আবেদনপত্র সরাসরি সংশোধন (এডমিন)
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              ট্র্যাকিং আইডি: <span className="font-mono font-bold text-emerald-800">{editAppModal.trackingId}</span>
            </p>

            <form onSubmit={handleSaveEditedApplication} className="space-y-4 text-xs sm:text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">নাম (বাংলায়)</label>
                  <input
                    type="text"
                    value={editAppModal.studentNameBn}
                    onChange={(e) => setEditAppModal({ ...editAppModal, studentNameBn: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">নাম (ইংরেজিতে)</label>
                  <input
                    type="text"
                    value={editAppModal.studentNameEn}
                    onChange={(e) => setEditAppModal({ ...editAppModal, studentNameEn: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">এসএসসি রেজিঃ</label>
                  <input
                    type="text"
                    value={editAppModal.sscReg}
                    onChange={(e) => setEditAppModal({ ...editAppModal, sscReg: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">প্রাপ্ত GPA</label>
                  <input
                    type="text"
                    value={editAppModal.gpa}
                    onChange={(e) => setEditAppModal({ ...editAppModal, gpa: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">মোবাইল নম্বর</label>
                  <input
                    type="text"
                    value={editAppModal.studentMobile}
                    onChange={(e) => setEditAppModal({ ...editAppModal, studentMobile: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">পিতার নাম (বাংলা)</label>
                  <input
                    type="text"
                    value={editAppModal.fatherNameBn}
                    onChange={(e) => setEditAppModal({ ...editAppModal, fatherNameBn: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">পিতার মোবাইল</label>
                  <input
                    type="text"
                    value={editAppModal.fatherMobile}
                    onChange={(e) => setEditAppModal({ ...editAppModal, fatherMobile: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">মাতার নাম (বাংলা)</label>
                  <input
                    type="text"
                    value={editAppModal.motherNameBn}
                    onChange={(e) => setEditAppModal({ ...editAppModal, motherNameBn: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">মাতার মোবাইল</label>
                  <input
                    type="text"
                    value={editAppModal.motherMobile}
                    onChange={(e) => setEditAppModal({ ...editAppModal, motherMobile: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">বর্তমান ঠিকানা</label>
                <textarea
                  rows={2}
                  value={editAppModal.presentAddress}
                  onChange={(e) => setEditAppModal({ ...editAppModal, presentAddress: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditAppModal(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-semibold"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-sm"
                >
                  আপডেট সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
