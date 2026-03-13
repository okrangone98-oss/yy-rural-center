import { z } from 'zod';

export const appRoleSchema = z.enum(['GUEST', 'USER', 'INSTRUCTOR', 'ADMIN']);
export type AppRole = z.infer<typeof appRoleSchema>;

export const registerMemberTypeSchema = z.enum(['USER', 'INSTRUCTOR']);
export type RegisterMemberType = z.infer<typeof registerMemberTypeSchema>;

export const INSTRUCTOR_FIELD_OPTIONS = [
  '농촌,공동체,정책',
  '환경,생태',
  '사진,아카이브,영상',
  '미술,공예,예술',
  '요리,식문화',
  '정리,실버,복지,치유',
  '디지털,AI,문해',
  '레크레이션,진행',
  '세무,회계',
  '인문,철학',
  '마케팅,로컬브랜딩',
  '건강,스포츠',
  '기타',
] as const;

export const INSTAGRAM_VISIBILITY_OPTIONS = ['공개', '미공개'] as const;

const optionalEmailSchema = z.union([z.string().trim().email(), z.literal('')]).optional().default('');

export const consentPayloadSchema = z.object({
  requiredAccepted: z.boolean(),
  profilePublicAccepted: z.boolean().optional().default(false),
  marketingAccepted: z.boolean().optional().default(false),
  consentVersion: z.string().min(1),
});

export const registerPayloadSchema = z.object({
  memberType: registerMemberTypeSchema,
  name: z.string().trim().min(2),
  email: z.string().trim().email(),
  phone: z.string().trim().min(8),
  password: z.string().trim().min(4).optional(),
  org: z.string().trim().optional().default(''),
  field: z.string().trim().optional().default(''),
  area: z.string().trim().optional().default(''),
  intro: z.string().trim().optional().default(''),
  career: z.string().trim().optional().default(''),
  address: z.string().trim().optional().default(''),
  instagram: z.string().trim().optional().default(''),
  instagramOpen: z.enum(['공개', '미공개']).optional().default('미공개'),
  portfolioLink: z.string().trim().optional().default(''),
  profilePhoto: z.string().trim().optional().default(''),
  consent: consentPayloadSchema,
});

export type RegisterPayload = z.infer<typeof registerPayloadSchema>;

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(2).optional(),
  phone: z.string().trim().min(8).optional(),
  org: z.string().trim().optional(),
  field: z.string().trim().optional(),
  area: z.string().trim().optional(),
  intro: z.string().trim().optional(),
  career: z.string().trim().optional(),
  address: z.string().trim().optional(),
  instagram: z.string().trim().optional(),
  instagramOpen: z.enum(['공개', '미공개']).optional(),
  portfolioLink: z.string().trim().optional(),
  profilePhoto: z.string().trim().optional(),
  marketingAccepted: z.boolean().optional(),
  profilePublicAccepted: z.boolean().optional(),
});

export type ProfileUpdatePayload = z.infer<typeof profileUpdateSchema>;

export const inquiryCreateSchema = z.object({
  teacherName: z.string().trim().min(1),
  teacherEmail: z.string().trim().email().optional(),
  inquirerName: z.string().trim().min(2),
  inquirerPhone: z.string().trim().min(8),
  inquirerEmail: z.string().trim().email(),
  purpose: z.string().trim().min(1),
  message: z.string().trim().optional().default(''),
});

export type InquiryCreatePayload = z.infer<typeof inquiryCreateSchema>;

export const inquiryForwardSchema = z.object({
  inquiryId: z.string().trim().min(1),
  teacherEmail: z.string().trim().email(),
  teacherName: z.string().trim().min(1),
  subject: z.string().trim().min(1),
  message: z.string().trim().min(1),
});

export const inquiryReplySchema = z.object({
  inquiryId: z.string().trim().min(1),
  memberEmail: z.string().trim().email(),
  memberName: z.string().trim().min(1),
  subject: z.string().trim().min(1),
  message: z.string().trim().min(1),
});

export const adminInstructorStatusSchema = z.object({
  email: z.string().trim().email(),
  status: z.string().trim().min(1),
});

export const adminInstructorUpdateSchema = z.object({
  email: z.string().trim().email(),
  name: z.string().trim().min(2),
  contactEmail: optionalEmailSchema,
  phone: z.string().trim().optional().default(''),
  org: z.string().trim().optional().default(''),
  field: z.string().trim().optional().default(''),
  area: z.string().trim().optional().default(''),
  intro: z.string().trim().optional().default(''),
  career: z.string().trim().optional().default(''),
  address: z.string().trim().optional().default(''),
  instagram: z.string().trim().optional().default(''),
  instagramOpen: z.enum(INSTAGRAM_VISIBILITY_OPTIONS).optional().default('미공개'),
  portfolioLink: z.string().trim().optional().default(''),
  profilePhoto: z.string().trim().optional().default(''),
  isLocal: z.enum(['Y', 'N']).optional().default('N'),
  status: z.string().trim().optional().default('대기'),
  finalStatus: z.string().trim().optional().default('대기'),
});

export const adminMemberUpdateSchema = z.object({
  email: z.string().trim().email(),
  name: z.string().trim().min(2),
  phone: z.string().trim().optional().default(''),
  org: z.string().trim().optional().default(''),
  status: z.string().trim().optional().default('활성'),
  memberType: z.string().trim().optional().default('일반회원'),
});

export const adminInquiryStatusSchema = z.object({
  inquiryId: z.string().trim().min(1),
  status: z.string().trim().min(1),
});

export type ConsentLog = {
  requiredAccepted: boolean;
  profilePublicAccepted: boolean;
  marketingAccepted: boolean;
  consentVersion: string;
  consentDate: string;
};

export type MirrorUserRecord = {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: AppRole;
  actualRole: AppRole;
  provider: string;
  organization?: string;
  memberType?: RegisterMemberType;
  consent: ConsentLog;
  updatedAt: string;
  createdAt: string;
};

export type MirrorInstructorProfile = {
  id: string;
  email: string;
  name: string;
  phone: string;
  organization?: string;
  field?: string;
  area?: string;
  intro?: string;
  career?: string;
  address?: string;
  instagram?: string;
  instagramOpen?: '공개' | '미공개';
  portfolioLink?: string;
  profilePhoto?: string;
  isLocal?: 'Y' | 'N';
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  updatedAt: string;
  createdAt: string;
};

export type MirrorInquiry = {
  id: string;
  teacherName: string;
  teacherEmail?: string;
  inquirerName: string;
  inquirerPhone: string;
  inquirerEmail: string;
  purpose: string;
  message: string;
  status: 'PENDING_CENTER_REVIEW' | 'FORWARDED_TO_TEACHER' | 'ANSWERED' | 'CLOSED';
  createdAt: string;
  updatedAt: string;
};

export type MailOutboxEntry = {
  id: string;
  category: 'CENTER_INQUIRY' | 'TEACHER_FORWARD' | 'MEMBER_REPLY';
  to: string;
  subject: string;
  html: string;
  relatedInquiryId?: string;
  status: 'QUEUED' | 'SENT' | 'FAILED' | 'SKIPPED';
  errorMessage?: string;
  createdAt: string;
  sentAt?: string;
};
