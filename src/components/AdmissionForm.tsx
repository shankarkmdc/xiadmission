import React, { useState } from 'react';
import { AdmissionApplication, EligibleStudent, StudyGroup } from '../types';
import { PhotoUploader } from './PhotoUploader';
import { SubjectSelector } from './SubjectSelector';
import { generateTrackingId, getApplications, saveApplications, saveSingleApplicationToServer } from '../services/storage';
import { sendApplicationToGoogleSheets, getGoogleSheetsConfig } from '../services/googleSheetsService';
import { Eye, Send, ArrowLeft, CheckCircle, AlertCircle, Edit3, UserCheck } from 'lucide-react';

interface AdmissionFormProps {
  eligibleStudent: EligibleStudent;
  existingApplication?: AdmissionApplication;
  onSubmitted: (application: AdmissionApplication) => void;
  onCancel: () => void;
}

export const AdmissionForm: React.FC<AdmissionFormProps> = ({
  eligibleStudent,
  existingApplication,
  onSubmitted,
  onCancel,
}) => {
  // Form State
  const [photoBase64, setPhotoBase64] = useState<string>(existingApplication?.photoBase64 || '');
  const [sscReg, setSscReg] = useState<string>(existingApplication?.sscReg || '');
  const [gpa, setGpa] = useState<string>(existingApplication?.gpa || '');
  const [studentNameBn, setStudentNameBn] = useState<string>(existingApplication?.studentNameBn || '');
  const [studentNameEn, setStudentNameEn] = useState<string>(
    existingApplication?.studentNameEn || eligibleStudent.studentName.toUpperCase()
  );
  const [studentMobile, setStudentMobile] = useState<string>(existingApplication?.studentMobile || '');

  // Parents
  const [fatherNameBn, setFatherNameBn] = useState<string>(existingApplication?.fatherNameBn || '');
  const [fatherNameEn, setFatherNameEn] = useState<string>(existingApplication?.fatherNameEn || '');
  const [fatherMobile, setFatherMobile] = useState<string>(existingApplication?.fatherMobile || '');

  const [motherNameBn, setMotherNameBn] = useState<string>(existingApplication?.motherNameBn || '');
  const [motherNameEn, setMotherNameEn] = useState<string>(existingApplication?.motherNameEn || '');
  const [motherMobile, setMotherMobile] = useState<string>(existingApplication?.motherMobile || '');

  // Address
  const [presentAddress, setPresentAddress] = useState<string>(existingApplication?.presentAddress || '');
  const [permanentAddress, setPermanentAddress] = useState<string>(existingApplication?.permanentAddress || '');
  const [sameAddress, setSameAddress] = useState<boolean>(false);

  // Subject Selection
  const [subjectState, setSubjectState] = useState({
    compulsory: ['বাংলা', 'ইংরেজি', 'তথ্য ও যোগাযোগ প্রযুক্তি'],
    elective4: existingApplication?.electiveSubject4 || '',
    elective5: existingApplication?.electiveSubject5 || '',
    elective6: existingApplication?.electiveSubject6 || '',
    optional7: existingApplication?.optionalSubject7 || '',
  });

  // Modal / Preview state
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Handle same address toggle
  const handleSameAddressToggle = (checked: boolean) => {
    setSameAddress(checked);
    if (checked) {
      setPermanentAddress(presentAddress);
    }
  };

  const validateForm = (): boolean => {
    setValidationError(null);

    if (!photoBase64) {
      setValidationError('অনুগ্রহ করে শিক্ষার্থীর পাসপোর্ট সাইজ ছবি (২৪০x৩০০ px) আপলোড করুন।');
      return false;
    }

    if (!sscReg.trim() || sscReg.trim().length < 6) {
      setValidationError('অনুগ্রহ করে সঠিক এসএসসি/দাখিল রেজিস্ট্রেশন নম্বর ইনপুট দিন।');
      return false;
    }

    const gpaNum = parseFloat(gpa);
    if (!gpa || isNaN(gpaNum) || gpaNum < 1.0 || gpaNum > 5.0) {
      setValidationError('প্রাপ্ত GPA অবশ্যই ১.০০ থেকে ৫.০০ এর মধ্যে হতে হবে।');
      return false;
    }

    if (!studentNameBn.trim()) {
      setValidationError('শিক্ষার্থীর নাম বাংলায় অবশ্যই প্রদান করতে হবে।');
      return false;
    }

    if (!studentNameEn.trim()) {
      setValidationError('শিক্ষার্থীর নাম ইংরেজিতে অবশ্যই প্রদান করতে হবে।');
      return false;
    }

    if (!studentMobile.trim() || !/^01[3-9]\d{8}$/.test(studentMobile.trim())) {
      setValidationError('সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন (যেমন: 01712345678), যাতে SMS পৌঁছাতে পারে।');
      return false;
    }

    if (!fatherNameBn.trim() || !fatherNameEn.trim()) {
      setValidationError('পিতার নাম বাংলা ও ইংরেজিতে প্রদান করুন।');
      return false;
    }

    if (!motherNameBn.trim() || !motherNameEn.trim()) {
      setValidationError('মাতার নাম বাংলা ও ইংরেজিতে প্রদান করুন।');
      return false;
    }

    if (!presentAddress.trim() || !permanentAddress.trim()) {
      setValidationError('বর্তমান ও স্থায়ী ঠিকানা সম্পূর্ণ লিখুন।');
      return false;
    }

    // Validate subjects
    if (!subjectState.elective4 || !subjectState.elective5 || !subjectState.elective6 || !subjectState.optional7) {
      setValidationError('অনুগ্রহ করে সকল নির্বাচিত বিষয় ও ৪র্থ/ঐচ্ছিক বিষয় নির্বাচন করুন।');
      return false;
    }

    // Science rule check: subject 6 and 7 cannot be same
    if (eligibleStudent.group === 'SCIENCE') {
      if (subjectState.elective6 === subjectState.optional7) {
        setValidationError('বিজ্ঞান বিভাগে ৬ নম্বর বিষয় এবং ৭ নম্বর ঐচ্ছিক বিষয় একই হতে পারবে না!');
        return false;
      }
    }

    return true;
  };

  const handleOpenPreview = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      setShowPreviewModal(true);
    }
  };

  const handleFinalSubmit = async () => {
    setIsSubmitting(true);

    try {
      const allApps = getApplications();
      let trackingId = existingApplication?.trackingId;

      if (!trackingId) {
        trackingId = generateTrackingId(eligibleStudent.group, eligibleStudent.academicYear);
      }

      const applicationData: AdmissionApplication = {
        id: existingApplication?.id || `app-${Date.now()}`,
        trackingId,
        academicYear: eligibleStudent.academicYear,
        group: eligibleStudent.group,
        sscRoll: eligibleStudent.sscRoll,
        sscReg: sscReg.trim(),
        sscBoard: eligibleStudent.sscBoard,
        passingYear: eligibleStudent.passingYear,
        gpa: Number(gpa).toFixed(2),
        studentNameBn: studentNameBn.trim(),
        studentNameEn: studentNameEn.trim().toUpperCase(),
        studentMobile: studentMobile.trim(),
        photoBase64,
        fatherNameBn: fatherNameBn.trim(),
        fatherNameEn: fatherNameEn.trim().toUpperCase(),
        fatherMobile: fatherMobile.trim(),
        motherNameBn: motherNameBn.trim(),
        motherNameEn: motherNameEn.trim().toUpperCase(),
        motherMobile: motherMobile.trim(),
        presentAddress: presentAddress.trim(),
        permanentAddress: permanentAddress.trim(),
        compulsorySubjects: ['বাংলা', 'ইংরেজি', 'তথ্য ও যোগাযোগ প্রযুক্তি'],
        electiveSubject4: subjectState.elective4,
        electiveSubject5: subjectState.elective5,
        electiveSubject6: subjectState.elective6,
        optionalSubject7: subjectState.optional7,
        submittedAt: existingApplication?.submittedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: existingApplication?.status === 'EDIT_PERMITTED' ? 'SUBMITTED' : (existingApplication?.status || 'SUBMITTED'),
        classRoll: existingApplication?.classRoll || '',
        editPermissionGiven: false,
      };

      // 1. Immediately save application to Central Server database so Admin sees it across all devices
      await saveSingleApplicationToServer(applicationData);

      // 2. Live sync to Google Sheets (via centralized server proxy)
      try {
        const syncResult = await sendApplicationToGoogleSheets(applicationData);
        if (syncResult.success) {
          applicationData.syncedToGoogleSheets = true;
          applicationData.lastSyncedAt = new Date().toISOString();
          // Re-update server with sync flags
          saveSingleApplicationToServer(applicationData).catch(() => {});
        }
      } catch (syncErr) {
        console.warn('Google Sheets live sync notice:', syncErr);
      }

      setShowPreviewModal(false);
      onSubmitted(applicationData);
    } catch (err) {
      console.error(err);
      setValidationError('আবেদন সংরক্ষণে ত্রুটি দেখা দিয়েছে। আবার চেষ্টা করুন।');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      {/* Header card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
              {eligibleStudent.academicYear} শিক্ষাবর্ষ
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
              একাদশ শ্রেণিতে ভর্তির আবেদন ফরম
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              সকল তথ্য সতর্কতার সাথে পূরণ করুন। ভুল তথ্যের কারণে ভর্তি বাতিল হতে পারে।
            </p>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
          >
            <ArrowLeft className="w-4 h-4" />
            ফিরে যান
          </button>
        </div>

        {/* Auto-filled Verified Academic Badges */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200/80 text-xs">
          <div>
            <span className="text-slate-500 block text-[11px]">এসএসসি/দাখিল রোল:</span>
            <span className="font-bold text-slate-900 font-mono text-sm">
              {eligibleStudent.sscRoll}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">ভর্তিচ্ছুক বিভাগ:</span>
            <span className="font-bold text-emerald-900 text-sm">
              {eligibleStudent.group}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">শিক্ষা বোর্ড:</span>
            <span className="font-bold text-slate-800">
              {eligibleStudent.sscBoard}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">পাসের সন:</span>
            <span className="font-bold text-slate-800 font-mono">
              {eligibleStudent.passingYear}
            </span>
          </div>
        </div>
      </div>

      <form onSubmit={handleOpenPreview} className="space-y-6">
        {/* Section 1: Photo Upload */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <h3 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center font-bold">
              ১
            </span>
            শিক্ষার্থীর পাসপোর্ট সাইজ ছবি (২৪০ x ৩০০ পিক্সেল)
          </h3>
          <PhotoUploader value={photoBase64} onChange={setPhotoBase64} />
        </div>

        {/* Section 2: SSC Academic Details (Reg & GPA) */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center font-bold">
              ২
            </span>
            এসএসসি / দাখিল পরীক্ষার তথ্য
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                এসএসসি/দাখিল রেজিস্ট্রেশন নম্বর <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                value={sscReg}
                onChange={(e) => setSscReg(e.target.value.replace(/\D/g, ''))}
                placeholder="যেমন: 1712345678"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-sm"
              />
              <span className="text-[11px] text-slate-400">এডমিট কার্ড বা রেজিস্ট্রেশন কার্ড অনুযায়ী</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                প্রাপ্ত জিপিএ (GPA) <span className="text-rose-600">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="1.00"
                max="5.00"
                required
                value={gpa}
                onChange={(e) => setGpa(e.target.value)}
                placeholder="যেমন: 5.00"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-sm font-bold"
              />
              <span className="text-[11px] text-slate-400">সর্বোচ্চ ৫.০০ এর মধ্যে</span>
            </div>
          </div>
        </div>

        {/* Section 3: Student Personal & Contact Info */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center font-bold">
              ৩
            </span>
            শিক্ষার্থীর নাম ও যোগাযোগের তথ্য
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                শিক্ষার্থীর নাম (বাংলায়) <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                value={studentNameBn}
                onChange={(e) => setStudentNameBn(e.target.value)}
                placeholder="বাংলায় স্পষ্ট অক্ষরে লিখুন"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                শিক্ষার্থীর নাম ইংরেজিতে (CAPITAL LETTERS) <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                value={studentNameEn}
                onChange={(e) => setStudentNameEn(e.target.value.toUpperCase())}
                placeholder="IN CAPITAL LETTERS"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-sm uppercase font-semibold"
              />
              <span className="text-[11px] text-slate-400">সার্ভার থেকে স্বয়ংক্রিয়ভাবে ক্যাপিটাল লেটারে সংরক্ষিত</span>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                শিক্ষার্থীর মোবাইল নম্বর (যে নম্বরে SMS পেতে ইচ্ছুক) <span className="text-rose-600">*</span>
              </label>
              <input
                type="tel"
                required
                value={studentMobile}
                onChange={(e) => setStudentMobile(e.target.value.replace(/\D/g, ''))}
                maxLength={11}
                placeholder="যেমন: 01822721111"
                className="w-full sm:w-1/2 px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-sm"
              />
              <span className="text-[11px] text-slate-400 block mt-1">
                ভর্তি সংক্রান্ত সকল নোটিশ ও আপডেট এই নম্বরে SMS এর মাধ্যমে পাঠানো হবে।
              </span>
            </div>
          </div>
        </div>

        {/* Section 4: Parents Information */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center font-bold">
              ৪
            </span>
            পিতা ও মাতার তথ্যাবলী
          </h3>

          {/* Father */}
          <div className="border-b border-slate-100 pb-4 mb-4">
            <h4 className="text-xs font-bold uppercase text-slate-500 mb-3 tracking-wider">
              পিতার তথ্য (Father's Details)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  পিতার নাম (বাংলায়) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={fatherNameBn}
                  onChange={(e) => setFatherNameBn(e.target.value)}
                  placeholder="বাংলায় নাম"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  পিতার নাম (ইংরেজিতে CAPITAL) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={fatherNameEn}
                  onChange={(e) => setFatherNameEn(e.target.value.toUpperCase())}
                  placeholder="FATHER'S NAME IN CAPITAL"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-sm uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  পিতার মোবাইল নম্বর
                </label>
                <input
                  type="tel"
                  value={fatherMobile}
                  onChange={(e) => setFatherMobile(e.target.value.replace(/\D/g, ''))}
                  maxLength={11}
                  placeholder="01XXXXXXXXX"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-sm"
                />
              </div>
            </div>
          </div>

          {/* Mother */}
          <div>
            <h4 className="text-xs font-bold uppercase text-slate-500 mb-3 tracking-wider">
              মাতার তথ্য (Mother's Details)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  মাতার নাম (বাংলায়) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={motherNameBn}
                  onChange={(e) => setMotherNameBn(e.target.value)}
                  placeholder="বাংলায় নাম"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  মাতার নাম (ইংরেজিতে CAPITAL) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={motherNameEn}
                  onChange={(e) => setMotherNameEn(e.target.value.toUpperCase())}
                  placeholder="MOTHER'S NAME IN CAPITAL"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-sm uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  মাতার মোবাইল নম্বর
                </label>
                <input
                  type="tel"
                  value={motherMobile}
                  onChange={(e) => setMotherMobile(e.target.value.replace(/\D/g, ''))}
                  maxLength={11}
                  placeholder="01XXXXXXXXX"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 5: Address */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center font-bold">
                ৫
              </span>
              ঠিকানা (যোগাযোগের বিবরণী)
            </h3>

            <label className="flex items-center gap-2 text-xs font-semibold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full cursor-pointer hover:bg-emerald-100 transition">
              <input
                type="checkbox"
                checked={sameAddress}
                onChange={(e) => handleSameAddressToggle(e.target.checked)}
                className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 rounded"
              />
              <span>বর্তমান ও স্থায়ী ঠিকানা একই</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                বর্তমান ঠিকানা <span className="text-rose-600">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={presentAddress}
                onChange={(e) => {
                  setPresentAddress(e.target.value);
                  if (sameAddress) setPermanentAddress(e.target.value);
                }}
                placeholder="গ্রাম/বাড়ি নং, ডাকঘর, উপজেলা/থানা, জেলা"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                স্থায়ী ঠিকানা <span className="text-rose-600">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={permanentAddress}
                onChange={(e) => setPermanentAddress(e.target.value)}
                placeholder="গ্রাম/বাড়ি নং, ডাকঘর, উপজেলা/থানা, জেলা"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm resize-none"
              />
            </div>
          </div>
        </div>

        {/* Section 6: Subject Selection */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center font-bold">
              ৬
            </span>
            বিষয় নির্বাচন অংশ (Subject Selection)
          </h3>
          <SubjectSelector
            group={eligibleStudent.group}
            values={subjectState}
            onChange={setSubjectState}
          />
        </div>

        {/* Validation error notice */}
        {validationError && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs sm:text-sm font-medium">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Preview & Submit Action */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            * 'প্রিভিউ দেখুন' বাটনে ক্লিক করে পূরণকৃত সকল তথ্য যাচাই করতে পারবেন।
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-sm font-semibold transition"
            >
              বাতিল
            </button>
            <button
              type="submit"
              id="preview-application-btn"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-sm font-bold shadow-md shadow-emerald-700/20 transition"
            >
              <Eye className="w-4 h-4" />
              প্রিভিউ দেখুন ও যাচাই করুন
            </button>
          </div>
        </div>
      </form>

      {/* PREVIEW MODAL */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-emerald-900 to-teal-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-lg">ভর্তি আবেদন তথ্যের প্রিভিউ</h3>
              </div>
              <span className="text-xs bg-amber-400 text-emerald-950 font-bold px-2.5 py-0.5 rounded-full">
                যাচাই করুন
              </span>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs sm:text-sm">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <span>
                  দয়া করে আপনার প্রদত্ত তথ্যগুলো সাবধানে দেখে নিন। একবার ফাইনাল সাবমিট দিলে পরবর্তীতে সংশোধনের জন্য কলেজ কর্তৃপক্ষের অনুমোদন লাগবে।
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div
                  className="w-24 h-30 rounded-lg overflow-hidden border border-slate-300 shrink-0 bg-white"
                  style={{ width: '96px', height: '120px' }}
                >
                  <img src={photoBase64} alt="Preview" className="w-full h-full object-cover" />
                </div>
                <div className="space-y-1 text-center sm:text-left">
                  <h4 className="text-base font-bold text-slate-900">{studentNameBn}</h4>
                  <p className="font-mono font-bold text-slate-700 uppercase">{studentNameEn}</p>
                  <p className="text-xs text-slate-500">
                    বিভাগ: <span className="font-bold text-emerald-800">{eligibleStudent.group}</span> • সেশন:{' '}
                    {eligibleStudent.academicYear}
                  </p>
                  <p className="text-xs text-slate-600 font-mono">
                    মোবাইল (SMS): <span className="font-bold">{studentMobile}</span>
                  </p>
                </div>
              </div>

              {/* Detail Tables */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="border border-slate-200 rounded-lg p-3 bg-white">
                  <span className="text-[11px] font-bold text-slate-400 uppercase block mb-1">
                    এসএসসি তথ্য
                  </span>
                  <p><strong>রোল:</strong> {eligibleStudent.sscRoll}</p>
                  <p><strong>রেজিঃ নম্বর:</strong> {sscReg}</p>
                  <p><strong>বোর্ড:</strong> {eligibleStudent.sscBoard}</p>
                  <p><strong>পাসের সন:</strong> {eligibleStudent.passingYear}</p>
                  <p><strong>প্রাপ্ত GPA:</strong> <span className="text-emerald-700 font-bold">{gpa}</span></p>
                </div>

                <div className="border border-slate-200 rounded-lg p-3 bg-white">
                  <span className="text-[11px] font-bold text-slate-400 uppercase block mb-1">
                    অভিভাবকের তথ্য
                  </span>
                  <p><strong>পিতা:</strong> {fatherNameBn} ({fatherNameEn})</p>
                  <p><strong>পিতার মোবাইল:</strong> {fatherMobile || '—'}</p>
                  <p><strong>মাতা:</strong> {motherNameBn} ({motherNameEn})</p>
                  <p><strong>মাতার মোবাইল:</strong> {motherMobile || '—'}</p>
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg p-3 bg-white">
                <span className="text-[11px] font-bold text-slate-400 uppercase block mb-1">
                  ঠিকানা
                </span>
                <p><strong>বর্তমান ঠিকানা:</strong> {presentAddress}</p>
                <p><strong>স্থায়ী ঠিকানা:</strong> {permanentAddress}</p>
              </div>

              <div className="border border-slate-200 rounded-lg p-3 bg-white">
                <span className="text-[11px] font-bold text-slate-400 uppercase block mb-1.5">
                  নির্বাচিত বিষয়সমূহ ছক
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[10px] text-slate-400 block">আবশ্যিক বিষয়</span>
                    <span className="font-semibold text-slate-800">বাংলা, ইংরেজি, ICT</span>
                  </div>
                  <div className="p-2 bg-emerald-50/60 rounded border border-emerald-200">
                    <span className="text-[10px] text-emerald-800 block">নির্বাচনিক ৪ ও ৫</span>
                    <span className="font-semibold text-slate-800">{subjectState.elective4}, {subjectState.elective5}</span>
                  </div>
                  <div className="p-2 bg-emerald-50/60 rounded border border-emerald-200">
                    <span className="text-[10px] text-emerald-800 block">নির্বাচনিক ৬</span>
                    <span className="font-semibold text-slate-800">{subjectState.elective6}</span>
                  </div>
                  <div className="p-2 bg-amber-50 rounded border border-amber-300">
                    <span className="text-[10px] text-amber-800 block">৪র্থ/ঐচ্ছিক বিষয় (৭)</span>
                    <span className="font-bold text-amber-950">{subjectState.optional7}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            {validationError && (
              <div className="px-6 py-2 bg-rose-50 border-t border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{validationError}</span>
              </div>
            )}
            <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs sm:text-sm font-semibold transition"
              >
                <Edit3 className="w-4 h-4" />
                সংশোধন করুন
              </button>

              <button
                type="button"
                id="final-submit-admission-btn"
                onClick={handleFinalSubmit}
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-emerald-700/20 transition disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {isSubmitting ? 'সাবমিট হচ্ছে...' : 'সব ঠিক আছে, ফাইনাল সাবমিট দিন'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
