export type Role = 'GUEST' | 'USER' | 'INSTRUCTOR' | 'ADMIN';

export type GenericRecord = Record<string, string | number | boolean | null | undefined>;

export type InstructorProfile = {
  status?: string;
  isLocal?: 'Y' | 'N';
  [key: string]: string | number | boolean | null | undefined;
};

export type InquiryActionMode = 'forward' | 'reply';

export type InquiryActionDraft = {
  subject: string;
  message: string;
};

export type InquiryItem = {
  inquiryId: string;
  rowIndex: number;
  receivedAt: string;
  teacherName: string;
  teacherEmail: string;
  '운영 메모'?: string;
  '운영메모'?: string;
  memberName: string;
  memberPhone: string;
  memberEmail: string;
  purpose: string;
  message: string;
  status: string;
};

export type SheetSource = {
  rows: GenericRecord[];
  rowCount: number;
};

export type SheetBundle = {
  stats: {
    instructorDb: { total: number; approved: number; pending: number; local: number };
    memberDb: { total: number };
    inquiryDb: { total: number; pending: number; forwarded: number; completed: number };
  };
  integrity: {
    issueCount: number;
    issues: Array<{ id: string; severity: string; message: string; count: number; samples: unknown[] }>;
  };
  sources: {
    instructorDb: SheetSource;
    memberDb: SheetSource;
    inquiryDb: SheetSource;
  };
};

export type AdminInstructorItem = {
  id: string;
  rowIndex: number;
  name: string;
  phone: string;
  email: string;
  loginEmail: string;
  org: string;
  field: string;
  area: string;
  status: string;
  finalStatus: string;
  updatedAt: string;
  intro: string;
  career: string;
  address: string;
  instagram: string;
  instagramOpen: string;
  portfolioLink: string;
  profilePhoto: string;
  isLocal: boolean;
  raw: InstructorProfile;
};

export type AdminMemberItem = {
  id: string;
  rowIndex: number;
  name: string;
  email: string;
  phone: string;
  org: string;
  status: string;
  memberType: string;
  lastLogin: string;
  raw: GenericRecord;
};

export type MemberFormState = {
  email: string;
  name: string;
  phone: string;
  org: string;
  status: string;
  memberType: string;
  lastLogin: string;
};
