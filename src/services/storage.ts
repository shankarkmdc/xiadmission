import { AdmissionApplication, EligibleStudent, StudyGroup } from '../types';
import { INITIAL_ELIGIBLE_STUDENTS, TRACKING_RANGES } from '../constants/collegeData';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

const STORAGE_KEYS = {
  ELIGIBLE_STUDENTS: 'kmdc_eligible_students_v2',
  APPLICATIONS: 'kmdc_applications_v1',
  ADMIN_PASSWORD: 'kmdc_admin_pwd_v2',
};

export const DEFAULT_ADMIN_PASSWORD = 'kmdc@admin2026';

// Initialize Eligible Students
export function getEligibleStudents(): EligibleStudent[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.ELIGIBLE_STUDENTS);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.ELIGIBLE_STUDENTS, JSON.stringify(INITIAL_ELIGIBLE_STUDENTS));
      return INITIAL_ELIGIBLE_STUDENTS;
    }
    const parsed: EligibleStudent[] = JSON.parse(data);
    // If local cache has fewer students than the official master list, auto-upgrade to the latest 464 students
    if (!Array.isArray(parsed) || parsed.length < INITIAL_ELIGIBLE_STUDENTS.length) {
      localStorage.setItem(STORAGE_KEYS.ELIGIBLE_STUDENTS, JSON.stringify(INITIAL_ELIGIBLE_STUDENTS));
      return INITIAL_ELIGIBLE_STUDENTS;
    }
    return parsed;
  } catch (err) {
    console.error('Failed to load eligible students:', err);
    return INITIAL_ELIGIBLE_STUDENTS;
  }
}

export function saveEligibleStudents(students: EligibleStudent[]): void {
  localStorage.setItem(STORAGE_KEYS.ELIGIBLE_STUDENTS, JSON.stringify(students));
}

// Find eligible student by roll
export function findEligibleStudentByRoll(roll: string): EligibleStudent | undefined {
  const trimmed = roll.trim();
  if (!trimmed) return undefined;
  const students = getEligibleStudents();
  return students.find((s) => {
    const sRoll = s.sscRoll.trim();
    return sRoll === trimmed || sRoll.replace(/^0+/, '') === trimmed.replace(/^0+/, '');
  });
}

// Manage Applications
export function getApplications(): AdmissionApplication[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.APPLICATIONS);
    if (!data) return [];
    return JSON.parse(data);
  } catch (err) {
    console.error('Failed to load applications:', err);
    return [];
  }
}

export function saveApplications(apps: AdmissionApplication[]): void {
  localStorage.setItem(STORAGE_KEYS.APPLICATIONS, JSON.stringify(apps));
}

export function findApplicationByRoll(roll: string): AdmissionApplication | undefined {
  const trimmed = roll.trim();
  const apps = getApplications();
  return apps.find((a) => a.sscRoll.trim() === trimmed);
}

// Generate Tracking ID strictly according to college rules:
// Humanities: KMDC-2026-001 to 400
// Science: KMDC-2026-401 to 600
// Business Studies: KMDC-2026-601 to 800
export function generateTrackingId(group: StudyGroup, academicYear = '2026-2027'): string {
  const apps = getApplications().filter((a) => a.group === group);
  const range = TRACKING_RANGES[group] || TRACKING_RANGES.HUMANITIES;
  
  // Find highest assigned sequence number in this range
  let maxSeq = range.start - 1;
  apps.forEach((app) => {
    if (app.trackingId && app.trackingId.startsWith(range.prefix)) {
      const numPart = parseInt(app.trackingId.replace(range.prefix, ''), 10);
      if (!isNaN(numPart) && numPart >= range.start && numPart <= range.end) {
        if (numPart > maxSeq) {
          maxSeq = numPart;
        }
      }
    }
  });

  const nextSeq = Math.min(maxSeq + 1, range.end);
  const formattedSeq = String(nextSeq).padStart(3, '0');
  return `${range.prefix}${formattedSeq}`;
}

// Admin Password Management
export function getAdminPassword(): string {
  return localStorage.getItem(STORAGE_KEYS.ADMIN_PASSWORD) || DEFAULT_ADMIN_PASSWORD;
}

export function setAdminPassword(password: string): void {
  localStorage.setItem(STORAGE_KEYS.ADMIN_PASSWORD, password);
}

