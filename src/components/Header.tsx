import React from 'react';
import { COLLEGE_INFO } from '../constants/collegeData';
import { Phone, MapPin, School, ShieldCheck, UserCheck } from 'lucide-react';

interface HeaderProps {
  activeTab: 'student' | 'admin';
  setActiveTab: (tab: 'student' | 'admin') => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  return (
    <header className="no-print bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white shadow-lg border-b-4 border-amber-500">
      {/* Top Notification Bar */}
      <div className="bg-slate-950/60 px-4 py-1.5 border-b border-white/10 text-xs sm:text-sm">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-4 text-emerald-200">
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-amber-400" />
              {COLLEGE_INFO.address}
            </span>
            <span className="hidden md:inline text-white/40">|</span>
            <span className="hidden md:inline font-mono font-semibold text-amber-300">
              EIIN: {COLLEGE_INFO.eiin}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs sm:text-sm">
            <span className="text-white/70">হেল্পলাইন:</span>
            <a
              href={`tel:${COLLEGE_INFO.helpline1}`}
              className="flex items-center gap-1 font-mono text-amber-300 hover:text-white transition"
            >
              <Phone className="w-3 h-3" />
              {COLLEGE_INFO.helpline1}
            </a>
            <span className="text-white/40">,</span>
            <a
              href={`tel:${COLLEGE_INFO.helpline2}`}
              className="flex items-center gap-1 font-mono text-amber-300 hover:text-white transition"
            >
              <Phone className="w-3 h-3" />
              {COLLEGE_INFO.helpline2}
            </a>
          </div>
        </div>
      </div>

      {/* Main Brand Section */}
      <div className="max-w-7xl mx-auto px-4 py-4 sm:py-5 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4 text-center md:text-left">
          {/* Emblem / Monogram Logo */}
          <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white p-1 shadow-md border-2 border-amber-400 flex items-center justify-center shrink-0">
            <div className="w-full h-full rounded-full bg-emerald-800 flex flex-col items-center justify-center text-center p-1">
              <School className="w-6 h-6 sm:w-8 sm:h-8 text-amber-400 mb-0.5" />
              <span className="text-[8px] font-bold uppercase tracking-tighter text-emerald-100 leading-none">
                KMDC
              </span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-center md:justify-start gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-white drop-shadow-sm">
                {COLLEGE_INFO.nameBn}
              </h1>
              <span className="bg-amber-400 text-emerald-950 font-bold text-xs px-2.5 py-0.5 rounded-full shadow-sm">
                EIIN: {COLLEGE_INFO.eiin}
              </span>
            </div>
            <p className="text-xs sm:text-sm font-semibold tracking-wider text-emerald-200 mt-0.5 uppercase">
              {COLLEGE_INFO.nameEn}
            </p>
            <p className="text-xs text-emerald-100/90 mt-1">
              উচ্চমাধ্যমিক একাদশ শ্রেণিতে অনলাইন ভর্তি কার্যক্রম • শিক্ষাবর্ষ: {COLLEGE_INFO.academicSession}
            </p>
          </div>
        </div>

        {/* Portal Switcher Buttons */}
        <div className="flex items-center gap-2 bg-slate-950/40 p-1.5 rounded-xl border border-white/15">
          <button
            id="nav-student-portal-btn"
            onClick={() => setActiveTab('student')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm ${
              activeTab === 'student'
                ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                : 'text-white/80 hover:text-white hover:bg-white/10'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            শিক্ষার্থী কর্নার
          </button>
          <button
            id="nav-admin-portal-btn"
            onClick={() => setActiveTab('admin')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm ${
              activeTab === 'admin'
                ? 'bg-emerald-600 text-white shadow-md font-bold'
                : 'text-white/80 hover:text-white hover:bg-white/10'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            কলেজ কর্তৃপক্ষ (এডমিন)
          </button>
        </div>
      </div>
    </header>
  );
};
