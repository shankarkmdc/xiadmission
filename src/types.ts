export type StudyGroup = 'HUMANITIES' | 'SCIENCE' | 'BUSINESS STUDIES';

export interface EligibleStudent {
  id: string;
  studentName: string; // English Uppercase
  sscRoll: string;
  sscBoard: string;
  passingYear: string;
  group: StudyGroup;
  academicYear: string; // e.g. "2026-2027"
}

export type ApplicationStatus = 'SUBMITTED' | 'ACCEPTED' | 'REJECTED' | 'EDIT_PERMITTED';

export interface AdmissionApplication {
  id: string;
  trackingId: string; // e.g. KMDC-2026-001
  academicYear: string;
  group: StudyGroup;
  
  // Academic SSC info
  sscRoll: string;
  sscReg: string;
  sscBoard: string;
  passingYear: string;
  gpa: string;

  // Student Info
  studentNameBn: string;
  studentNameEn: string; // Uppercase
  studentMobile: string; // for SMS
  photoBase64: string; // 240x300

  // Parents Info
  fatherNameBn: string;
  fatherNameEn: string; // Uppercase
  fatherMobile: string;
  motherNameBn: string;
  motherNameEn: string; // Uppercase
  motherMobile: string;

  // Addresses
  presentAddress: string;
  permanentAddress: string;

  // Subjects
  compulsorySubjects: string[];
  electiveSubject4: string;
  electiveSubject5: string;
  electiveSubject6: string;
  optionalSubject7: string;

  // Meta & Admin Status
  submittedAt: string;
  updatedAt?: string;
  status: ApplicationStatus;
  classRoll?: string; // Allocated by college authority
  adminRemarks?: string;
  editPermissionGiven?: boolean;
  syncedToGoogleSheets?: boolean;
  lastSyncedAt?: string;
}

export interface CollegeInfo {
  nameBn: string;
  nameEn: string;
  eiin: string;
  address: string;
  helpline1: string;
  helpline2: string;
  academicSession: string;
}