export function resetAdminPassword(): void {
  localStorage.removeItem(STORAGE_KEYS.ADMIN_PASSWORD);
}

// Export Applications to Excel or CSV
export function exportApplicationsToExcel(applications: AdmissionApplication[], filename: string, format: 'xlsx' | 'csv' = 'xlsx') {
  const rows = applications.map((app, index) => ({
    'SL': index + 1,
    'Tracking ID': app.trackingId,
    'Class Roll': app.classRoll || 'Not Allocated',
    'Status': app.status === 'ACCEPTED' ? 'ভর্তি গৃহীত' : app.status === 'SUBMITTED' ? 'দাখিলকৃত' : app.status === 'EDIT_PERMITTED' ? 'সংশোধন অনুমোদিত' : app.status,
    'Group (বিভাগ)': app.group,
    'Academic Year': app.academicYear,
    'SSC Roll': app.sscRoll,
    'SSC Reg No': app.sscReg,
    'SSC Board': app.sscBoard,
    'Passing Year': app.passingYear,
    'GPA': app.gpa,
    'Student Name (English)': app.studentNameEn,
    'Student Name (বাংলা)': app.studentNameBn,
    'Mobile (SMS)': app.studentMobile,
    "Father's Name (English)": app.fatherNameEn,
    "Father's Name (বাংলা)": app.fatherNameBn,
    "Father's Mobile": app.fatherMobile,
    "Mother's Name (English)": app.motherNameEn,
    "Mother's Name (বাংলা)": app.motherNameBn,
    "Mother's Mobile": app.motherMobile,
    'Present Address': app.presentAddress,
    'Permanent Address': app.permanentAddress,
    'Compulsory Subjects': app.compulsorySubjects.join(', '),
    'Elective 4': app.electiveSubject4,
    'Elective 5': app.electiveSubject5,
    'Elective 6': app.electiveSubject6,
    'Optional 7': app.optionalSubject7,
    'Submitted Date': new Date(app.submittedAt).toLocaleDateString('bn-BD', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Applications');

  if (format === 'csv') {
    const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `${filename}.csv`);
  } else {
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `${filename}.xlsx`);
  }
}

// Download Sample CSV/XLSX template for Eligible Students
export function downloadEligibleStudentsTemplate(format: 'csv' | 'xlsx' = 'xlsx') {
  const sampleData = [
    {
      'Student Name': 'FARZANA AKTER',
      'SSC/Dakhil Roll Number': '103501',
      'SSC/Dakhil Board': 'COMILLA',
      'Passing Year': '2026',
      'Group': 'HUMANITIES',
      'Academic Year': '2026-2027',
    },
    {
      'Student Name': 'TASNIA ISLAM',
      'SSC/Dakhil Roll Number': '204602',
      'SSC/Dakhil Board': 'COMILLA',
      'Passing Year': '2026',
      'Group': 'SCIENCE',
      'Academic Year': '2026-2027',
    },
    {
      'Student Name': 'ROKSANA BEGUM',
      'SSC/Dakhil Roll Number': '305703',
      'SSC/Dakhil Board': 'COMILLA',
      'Passing Year': '2026',
      'Group': 'BUSINESS STUDIES',
      'Academic Year': '2026-2027',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Eligible_Students');

  if (format === 'csv') {
    const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'KMDC_Eligible_Students_Template.csv');
  } else {
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, 'KMDC_Eligible_Students_Template.xlsx');
  }
}

// Download Students Photos as ZIP archive
export async function downloadPhotosZip(applications: AdmissionApplication[], zipName: string) {
  const zip = new JSZip();
  let count = 0;

  applications.forEach((app) => {
    if (app.photoBase64) {
      // Extract base64 data
      const parts = app.photoBase64.split(',');
      const base64Data = parts.length > 1 ? parts[1] : parts[0];
      const filename = `${app.trackingId}_Roll_${app.sscRoll}_${app.studentNameEn.replace(/\s+/g, '_')}.jpg`;
      
      // Categorize in folders by Group inside ZIP
      const folderName = `${app.academicYear}/${app.group.replace(/\s+/g, '_')}`;
      zip.folder(folderName)?.file(filename, base64Data, { base64: true });
      count++;
    }
  });

  if (count === 0) {
    throw new Error('কোন শিক্ষার্থীর ছবি পাওয়া যায়নি!');
  }

  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, `${zipName}.zip`);
}
