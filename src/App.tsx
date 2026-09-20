import React, { useState } from 'react';
import { Header } from './components/Header';
import { StudentSearch } from './components/StudentSearch';
import { AdmissionForm } from './components/AdmissionForm';
import { A4PrintableApplication } from './components/A4PrintableApplication';
import { AdminPortal } from './components/AdminPortal';
import { AdmissionApplication, EligibleStudent } from './types';
import { COLLEGE_INFO } from './constants/collegeData';
import { School, Phone, MapPin, Heart } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'student' | 'admin'>('student');

  // Student Sub-view state
  const [studentView, setStudentView] = useState<'search' | 'form' | 'print'>('search');
  const [selectedEligible, setSelectedEligible] = useState<EligibleStudent | null>(null);
  const [currentApplication, setCurrentApplication] = useState<AdmissionApplication | null>(null);

  // When student starts admission form (either fresh or edit permitted)
  const handleStartAdmission = (student: EligibleStudent, existingApp?: AdmissionApplication) => {
    setSelectedEligible(student);
    setCurrentApplication(existingApp || null);
    setStudentView('form');
  };

  // When admission form is submitted
  const handleFormSubmitted = (app: AdmissionApplication) => {
    setCurrentApplication(app);
    setStudentView('print');
  };

  // When viewing submitted application
  const handleViewApplication = (app: AdmissionApplication) => {
    setCurrentApplication(app);
    setStudentView('print');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100/70 text-slate-800">
      {/* Top Header & Navbar */}
      <Header
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          if (tab === 'student' && studentView === 'print') {
            // keep view or allow going back
          }
        }}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {activeTab === 'student' ? (
          <div>
            {studentView === 'search' && (
              <StudentSearch
                onStartAdmission={handleStartAdmission}
                onViewApplication={handleViewApplication}
              />
            )}

            {studentView === 'form' && selectedEligible && (
              <AdmissionForm
                eligibleStudent={selectedEligible}
                existingApplication={currentApplication || undefined}
                onSubmitted={handleFormSubmitted}
                onCancel={() => setStudentView('search')}
              />
            )}

            {studentView === 'print' && currentApplication && (
              <A4PrintableApplication
                application={currentApplication}
                onBack={() => setStudentView('search')}
                showBackBtn={true}
              />
            )}
          </div>
        ) : (
          <div>
            {/* Admin Portal */}
            {currentApplication && studentView === 'print' ? (
              <A4PrintableApplication
                application={currentApplication}
                onBack={() => {
                  setCurrentApplication(null);
                  setStudentView('search');
                }}
                showBackBtn={true}
              />
            ) : (
              <AdminPortal onViewApplication={handleViewApplication} />
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="no-print bg-slate-900 text-slate-400 py-8 border-t border-slate-800 text-xs">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
          <div className="space-y-1">
            <div className="flex items-center justify-center md:justify-start gap-2 text-slate-200 font-bold text-sm">
              <School className="w-4 h-4 text-amber-400" />
              <span>{COLLEGE_INFO.nameBn}</span>
              <span className="text-xs text-amber-400">({COLLEGE_INFO.nameEn})</span>
            </div>
            <p className="text-slate-400">
              EIIN: {COLLEGE_INFO.eiin} • {COLLEGE_INFO.address}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 text-slate-400">
            <div className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-emerald-400" />
              <span>হেল্পলাইন: {COLLEGE_INFO.helpline1}, {COLLEGE_INFO.helpline2}</span>
            </div>
            <div className="hidden sm:block text-slate-700">|</div>
            <div>
              &copy; {new Date().getFullYear()} সর্বস্বত্ব সংরক্ষিত • একাদশ শ্রেণি ভর্তি ২০২৬-২০২৭
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
