import { CollegeInfo, EligibleStudent, StudyGroup } from '../types';
import { OFFICIAL_ELIGIBLE_STUDENTS } from './officialStudents';

export const COLLEGE_INFO: CollegeInfo = {
  nameBn: 'কসবা মহিলা ডিগ্রি কলেজ',
  nameEn: 'KASBA MOHILA DEGREE COLLEGE',
  eiin: '103379',
  address: 'আখাউড়া রোড, কসবা পৌরসভা, ব্রাহ্মণবাড়িয়া, ৩৪৬০',
  helpline1: '01309103379',
  helpline2: '01822721111',
  academicSession: '2026-2027',
};

export const TRACKING_RANGES: Record<StudyGroup, { prefix: string; start: number; end: number }> = {
  HUMANITIES: { prefix: 'KMDC-2026-', start: 1, end: 400 },
  SCIENCE: { prefix: 'KMDC-2026-', start: 401, end: 600 },
  'BUSINESS STUDIES': { prefix: 'KMDC-2026-', start: 601, end: 800 },
};

export const COMPULSORY_SUBJECTS = [
  'বাংলা (Bangla)',
  'ইংরেজি (English)',
  'তথ্য ও যোগাযোগ প্রযুক্তি (ICT)',
];

export const EDUCATION_BOARDS = [
  'COMILLA',
  'CUMILLA',
  'DHAKA',
  'CHITTAGONG',
  'RAJSHAHI',
  'JESSORE',
  'BARISAL',
  'SYLHET',
  'DINAJPUR',
  'MYMENSINGH',
  'MADRASAH',
  'TECHNICAL',
  'BTEB',
];

export const PASSING_YEARS = ['2026', '2025', '2024'];

// Official list of eligible students uploaded by the college administration (464 students)
export const INITIAL_ELIGIBLE_STUDENTS: EligibleStudent[] = OFFICIAL_ELIGIBLE_STUDENTS;
