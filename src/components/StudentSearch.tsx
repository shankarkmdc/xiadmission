import React, { useState, useEffect } from 'react';
import { EligibleStudent, AdmissionApplication } from '../types';
import { findEligibleStudentByRoll, findApplicationByRoll, getEligibleStudents, fetchServerApplications } from '../services/storage';
import { Search, Sparkles, CheckCircle2, AlertCircle, FileText, Download, ArrowRight, RefreshCw, KeyRound, ShieldAlert } from 'lucide-react';

interface StudentSearchProps {
  onStartAdmission: (student: EligibleStudent, application?: AdmissionApplication) => void;
  onViewApplication: (application: AdmissionApplication) => void;
}

export const StudentSearch: React.FC<StudentSearchProps> = ({
  onStartAdmission,
  onViewApplication,
}) => {
  const [rollInput, setRollInput] = useState<string>('');
  const [searched, setSearched] = useState<boolean>(false);
  const [student, setStudent] = useState<EligibleStudent | null>(null);
  const [application, setApplication] = useState<AdmissionApplication | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchServerApplications().catch(() => {});
  }, []);

  const eligibleList = getEligibleStudents();

  const handleSearch = async (rollToSearch?: string) => {
    const targetRoll = (rollToSearch || rollInput).trim();
    if (!targetRoll) {
      setErrorMsg('অনুগ্রহ করে আপনার এসএসসি/দাখিল পরীক্ষার রোল নম্বর লিখুন।');
      return;
    }

    setErrorMsg(null);
    setSearched(true);

    const foundStudent = findEligibleStudentByRoll(targetRoll);
    if (!foundStudent) {
      setStudent(null);
      setApplication(null);
      setErrorMsg(
        `দুঃখিত! রোল নম্বর "${targetRoll}" ২০২৬-২০২৭ শিক্ষাবর্ষের ভর্তিযোগ্য তালিকায় পাওয়া যায়নি। রোল নম্বর সঠিক কিনা যাচাই করুন অথবা কলেজ হেল্পলাইনে যোগাযোগ করুন।`
      );
      return;
    }

    setStudent(foundStudent);
    let existingApp = findApplicationByRoll(targetRoll);
    if (!existingApp) {
      const serverApps = await fetchServerApplications();
      existingApp = serverApps.find((a) => a.sscRoll.trim() === targetRoll);
    }
    setApplication(existingApp || null);
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* Search Card */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-md">
        <div className="text-center mb-6">
          <span className="inline-block bg-emerald-100 text-emerald-800 font-bold text-xs px-3 py-1 rounded-full uppercase tracking-wider mb-2">
            একাদশ শ্রেণি ভর্তি ২০২৬-২০২৭
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            ভর্তিযোগ্যতা যাচাই ও আবেদন ফরম
          </h2>
          <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
            আপনার এসএসসি/দাখিল পরীক্ষার রোল নম্বর দিয়ে সার্চ করে ভর্তি ফরম পূরণ করুন বা পূর্বের আবেদনের কপি ডাউনলোড করুন।
          </p>
        </div>

        {/* Search Input Box */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
          className="flex flex-col sm:flex-row items-stretch gap-2.5 max-w-xl mx-auto"
        >
          <div className="relative flex-1">
            <input
              type="text"
              id="ssc-roll-search-input"
              value={rollInput}
              onChange={(e) => {
                setRollInput(e.target.value.replace(/\D/g, ''));
                if (searched) setSearched(false);
              }}
              placeholder="এসএসসি/দাখিল রোল নম্বর লিখুন..."
              className="w-full pl-4 pr-10 py-3.5 rounded-xl border-2 border-slate-300 focus:border-emerald-600 focus:outline-none text-base font-mono font-bold tracking-wider placeholder:font-sans placeholder:font-normal placeholder:tracking-normal shadow-xs"
            />
            {rollInput && (
              <button
                type="button"
                onClick={() => {
                  setRollInput('');
                  setSearched(false);
                  setStudent(null);
                  setApplication(null);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-semibold p-1"
              >
                মুছুন
              </button>
            )}
          </div>

          <button
            type="submit"
            id="ssc-roll-search-submit-btn"
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-sm font-bold shadow-md shadow-emerald-700/20 transition shrink-0"
          >
            <Search className="w-4 h-4" />
            অনুসন্ধান করুন
          </button>
        </form>

        {/* Total Eligible Students Indicator */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-500">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>কসবা মহিলা ডিগ্রি কলেজ একাদশ শ্রেণি ভর্তিযোগ্য শিক্ষার্থী: <strong className="text-emerald-700 font-bold">{eligibleList.length} জন</strong></span>
        </div>
      </div>

      {/* Error State */}
      {errorMsg && (
        <div className="mt-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-800 text-xs sm:text-sm animate-in fade-in">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">রোল নম্বর পাওয়া যায়নি</p>
            <p className="text-rose-700 leading-relaxed">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* SUCCESS: Eligible Student Found */}
      {student && (
        <div className="mt-6 space-y-4 animate-in fade-in duration-200">
          {/* Case 1: Application already submitted and NOT marked as edit permitted */}
          {application && application.status !== 'EDIT_PERMITTED' ? (
            <div className="bg-white rounded-2xl border-2 border-emerald-500/80 p-6 shadow-md">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <div>
                    <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
                      আবেদন ইতোমধ্যেই দাখিলকৃত
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                      অভিনন্দন, {application.studentNameBn || student.studentName}!
                    </h3>
                    <p className="text-xs text-slate-500 font-mono">
                      ট্র্যাকিং আইডি: <span className="font-bold text-emerald-800">{application.trackingId}</span> • রোল: {application.sscRoll}
                    </p>
                  </div>
                </div>

                {application.status === 'ACCEPTED' ? (
                  <div className="bg-emerald-600 text-white px-3.5 py-1.5 rounded-xl text-center shadow-xs">
                    <span className="text-[10px] uppercase font-bold tracking-wider block opacity-90">
                      ভর্তি চূড়ান্ত গৃহীত
                    </span>
                    <span className="text-sm font-black font-mono">
                      শ্রেণি রোল: {application.classRoll || 'বরাদ্ধকৃত'}
                    </span>
                  </div>
                ) : (
                  <div className="bg-amber-100 text-amber-900 px-3.5 py-1.5 rounded-xl text-center border border-amber-200">
                    <span className="text-[10px] uppercase font-bold tracking-wider block text-amber-700">
                      আবেদনের অবস্থা
                    </span>
                    <span className="text-xs font-bold">
                      কলেজে জমা ও যাচাই প্রক্রিয়াধীন
                    </span>
                  </div>
                )}
              </div>

              {/* Single Submission Notice */}
              <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  একজন শিক্ষার্থী কেবল একবারই আবেদন দাখিল করতে পারবে। যদি কোনো তথ্য সংশোধনের প্রয়োজন হয়, তবে কলেজ এডমিনের অনুমোদন লাগবে।
                </span>
              </div>

              {/* Action Buttons */}
              <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  id="view-submitted-application-btn"
                  onClick={() => onViewApplication(application)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-emerald-700/20 transition"
                >
                  <Download className="w-4 h-4" />
                  আবেদন ফরম দেখুন ও A4 PDF ডাউনলোড করুন
                </button>
              </div>
            </div>
          ) : application && application.status === 'EDIT_PERMITTED' ? (
            /* Case 2: College Admin Approved Edit Permission */
            <div className="bg-amber-50 rounded-2xl border-2 border-amber-400 p-6 shadow-md">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-amber-200 text-amber-800 flex items-center justify-center shrink-0">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded">
                    সংশোধনের অনুমতি প্রদান করা হয়েছে
                  </span>
                  <h3 className="text-base font-bold text-slate-900 mt-0.5">
                    কলেজ কর্তৃপক্ষ আপনার আবেদন সংশোধনের অনুমতি দিয়েছেন
                  </h3>
                </div>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                আপনি পূর্বে যে তথ্য দিয়ে আবেদন করেছিলেন, তা নিচে প্রদর্শিত বাটনে ক্লিক করে সংশোধন করে পুনরায় ফাইনাল সাবমিট করতে পারবেন।
              </p>
              <div className="flex justify-end">
                <button
                  type="button"
                  id="edit-permitted-application-btn"
                  onClick={() => onStartAdmission(student, application)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition"
                >
                  <RefreshCw className="w-4 h-4" />
                  তথ্য সংশোধন ও পুনরায় সাবমিট করুন
                </button>
              </div>
            </div>
          ) : (
            /* Case 3: Fresh Eligible Student - Ready to Apply! */
            <div className="bg-gradient-to-br from-white via-emerald-50/40 to-teal-50/60 rounded-2xl border-2 border-emerald-500 p-6 sm:p-8 shadow-lg">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-emerald-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
                    <Sparkles className="w-6 h-6 text-amber-300" />
                  </div>
                  <div>
                    <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full">
                      ভর্তিযোগ্য শিক্ষার্থী নির্বাচিত
                    </span>
                    <h3 className="text-xl font-black text-slate-900 mt-1">
                      অভিনন্দন, {student.studentName}!
                    </h3>
                  </div>
                </div>

                <span className="text-xs font-mono font-bold bg-white text-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 self-start sm:self-auto">
                  রোল: {student.sscRoll}
                </span>
              </div>

              {/* Student Verified Record Grid */}
              <div className="my-5 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[11px]">ভর্তিচ্ছুক বিভাগ:</span>
                  <span className="text-sm font-bold text-emerald-900 font-mono">
                    {student.group}
                  </span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[11px]">শিক্ষা বোর্ড:</span>
                  <span className="text-sm font-semibold text-slate-800">
                    {student.sscBoard}
                  </span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[11px]">পাসের সন:</span>
                  <span className="text-sm font-semibold text-slate-800 font-mono">
                    {student.passingYear}
                  </span>
                </div>
              </div>

              <div className="p-3.5 bg-emerald-100/60 rounded-xl border border-emerald-200 text-xs text-emerald-950 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <span>
                  আপনার এসএসসি/দাখিল রোল কলেজের ভর্তি সার্ভারে যাচাই করা হয়েছে। ভর্তি ফরম পূরণের জন্য আপনার ছবি (২৪০x৩০০ পিক্সেল), রেজিস্ট্রেশন নম্বর, জিপিএ ও পিতা-মাতার তথ্য প্রস্তুত রাখুন।
                </span>
              </div>

              <div className="mt-6 flex items-center justify-end">
                <button
                  type="button"
                  id="start-admission-form-btn"
                  onClick={() => onStartAdmission(student)}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-sm font-black shadow-lg shadow-emerald-700/25 transition"
                >
                  <span>ভর্তি ফরম পূরণ করুন</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
