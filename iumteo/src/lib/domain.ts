import { z } from 'zod';

export const appRoleSchema = z.enum(['GUEST', 'USER', 'INSTRUCTOR', 'ADMIN']);
export type AppRole = z.infer<typeof appRoleSchema>;

export const registerMemberTypeSchema = z.enum(['USER', 'INSTRUCTOR']);
export type RegisterMemberType = z.infer<typeof registerMemberTypeSchema>;

export const INSTRUCTOR_FIELD_OPTIONS = [
  '기타',
  '농촌·공동체·정책',
  '디지털·AI·문해',
  '레크레이션·진행',
  '마케팅·로컬브랜딩',
  '미술·공예·예술',
  '사진·아카이브·영상',
  '세무·회계',
  '요리·식문화',
  '정리·실버·복지·치유',
  '환경·생태',
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
  name: z.string().trim().min(2).max(50),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(8).max(20),
  password: z.string().trim().min(8).max(100).optional(),
  org: z.string().trim().max(100).optional().default(''),
  field: z.string().trim().max(50).optional().default(''),
  area: z.string().trim().max(100).optional().default(''),
  intro: z.string().trim().max(1000).optional().default(''),
  career: z.string().trim().max(2000).optional().default(''),
  address: z.string().trim().max(200).optional().default(''),
  instagram: z.string().trim().max(100).optional().default(''),
  instagramOpen: z.enum(INSTAGRAM_VISIBILITY_OPTIONS).optional().default('미공개'),
  portfolioLink: z.string().trim().max(500).optional().default(''),
  profilePhoto: z.string().trim().max(2000).optional().default(''),
  consent: consentPayloadSchema,
});

export type RegisterPayload = z.infer<typeof registerPayloadSchema>;

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(2).max(50).optional(),
  phone: z.string().trim().min(8).max(20).optional(),
  org: z.string().trim().max(100).optional(),
  field: z.string().trim().max(50).optional(),
  area: z.string().trim().max(100).optional(),
  intro: z.string().trim().max(1000).optional(),
  career: z.string().trim().max(2000).optional(),
  address: z.string().trim().max(200).optional(),
  instagram: z.string().trim().max(100).optional(),
  instagramOpen: z.enum(INSTAGRAM_VISIBILITY_OPTIONS).optional(),
  portfolioLink: z.string().trim().max(500).optional(),
  profilePhoto: z.string().trim().max(2000).optional(),
  marketingAccepted: z.boolean().optional(),
  profilePublicAccepted: z.boolean().optional(),
});

export type ProfileUpdatePayload = z.infer<typeof profileUpdateSchema>;

export const inquiryContactMethodSchema = z.enum(['PHONE', 'EMAIL', 'NONE']);
export type InquiryContactMethod = z.infer<typeof inquiryContactMethodSchema>;

export const inquiryCreateSchema = z
  .object({
    teacherName: z.string().trim().min(1),
    teacherEmail: z.string().trim().email().optional(),
    inquirerName: z.string().trim().min(2),
    requesterEmail: z.string().trim().email(),
    contactMethod: inquiryContactMethodSchema,
    contactValue: z.string().trim().optional().default(''),
    purpose: z.string().trim().min(1),
    message: z.string().trim().max(300).optional().default(''),
  })
  .superRefine((data, ctx) => {
    if (data.contactMethod === 'NONE') {
      return;
    }

    if (!data.contactValue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['contactValue'],
        message: data.contactMethod === 'EMAIL' ? '이메일을 입력해주세요.' : '전화번호를 입력해주세요.',
      });
      return;
    }

    if (data.contactMethod === 'EMAIL' && !z.string().email().safeParse(data.contactValue).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['contactValue'],
        message: '올바른 이메일 형식을 입력해주세요.',
      });
    }

    if (data.contactMethod === 'PHONE' && data.contactValue.replace(/[^0-9]/g, '').length < 8) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['contactValue'],
        message: '연락 가능한 전화번호를 입력해주세요.',
      });
    }
  });

export type InquiryCreatePayload = z.infer<typeof inquiryCreateSchema>;

export const inquiryForwardSchema = z.object({
  inquiryId: z.string().trim().min(1).max(100),
  teacherEmail: z.string().trim().email().max(255),
  teacherName: z.string().trim().min(1).max(50),
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(3000),
});

export const inquiryReplySchema = z.object({
  inquiryId: z.string().trim().min(1).max(100),
  memberEmail: z.string().trim().email().max(255),
  memberName: z.string().trim().min(1).max(50),
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(3000),
});

export const adminInstructorStatusSchema = z.object({
  email: z.string().trim().email(),
  status: z.string().trim().min(1),
});

export const adminInstructorUpdateSchema = z.object({
  email: z.string().trim().email().max(255),
  name: z.string().trim().min(2).max(50),
  contactEmail: optionalEmailSchema,
  phone: z.string().trim().max(20).optional().default(''),
  org: z.string().trim().max(100).optional().default(''),
  field: z.string().trim().max(50).optional().default(''),
  area: z.string().trim().max(100).optional().default(''),
  intro: z.string().trim().max(1000).optional().default(''),
  career: z.string().trim().max(2000).optional().default(''),
  address: z.string().trim().max(200).optional().default(''),
  instagram: z.string().trim().max(100).optional().default(''),
  instagramOpen: z.enum(INSTAGRAM_VISIBILITY_OPTIONS).optional().default('미공개'),
  portfolioLink: z.string().trim().max(500).optional().default(''),
  profilePhoto: z.string().trim().max(2000).optional().default(''),
  isLocal: z.enum(['Y', 'N']).optional().default('N'),
  status: z.string().trim().max(20).optional().default('대기'),
  finalStatus: z.string().trim().max(20).optional().default('대기'),
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
  category: 'CENTER_INQUIRY' | 'TEACHER_FORWARD' | 'MEMBER_REPLY' | 'CHAT_MESSAGE';
  to: string;
  subject: string;
  html: string;
  relatedInquiryId?: string;
  relatedRoomId?: string;
  status: 'QUEUED' | 'SENT' | 'FAILED' | 'SKIPPED';
  errorMessage?: string;
  createdAt: string;
  sentAt?: string;
};

export const CHAT_ROOM_MAX_LENGTH = 300;
export const CHAT_ROOM_WARN_LENGTH = 240;

export type ChatRoomStatus = 'PENDING' | 'ACTIVE' | 'ARCHIVED';

export type ChatRoom = {
  id: string;
  inquiryId: string;
  memberEmail: string;
  memberName: string;
  instructorEmail: string;
  instructorName: string;
  status: ChatRoomStatus;
  totalLength: number;
  lastMessage: string;
  lastMessageAt: string;
  firstMessageNotified: boolean;
  unreadCount: Record<string, number>;
  hiddenFor?: string[];
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
};

export type ChatMessage = {
  id: string;
  roomId: string;
  senderEmail: string;
  senderName: string;
  senderRole: 'USER' | 'INSTRUCTOR' | 'ADMIN';
  content: string;
  createdAt: string;
};
