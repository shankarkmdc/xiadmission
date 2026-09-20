import React, { useRef, useState } from 'react';
import { AdmissionApplication } from '../types';
import { COLLEGE_INFO } from '../constants/collegeData';
import { Printer, Download, ArrowLeft, CheckCircle, School, AlertCircle, Image as ImageIcon, Loader2, Info } from 'lucide-react';
import { downloadApplicationPdf, downloadApplicationImage, printApplicationElement } from '../services/pdfService';

interface A4PrintableApplicationProps {
  application: AdmissionApplication;
  onBack?: () => void;
  showBackBtn?: boolean;
}

export const A4PrintableApplication: React.FC<A4PrintableApplicationProps> = ({
  application,
  onBack,
  showBackBtn = true,
}) => {
  const formRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const handlePrint = () => {
    if (!formRef.current) return;
    setStatusMessage({ type: 'info', text: 'প্রিন্ট কমান্ড পাঠানো হচ্ছে... যদি প্রিন্ট ডায়লগ না আসে তবে সরাসরি "A4 PDF ডাউনলোড" করুন।' });
    try {
      printApplicationElement(formRef.current, application);
    } catch (err) {
      console.error('Print failed:', err);
      setStatusMessage({ type: 'error', text: 'ব্রাউজার প্রিন্ট ডায়লগ খুলতে পারেনি। অনুগ্রহ করে "A4 PDF ডাউনলোড" বাটনটি ব্যবহার করুন।' });
    }
  };

  const handleDownloadPdf = async () => {
    if (!formRef.current || isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    setStatusMessage({ type: 'info', text: 'উচ্চমানের A4 PDF তৈরি হচ্ছে, অনুগ্রহ করে কয়েক সেকেন্ড অপেক্ষা করুন...' });

    try {
      await downloadApplicationPdf(formRef.current, application);
      setStatusMessage({
        type: 'success',
        text: `আবেদন ফরমটি সফলভাবে PDF আকারে ডাউনলোড হয়েছে (KMDC_Admission_${application.trackingId}_Roll_${application.sscRoll}.pdf)।`,
      });
    } catch (err: any) {
      console.error('PDF Generation failed:', err);
      setStatusMessage({
        type: 'error',
        text: 'PDF জেনারেশনে সমস্যা হয়েছে। বিকল্প হিসেবে নিচের "A4 ছবি ডাউনলোড" অথবা "সরাসরি প্রিন্ট" ব্যবহার করুন।',
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleDownloadImage = async () => {
    if (!formRef.current || isGeneratingImage) return;
    setIsGeneratingImage(true);
    setStatusMessage({ type: 'info', text: 'উচ্চমানের ছবি (HD Image) তৈরি হচ্ছে...' });

    try {
      await downloadApplicationImage(formRef.current, application);
      setStatusMessage({
        type: 'success',
        text: 'আবেদন ফরমটির হাই-রেজুলেশন ছবি সফলভাবে ডাউনলোড হয়েছে। এটি যে কোনো স্টুডিও বা ফটো প্রিন্টারে প্রিন্ট করতে পারবেন।',
      });
    } catch (err: any) {
      console.error('Image Generation failed:', err);
      setStatusMessage({
        type: 'error',
        text: 'ছবি ডাউনলোডে সমস্যা হয়েছে। براہ karam সরাসরি প্রিন্ট ব্যবহার করুন।',
      });
    } finally {
      setIsGeneratingImage(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6 px-2 sm:px-4">
      {/* Top Action Bar (hidden in print) */}
      <div className="no-print bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {showBackBtn && onBack && (
            <button
              type="button"
              id="back-from-print-btn"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
            >
              <ArrowLeft className="w-4 h-4" />
              পেছনে যান
            </button>
          )}
          <div className="flex items-center gap-1.5 text-xs text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 font-medium">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>আবেদন সফলভাবে সংরক্ষিত হয়েছে। প্রিন্ট বা PDF ডাউনলোড করে কলেজে জমা দিন।</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Direct Print Button */}
          <button
            type="button"
            id="direct-print-btn"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold shadow-sm transition active:scale-95"
            title="কম্পিউটার বা মোবাইলের প্রিন্ট ডায়লগ খুলুন"
          >
            <Printer className="w-4 h-4" />
            সরাসরি প্রিন্ট (Print)
          </button>

          {/* High-res PDF Download Button */}
          <button
            type="button"
            id="download-pdf-btn"
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition active:scale-95 disabled:opacity-50"
            title="এক ক্লিকে A4 সাইজ PDF ডাউনলোড করুন"
          >
            {isGeneratingPdf ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                PDF তৈরি হচ্ছে...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                A4 PDF ডাউনলোড
              </>
            )}
          </button>

          {/* Fallback HD Image Download Button */}
          <button
            type="button"
            id="download-image-btn"
            onClick={handleDownloadImage}
            disabled={isGeneratingImage}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold shadow-xs transition active:scale-95 disabled:opacity-50"
            title="স্টুডিও বা মোবাইলে সহজে প্রিন্ট করার জন্য হাই-রেজুলেশন ছবি ডাউনলোড করুন"
          >
            {isGeneratingImage ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ImageIcon className="w-4 h-4 text-slate-600" />
            )}
            HD ছবি
          </button>
        </div>
      </div>

      {/* Real-time Status / Feedback Alert */}
      {statusMessage && (
        <div
          className={`no-print mb-4 p-3 rounded-xl border flex items-center justify-between gap-2 text-xs font-medium ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : statusMessage.type === 'error'
              ? 'bg-rose-50 text-rose-900 border-rose-200'
              : 'bg-blue-50 text-blue-900 border-blue-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : statusMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-blue-600 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-slate-400 hover:text-slate-600 text-xs px-2 py-0.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* Helpful College Notice Banner */}
      <div className="no-print mb-4 bg-amber-50/70 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
        <div className="space-y-0.5">
          <span className="font-bold">শিক্ষার্থীর করণীয় ও প্রিন্ট সংক্রান্ত নির্দেশনা:</span>
          <p className="text-amber-800 text-[11px] leading-relaxed">
            ১. <strong>'A4 PDF ডাউনলোড'</strong> বাটনে ক্লিক করে ফরমটি আপনার মোবাইল বা কম্পিউটারে সেভ করুন।<br />
            ২. প্রিন্টকৃত আবেদন ফরমের সাথে এসএসসির মূল ট্রান্সক্রিপ্ট/মার্কশিট, প্রশংসাপত্র এবং পাসপোর্ট সাইজের ছবি সংযুক্ত করে কসবা মহিলা ডিগ্রি কলেজ অফিসে নির্ধারিত সময়ের মধ্যে জমা দিন।
          </p>
        </div>
      </div>

      {/* Printable A4 Paper Container */}
      <div className="overflow-x-auto pb-4">
        <div
          ref={formRef}
          id="kmdc-printable-a4-form"
          className="bg-white text-slate-900 p-8 sm:p-10 mx-auto shadow-lg border border-slate-300 relative print:p-0 print:m-0 print:border-none print:shadow-none"
          style={{
            width: '210mm',
            minHeight: '297mm',
            boxSizing: 'border-box',
            fontFamily: "'Hind Siliguri', sans-serif",
          }}
        >
          {/* Watermark Logo in Background */}
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
            <School className="w-96 h-96 text-emerald-950" />
          </div>

          {/* College Header */}
          <div className="border-b-2 border-emerald-900 pb-3 mb-3">
            <div className="flex items-start justify-between gap-4">
              {/* College Logo */}
              <div className="w-16 h-16 rounded-full border-2 border-emerald-800 bg-emerald-50 flex flex-col items-center justify-center text-center shrink-0">
                <School className="w-8 h-8 text-emerald-800 mb-0.5" />
                <span className="text-[7px] font-bold uppercase text-emerald-900 leading-none">KMDC</span>
              </div>

              {/* Title & Info */}
              <div className="text-center flex-1">
                <h1 className="text-2xl font-black text-emerald-950 tracking-tight leading-tight">
                  {COLLEGE_INFO.nameBn}
                </h1>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  {COLLEGE_INFO.nameEn}
                </h2>
                <p className="text-[11px] text-slate-600 mt-0.5 font-medium">
                  EIIN: {COLLEGE_INFO.eiin} • {COLLEGE_INFO.address}
                </p>
                <p className="text-[10px] text-slate-500 font-mono">
                  হেল্পলাইন: {COLLEGE_INFO.helpline1}, {COLLEGE_INFO.helpline2}
                </p>
                <div className="inline-block mt-1 bg-emerald-900 text-white text-xs font-bold px-4 py-0.5 rounded-full uppercase tracking-wider">
                  উচ্চমাধ্যমিক (একাদশ শ্রেণি) ভর্তির আবেদন ফরম — শিক্ষাবর্ষ: {application.academicYear}
                </div>
              </div>

              {/* Passport Photo Box (240x300) */}
              <div className="shrink-0 flex flex-col items-center">
                <div
                  className="border-2 border-slate-700 bg-slate-50 rounded overflow-hidden flex items-center justify-center"
                  style={{ width: '28mm', height: '35mm' }} // Standard ~240x300 passport box
                >
                  {application.photoBase64 ? (
                    <img
                      src={application.photoBase64}
                      alt="Student"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[9px] text-slate-400 text-center p-1">
                      পাসপোর্ট সাইজ ছবি (২৪০x৩০০ px)
                    </span>
                  )}
                </div>
                <span className="text-[8px] text-slate-500 font-bold uppercase mt-0.5">
                  শিক্ষার্থীর ছবি
                </span>
              </div>
            </div>
          </div>

          {/* Tracking ID & CRITICAL EMPTY ALLOCATED CLASS ROLL BOX */}
          <div className="grid grid-cols-12 gap-3 mb-3 text-xs">
            {/* Tracking ID */}
            <div className="col-span-4 border border-slate-400 rounded p-2 bg-slate-50/50 flex flex-col justify-center">
              <span className="text-[10px] text-slate-500 font-bold uppercase block">
                আবেদন ট্র্যাকিং আইডি (Tracking ID):
              </span>
              <span className="text-sm font-black text-emerald-900 font-mono">
                {application.trackingId}
              </span>
            </div>

            {/* Department / Group */}
            <div className="col-span-4 border border-slate-400 rounded p-2 bg-slate-50/50 flex flex-col justify-center">
              <span className="text-[10px] text-slate-500 font-bold uppercase block">
                ভর্তিচ্ছুক বিভাগ (Group):
              </span>
              <span className="text-sm font-black text-slate-900 font-mono">
                {application.group}
              </span>
            </div>

            {/* PROMPT MANDATE: pdf ফাইলে বরাদ্ধকৃত শ্রেনি রোল নম্বর এর বক্সে খালি থাকবে। */}
            <div className="col-span-4 border-2 border-dashed border-rose-700 rounded p-1.5 bg-rose-50/20 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-rose-900 uppercase">
                  বরাদ্ধকৃত শ্রেণি রোল নম্বর:
                </span>
                <span className="text-[8px] text-slate-500 italic">
                  (কলেজ কর্তৃপক্ষ পূরণ করবে)
                </span>
              </div>
              <div className="h-6 flex items-center justify-center font-mono font-bold text-slate-700">
                {/* Empty box per user request, will be written by college office */}
                <span className="text-slate-300 tracking-widest">[ &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; ]</span>
              </div>
            </div>
          </div>

          {/* 1. Academic Information */}
          <div className="mb-3">
            <h3 className="text-xs font-bold uppercase bg-slate-800 text-white px-2 py-0.5 mb-1.5 flex items-center justify-between">
              <span>১. মাধ্যমিক / এসএসসি / দাখিল পরীক্ষার বিবরণী</span>
              <span className="text-[9px] font-normal text-slate-200">SSC/Dakhil Information</span>
            </h3>
            <table className="w-full border-collapse border border-slate-300 text-xs">
              <tbody>
                <tr className="bg-slate-50/50">
                  <td className="border border-slate-300 p-1.5 font-bold w-1/4">এসএসসি/দাখিল রোল:</td>
                  <td className="border border-slate-300 p-1.5 font-mono font-bold text-slate-900 w-1/4">
                    {application.sscRoll}
                  </td>
                  <td className="border border-slate-300 p-1.5 font-bold w-1/4">রেজিস্ট্রেশন নম্বর:</td>
                  <td className="border border-slate-300 p-1.5 font-mono font-bold text-slate-900 w-1/4">
                    {application.sscReg}
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-300 p-1.5 font-bold">শিক্ষা বোর্ড:</td>
                  <td className="border border-slate-300 p-1.5 font-semibold text-slate-800">
                    {application.sscBoard}
                  </td>
                  <td className="border border-slate-300 p-1.5 font-bold">পাসের সন:</td>
                  <td className="border border-slate-300 p-1.5 font-mono font-semibold text-slate-800">
                    {application.passingYear}
                  </td>
                </tr>
                <tr className="bg-slate-50/50">
                  <td className="border border-slate-300 p-1.5 font-bold">প্রাপ্ত জিপিএ (GPA):</td>
                  <td className="border border-slate-300 p-1.5 font-mono font-bold text-emerald-800">
                    {application.gpa}
                  </td>
                  <td className="border border-slate-300 p-1.5 font-bold">ভর্তিচ্ছুক বিভাগ:</td>
                  <td className="border border-slate-300 p-1.5 font-bold text-slate-900">
                    {application.group}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 2. Candidate Information */}
          <div className="mb-3">
            <h3 className="text-xs font-bold uppercase bg-slate-800 text-white px-2 py-0.5 mb-1.5 flex items-center justify-between">
              <span>২. শিক্ষার্থীর ব্যক্তিগত তথ্য</span>
              <span className="text-[9px] font-normal text-slate-200">Candidate Information</span>
            </h3>
            <table className="w-full border-collapse border border-slate-300 text-xs">
              <tbody>
                <tr>
                  <td className="border border-slate-300 p-1.5 font-bold w-1/4">শিক্ষার্থীর নাম (বাংলায়):</td>
                  <td className="border border-slate-300 p-1.5 font-semibold text-slate-900" colSpan={3}>
                    {application.studentNameBn || '—'}
                  </td>
                </tr>
                <tr className="bg-slate-50/50">
                  <td className="border border-slate-300 p-1.5 font-bold">নাম (ইংরেজিতে ক্যাপিটাল):</td>
                  <td className="border border-slate-300 p-1.5 font-mono font-bold text-slate-900" colSpan={3}>
                    {application.studentNameEn}
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-300 p-1.5 font-bold">শিক্ষার্থীর মোবাইল নম্বর (SMS):</td>
                  <td className="border border-slate-300 p-1.5 font-mono font-bold text-slate-900" colSpan={3}>
                    {application.studentMobile}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 3. Parents Information */}
          <div className="mb-3">
            <h3 className="text-xs font-bold uppercase bg-slate-800 text-white px-2 py-0.5 mb-1.5 flex items-center justify-between">
              <span>৩. পিতা ও মাতার তথ্য</span>
              <span className="text-[9px] font-normal text-slate-200">Parents Information</span>
            </h3>
            <table className="w-full border-collapse border border-slate-300 text-xs">
              <tbody>
                <tr>
                  <td className="border border-slate-300 p-1.5 font-bold w-1/4">পিতার নাম (বাংলায়):</td>
                  <td className="border border-slate-300 p-1.5 font-semibold text-slate-900 w-1/4">
                    {application.fatherNameBn || '—'}
                  </td>
                  <td className="border border-slate-300 p-1.5 font-bold w-1/4">পিতার মোবাইল নম্বর:</td>
                  <td className="border border-slate-300 p-1.5 font-mono font-bold text-slate-900 w-1/4">
                    {application.fatherMobile || '—'}
                  </td>
                </tr>
                <tr className="bg-slate-50/50">
                  <td className="border border-slate-300 p-1.5 font-bold">পিতার নাম (ইংরেজিতে):</td>
                  <td className="border border-slate-300 p-1.5 font-mono font-bold text-slate-900" colSpan={3}>
                    {application.fatherNameEn}
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-300 p-1.5 font-bold">মাতার নাম (বাংলায়):</td>
                  <td className="border border-slate-300 p-1.5 font-semibold text-slate-900">
                    {application.motherNameBn || '—'}
                  </td>
                  <td className="border border-slate-300 p-1.5 font-bold">মাতার মোবাইল নম্বর:</td>
                  <td className="border border-slate-300 p-1.5 font-mono font-bold text-slate-900">
                    {application.motherMobile || '—'}
                  </td>
                </tr>
                <tr className="bg-slate-50/50">
                  <td className="border border-slate-300 p-1.5 font-bold">মাতার নাম (ইংরেজিতে):</td>
                  <td className="border border-slate-300 p-1.5 font-mono font-bold text-slate-900" colSpan={3}>
                    {application.motherNameEn}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 4. Address */}
          <div className="mb-3">
            <h3 className="text-xs font-bold uppercase bg-slate-800 text-white px-2 py-0.5 mb-1.5 flex items-center justify-between">
              <span>৪. ঠিকানা (Address Details)</span>
              <span className="text-[9px] font-normal text-slate-200">Contact Address</span>
            </h3>
            <table className="w-full border-collapse border border-slate-300 text-xs">
              <tbody>
                <tr>
                  <td className="border border-slate-300 p-1.5 font-bold w-1/4">বর্তমান ঠিকানা:</td>
                  <td className="border border-slate-300 p-1.5 text-slate-800" colSpan={3}>
                    {application.presentAddress || '—'}
                  </td>
                </tr>
                <tr className="bg-slate-50/50">
                  <td className="border border-slate-300 p-1.5 font-bold">স্থায়ী ঠিকানা:</td>
                  <td className="border border-slate-300 p-1.5 text-slate-800" colSpan={3}>
                    {application.permanentAddress || '—'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 5. Selected Subjects */}
          <div className="mb-4">
            <h3 className="text-xs font-bold uppercase bg-slate-800 text-white px-2 py-0.5 mb-1.5 flex items-center justify-between">
              <span>৫. নির্বাচিত বিষয়সমূহ (Selected Subjects)</span>
              <span className="text-[9px] font-normal text-slate-200">Subject Combination</span>
            </h3>
            <table className="w-full border-collapse border border-slate-300 text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700">
                  <th className="border border-slate-300 p-1 text-center w-12">ক্রমিক</th>
                  <th className="border border-slate-300 p-1 text-left">বিষয়ের ধরন</th>
                  <th className="border border-slate-300 p-1 text-left">নির্বাচিত বিষয়ের নাম</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-slate-300 p-1 text-center font-mono">১</td>
                  <td className="border border-slate-300 p-1 font-semibold text-slate-600">আবশ্যিক বিষয়-১</td>
                  <td className="border border-slate-300 p-1 font-bold text-slate-900">বাংলা</td>
                </tr>
                <tr className="bg-slate-50/50">
                  <td className="border border-slate-300 p-1 text-center font-mono">২</td>
                  <td className="border border-slate-300 p-1 font-semibold text-slate-600">আবশ্যিক বিষয়-২</td>
                  <td className="border border-slate-300 p-1 font-bold text-slate-900">ইংরেজি</td>
                </tr>
                <tr>
                  <td className="border border-slate-300 p-1 text-center font-mono">৩</td>
                  <td className="border border-slate-300 p-1 font-semibold text-slate-600">আবশ্যিক বিষয়-৩</td>
                  <td className="border border-slate-300 p-1 font-bold text-slate-900">তথ্য ও যোগাযোগ প্রযুক্তি</td>
                </tr>
                <tr className="bg-emerald-50/30">
                  <td className="border border-slate-300 p-1 text-center font-mono">৪</td>
                  <td className="border border-slate-300 p-1 font-semibold text-emerald-800">নির্বাচনিক বিষয়-১</td>
                  <td className="border border-slate-300 p-1 font-bold text-slate-900">{application.electiveSubject4}</td>
                </tr>
                <tr className="bg-emerald-50/30">
                  <td className="border border-slate-300 p-1 text-center font-mono">৫</td>
                  <td className="border border-slate-300 p-1 font-semibold text-emerald-800">নির্বাচনিক বিষয়-২</td>
                  <td className="border border-slate-300 p-1 font-bold text-slate-900">{application.electiveSubject5}</td>
                </tr>
                <tr className="bg-emerald-50/30">
                  <td className="border border-slate-300 p-1 text-center font-mono">৬</td>
                  <td className="border border-slate-300 p-1 font-semibold text-emerald-800">নির্বাচনিক বিষয়-৩</td>
                  <td className="border border-slate-300 p-1 font-bold text-slate-900">{application.electiveSubject6}</td>
                </tr>
                <tr className="bg-amber-50/40">
                  <td className="border border-slate-300 p-1 text-center font-mono">৭</td>
                  <td className="border border-slate-300 p-1 font-bold text-amber-900">ঐচ্ছিক বিষয় (৪র্থ বিষয়)</td>
                  <td className="border border-slate-300 p-1 font-bold text-amber-950">{application.optionalSubject7}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 6. Undertaking & Signatures */}
          <div className="mb-4 text-[10px] text-slate-700 bg-slate-50 p-2 border border-slate-200 rounded leading-relaxed">
            <p className="font-bold text-slate-900 mb-0.5">অঙ্গীকারনামা:</p>
            <p>
              আমি এই মর্মে অঙ্গীকার করছি যে, উপরে বর্ণিত যাবতীয় তথ্য সম্পূর্ণ সত্য ও সঠিক। কোনো তথ্য মিথ্যা বা অসত্য প্রমাণিত হলে আমার ভর্তি সরাসরি বাতিল বলে গণ্য হবে এবং কলেজ কর্তৃপক্ষের গৃহীত যে কোনো সিদ্ধান্ত মেনে নিতে বাধ্য থাকব।
            </p>
          </div>

          {/* Signatures of Candidate & Guardian */}
          <div className="grid grid-cols-2 gap-8 mb-6 pt-4 text-xs">
            <div className="text-center">
              <div className="border-t border-slate-600 pt-1 w-3/4 mx-auto font-bold text-slate-800">
                শিক্ষার্থীর স্বাক্ষর ও তারিখ
              </div>
            </div>
            <div className="text-center">
              <div className="border-t border-slate-600 pt-1 w-3/4 mx-auto font-bold text-slate-800">
                পিতা / অভিভাবকের স্বাক্ষর ও তারিখ
              </div>
            </div>
          </div>

          {/* 7. Official College Verification Section */}
          <div className="border-2 border-slate-700 rounded p-2.5 bg-slate-50/40 text-xs">
            <div className="font-bold text-slate-800 mb-6 flex items-center justify-between border-b border-slate-300 pb-1">
              <span>কলেজ কর্তৃপক্ষের ব্যবহারের জন্য (Office Use Only)</span>
              <span className="text-[10px] font-normal text-slate-500">
                আবেদনের তারিখ: {new Date(application.submittedAt).toLocaleDateString('bn-BD')}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-6 text-center text-[11px]">
              <div>
                <div className="border-t border-dashed border-slate-500 pt-1 font-semibold text-slate-700">
                  যাচাইকারী কর্মকর্তার স্বাক্ষর
                </div>
              </div>
              <div>
                <div className="border-t border-dashed border-slate-500 pt-1 font-semibold text-slate-700">
                  ভর্তি কমিটির আহ্বায়কের স্বাক্ষর
                </div>
              </div>
              <div>
                <div className="border-t border-dashed border-slate-500 pt-1 font-bold text-slate-900">
                  অধ্যক্ষের প্রতিস্বাক্ষর ও সিলমোহর
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
