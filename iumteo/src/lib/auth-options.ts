import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { getAppPath } from '@/lib/app-url';
import { assertGasSuccess, gasGet, type GasEnvelope } from '@/lib/gas-api';
import { normalizeEmail, normalizePhone, pickByAliases, type CsvRecord } from '@/lib/sheets';

type AppRole = 'GUEST' | 'USER' | 'INSTRUCTOR' | 'ADMIN';
type UserSource = 'USER' | 'INSTRUCTOR';

type AuthUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  organization: string;
  role: AppRole;
  provider: string;
  consentDate: string | null;
  consentRequired: boolean;
  password: string;
};

const EMAIL_ALIASES = [
  '이메일',
  '로그인 이메일',
  '로그인용 이메일',
  '이메일(로그인용)',
  'Email',
  'email',
];

const PHONE_ALIASES = [
  '연락처',
  '핸드폰 번호',
  '전화번호',
  '휴대폰',
  '휴대폰 번호',
  'Phone',
  'phone',
];

const NAME_ALIASES = ['이용자명', '이름', '성명', '강사명', 'Name', 'name'];
const ORG_ALIASES = ['소속', '기관', 'Org', 'org'];
const ROLE_ALIASES = ['role', 'Role', '회원유형', '사용자유형', '권한', '권한(USER)', '_role'];
const PASSWORD_ALIASES = ['비밀번호', '사용자비번', 'Password_Hash', 'password', 'Password'];

function isEmailIdentifier(value: string) {
  return value.includes('@');
}

function getRecordEmail(record: CsvRecord) {
  return normalizeEmail(pickByAliases(record, EMAIL_ALIASES));
}

function getRecordPhone(record: CsvRecord) {
  return normalizePhone(pickByAliases(record, PHONE_ALIASES));
}

function getRecordName(record: CsvRecord, fallback: string) {
  return pickByAliases(record, NAME_ALIASES) || fallback;
}

function resolveRole(record: CsvRecord, source?: UserSource): AppRole {
  const rawRole = String(pickByAliases(record, ROLE_ALIASES) || source || 'USER').trim().toUpperCase();

  if (rawRole.includes('ADMIN') || rawRole.includes('관리자')) return 'ADMIN';
  if (rawRole.includes('INSTRUCTOR') || rawRole.includes('강사')) return 'INSTRUCTOR';
  if (rawRole.includes('GUEST')) return 'GUEST';
  return source === 'INSTRUCTOR' ? 'INSTRUCTOR' : 'USER';
}

function resolvePassword(record: CsvRecord, role: AppRole, phone: string) {
  const storedPassword = pickByAliases(record, PASSWORD_ALIASES);
  if (storedPassword) return storedPassword;

  if (role === 'INSTRUCTOR' && phone.length >= 4) {
    return phone.slice(-4);
  }

  return '';
}

function toAuthUser(record: CsvRecord, source?: UserSource): AuthUser | null {
  const email = getRecordEmail(record);
  const phone = getRecordPhone(record);
  const role = resolveRole(record, source);
  const name = getRecordName(record, email || phone || '이음터 사용자');
  const password = resolvePassword(record, role, phone);

  if (!email) {
    return null;
  }

  return {
    id: email,
    name,
    email,
    phone,
    organization: pickByAliases(record, ORG_ALIASES) || '',
    role,
    provider: 'credentials',
    consentDate: new Date().toISOString(),
    consentRequired: false,
    password,
  };
}

async function fetchGasRecords(action: 'getInstructors' | 'getMembers', includeAll = false) {
  const params = new URLSearchParams({ action });
  if (includeAll) {
    params.set('includeAll', 'Y');
  }

  const result = assertGasSuccess(await gasGet<GasEnvelope<CsvRecord[]>>(params), action);
  return Array.isArray(result.data) ? result.data : [];
}

async function loadGasUserByEmail(email: string, preferredRole?: string) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  const params = new URLSearchParams({
    action: 'getUser',
    email: normalizedEmail,
  });

  if (preferredRole) {
    params.set('role', preferredRole);
  }

  const result = assertGasSuccess(await gasGet<GasEnvelope<CsvRecord>>(params), 'getUser');
  return result.data ? toAuthUser(result.data) : null;
}

async function findGasUserByIdentifier(identifier: string, loginRole?: string) {
  const trimmed = String(identifier || '').trim();
  if (!trimmed) return null;

  const isEmail = isEmailIdentifier(trimmed);
  const normalized = isEmail ? normalizeEmail(trimmed) : normalizePhone(trimmed);
  if (!normalized) return null;

  const [instructors, members] = await Promise.all([
    fetchGasRecords('getInstructors', true),
    fetchGasRecords('getMembers'),
  ]);

  const matchFn = (record: CsvRecord) => isEmail
    ? getRecordEmail(record) === normalized
    : getRecordPhone(record) === normalized;

  const foundInstructor = instructors.find(matchFn);
  const foundMember = members.find(matchFn);

  if (!loginRole) {
    if (foundInstructor) return toAuthUser(foundInstructor, 'INSTRUCTOR');
    if (foundMember) return toAuthUser(foundMember, 'USER');
    return null; // Both null
  }

  if (loginRole === 'INSTRUCTOR') {
    if (foundInstructor) return toAuthUser(foundInstructor, 'INSTRUCTOR');
    if (foundMember) throw new Error('일반회원으로 등록된 계정입니다. "일반회원 로그인" 탭을 선택해 주세요.');
    return null;
  }

  if (loginRole === 'USER') {
    if (foundMember) return toAuthUser(foundMember, 'USER');
    if (foundInstructor) throw new Error('강사로 등록 또는 승인 대기 중인 계정입니다. "강사 로그인" 탭을 선택해 주세요.');
    return null;
  }

  return null;
}

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      phone?: string | null;
      role: AppRole;
      provider: string;
      consentDate?: string | null;
      consentRequired?: boolean;
      organization?: string | null;
    };
  }

  interface User {
    id: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    role: AppRole;
    provider: string;
    consentDate?: string | null;
    consentRequired?: boolean;
    organization?: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    phone?: string | null;
    role: AppRole;
    provider: string;
    consentDate?: string | null;
    consentRequired?: boolean;
    organization?: string | null;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: '이음터 로그인',
      credentials: {
        username: { label: '전화번호 또는 가입 이메일', type: 'text' },
        password: { label: '비밀번호', type: 'password' },
        role: { label: '로그인 역할', type: 'text' },
      },
      async authorize(credentials) {
        const identifier = String(credentials?.username || '').trim();
        const password = String(credentials?.password || '').trim();
        const loginRole = String(credentials?.role || '').trim();

        if (!identifier || !password) {
          return null;
        }

        const adminId = process.env.IUMTEO_ADMIN_ID || process.env.ADMIN_USERNAME || '';
        const adminPassword = process.env.IUMTEO_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || '';

        if (adminId && adminPassword && identifier === adminId && password === adminPassword) {
          return {
            id: 'admin',
            name: '관리자',
            email: process.env.IUMTEO_ADMIN_EMAIL || 'admin@yycenter.kr',
            phone: '',
            role: 'ADMIN',
            provider: 'credentials',
            consentDate: new Date().toISOString(),
            consentRequired: false,
            organization: '양양군 농촌활성화지원센터',
          };
        }

        try {
          const gasUser = await findGasUserByIdentifier(identifier, loginRole);
          if (!gasUser) {
            return null;
          }

          if (password !== gasUser.password) {
            return null;
          }

          if (loginRole) {
            const isInstructorLogin = loginRole === 'INSTRUCTOR';
            const isUserLogin = loginRole === 'USER';

            if (isUserLogin && (gasUser.role === 'INSTRUCTOR' || gasUser.role === 'GUEST')) {
              throw new Error('강사로 등록 또는 승인 대기 중인 계정입니다. "강사 로그인" 탭을 선택해 주세요.');
            }

            if (isInstructorLogin && gasUser.role === 'USER') {
              throw new Error('일반회원으로 등록된 계정입니다. "일반회원 로그인" 탭을 선택해 주세요.');
            }
          }

          return {
            id: gasUser.id,
            name: gasUser.name,
            email: gasUser.email,
            phone: gasUser.phone,
            organization: gasUser.organization || null,
            role: gasUser.role,
            provider: gasUser.provider,
            consentDate: gasUser.consentDate,
            consentRequired: gasUser.consentRequired,
          };
        } catch (error) {
          console.error('[NextAuth] credentials authorize failed:', error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.provider = user.provider;
        token.phone = user.phone || null;
        token.consentDate = user.consentDate || null;
        token.consentRequired = user.consentRequired || false;
        token.organization = user.organization || null;
      }

      // role이 없거나 GUEST인 경우에만 GAS 재조회 (매 요청마다 재조회 방지)
      const needsRoleRefresh = !token.role || token.role === 'GUEST';
      if (token.email && needsRoleRefresh) {
        const gasUser = await loadGasUserByEmail(String(token.email));
        if (gasUser) {
          token.id = gasUser.id;
          token.role = gasUser.role;
          token.provider = gasUser.provider;
          token.phone = gasUser.phone || null;
          token.consentDate = gasUser.consentDate;
          token.consentRequired = gasUser.consentRequired;
          if (!token.name) {
            token.name = gasUser.name;
          }
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.provider = token.provider;
        session.user.phone = token.phone || null;
        session.user.consentDate = token.consentDate || null;
        session.user.consentRequired = token.consentRequired || false;
        session.user.organization = token.organization || null;
      }

      return session;
    },
  },
  pages: {
    signIn: getAppPath('/login'),
    error: getAppPath('/login'),
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
  },
  secret: process.env.NEXTAUTH_SECRET,
};

if (!process.env.NEXTAUTH_SECRET) {
  throw new Error('[auth] NEXTAUTH_SECRET 환경변수가 설정되지 않았습니다. .env.local을 확인하세요.');
}
