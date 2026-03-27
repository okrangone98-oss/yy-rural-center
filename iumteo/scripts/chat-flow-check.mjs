import fs from 'node:fs/promises';
import path from 'node:path';

const envPath = path.resolve('.env.local');
const baseUrl = process.env.CHAT_CHECK_BASE_URL || 'http://localhost:3014/iumteo';
const memberEmail = process.env.CHAT_TEST_MEMBER_EMAIL || 'okrangone98@gmail.com';
const instructorEmail = process.env.CHAT_TEST_INSTRUCTOR_EMAIL || 'seizeworld@naver.com';

function maskEmail(email) {
  const [local, domain] = String(email || '').split('@');
  if (!local || !domain) return email;
  return `${local.slice(0, 2)}***@${domain}`;
}

function normalizePhone(value) {
  return String(value || '').replace(/\D+/g, '');
}

function readEnv(text) {
  const env = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const separatorIndex = line.indexOf('=');
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    env[key] = value;
  }
  return env;
}

function pickValue(record, aliases) {
  for (const alias of aliases) {
    const matchedKey = Object.keys(record).find(
      (key) => key === alias || key.replace(/\s+/g, '') === alias.replace(/\s+/g, ''),
    );
    if (matchedKey && String(record[matchedKey] || '').trim()) {
      return String(record[matchedKey]).trim();
    }
  }
  return '';
}

async function loadLocalEnv() {
  const text = await fs.readFile(envPath, 'utf8');
  return readEnv(text);
}

async function fetchGasUser(env, email) {
  const url = new URL(env.GAS_API_URL);
  url.searchParams.set('action', 'getUser');
  url.searchParams.set('apiKey', env.GAS_API_KEY);
  url.searchParams.set('email', email);

  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`GAS getUser failed for ${maskEmail(email)}: ${response.status}`);
  }

  const payload = await response.json();
  if (payload?.success === false || payload?.ok === false) {
    throw new Error(payload?.message || `GAS getUser failed for ${maskEmail(email)}`);
  }

  if (!payload?.data || typeof payload.data !== 'object') {
    throw new Error(`No GAS user data found for ${maskEmail(email)}`);
  }

  return payload.data;
}

function buildCredential(record, role) {
  const email = pickValue(record, ['이메일', '로그인 이메일', '로그인용 이메일', 'Email', 'email']);
  const name = pickValue(record, ['이용자명', '이름', '성명', '강사명', 'Name', 'name']);
  const phone = normalizePhone(pickValue(record, ['연락처', '전화번호', '핸드폰 번호', 'Phone', 'phone']));
  const password =
    pickValue(record, ['비밀번호', '사용자비번', 'Password_Hash', 'password', 'Password']) ||
    (role === 'INSTRUCTOR' && phone.length >= 4 ? phone.slice(-4) : '');

  if (!email) {
    throw new Error(`${role} test account is missing an email.`);
  }

  if (!password) {
    throw new Error(`${role} test account is missing a usable password.`);
  }

  return { email, name, phone, password };
}

function createCookieJar() {
  const jar = new Map();

  return {
    apply(response) {
      const setCookies = response.headers.getSetCookie?.() || [];
      for (const entry of setCookies) {
        const firstSegment = entry.split(';', 1)[0];
        const separatorIndex = firstSegment.indexOf('=');
        if (separatorIndex < 0) continue;
        const key = firstSegment.slice(0, separatorIndex);
        const value = firstSegment.slice(separatorIndex + 1);
        jar.set(key, value);
      }
    },
    header() {
      return Array.from(jar.entries())
        .map(([key, value]) => `${key}=${value}`)
        .join('; ');
    },
  };
}

async function fetchJson(url, options = {}, jar) {
  const headers = new Headers(options.headers || {});
  if (jar?.header()) headers.set('cookie', jar.header());

  const response = await fetch(url, {
    ...options,
    headers,
    redirect: 'manual',
  });

  jar?.apply(response);

  let data = null;
  const text = await response.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  return { response, data };
}

async function loginWithCredentials(base, credential) {
  const jar = createCookieJar();

  const csrf = await fetchJson(`${base}/api/auth/csrf`, { method: 'GET' }, jar);
  if (!csrf.response.ok || !csrf.data?.csrfToken) {
    throw new Error(`Failed to fetch csrf token for ${maskEmail(credential.email)}`);
  }

  const form = new URLSearchParams({
    csrfToken: csrf.data.csrfToken,
    username: credential.email,
    password: credential.password,
    callbackUrl: `${base}/profile`,
    json: 'true',
  });

  const login = await fetchJson(
    `${base}/api/auth/callback/credentials?json=true`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    },
    jar,
  );

  if (login.data?.error) {
    throw new Error(`Login failed for ${maskEmail(credential.email)}: ${login.data.error}`);
  }

  const session = await fetchJson(`${base}/api/auth/session`, { method: 'GET' }, jar);
  if (!session.response.ok || !session.data?.user?.email) {
    throw new Error(`Session lookup failed for ${maskEmail(credential.email)}`);
  }

  return { jar, session: session.data };
}

async function run() {
  const env = await loadLocalEnv();
  const memberRecord = await fetchGasUser(env, memberEmail);
  const instructorRecord = await fetchGasUser(env, instructorEmail);

  const member = buildCredential(memberRecord, 'USER');
  const instructor = buildCredential(instructorRecord, 'INSTRUCTOR');

  const memberLogin = await loginWithCredentials(baseUrl, member);
  const instructorLogin = await loginWithCredentials(baseUrl, instructor);

  const inquiryPayload = {
    teacherName: instructor.name,
    teacherEmail: instructor.email,
    inquirerName: member.name,
    inquirerPhone: member.phone,
    inquirerEmail: member.email,
    purpose: 'Codex chat flow check',
    message: `Automated check at ${new Date().toISOString()}`,
  };

  const inquiryResult = await fetchJson(
    `${baseUrl}/api/inquiries`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(inquiryPayload),
    },
    memberLogin.jar,
  );

  if (!inquiryResult.response.ok || !inquiryResult.data?.success) {
    throw new Error(`Inquiry submission failed: ${inquiryResult.data?.message || inquiryResult.response.status}`);
  }

  const { inquiryId, roomId } = inquiryResult.data.data || {};
  if (!roomId) {
    throw new Error('Inquiry did not create a chat room.');
  }

  const instructorInquiries = await fetchJson(
    `${baseUrl}/api/instructor/inquiries`,
    { method: 'GET' },
    instructorLogin.jar,
  );
  if (!instructorInquiries.response.ok || !instructorInquiries.data?.success) {
    throw new Error(`Instructor inquiries failed: ${instructorInquiries.data?.message || instructorInquiries.response.status}`);
  }

  const matchedInquiry = Array.isArray(instructorInquiries.data.data)
    ? instructorInquiries.data.data.find((item) => item.inquiryId === inquiryId)
    : null;
  if (!matchedInquiry) {
    throw new Error('Instructor inquiry list does not contain the submitted inquiry.');
  }

  const acceptResult = await fetchJson(
    `${baseUrl}/api/chat/rooms/${roomId}/accept`,
    { method: 'POST' },
    instructorLogin.jar,
  );
  if (!acceptResult.response.ok || !acceptResult.data?.success) {
    throw new Error(`Chat accept failed: ${acceptResult.data?.message || acceptResult.response.status}`);
  }

  const memberMessage = await fetchJson(
    `${baseUrl}/api/chat/rooms/${roomId}/messages`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'Member automated hello' }),
    },
    memberLogin.jar,
  );
  if (!memberMessage.response.ok || !memberMessage.data?.success) {
    throw new Error(`Member chat message failed: ${memberMessage.data?.message || memberMessage.response.status}`);
  }

  const instructorMessage = await fetchJson(
    `${baseUrl}/api/chat/rooms/${roomId}/messages`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'Instructor automated reply' }),
    },
    instructorLogin.jar,
  );
  if (!instructorMessage.response.ok || !instructorMessage.data?.success) {
    throw new Error(`Instructor chat message failed: ${instructorMessage.data?.message || instructorMessage.response.status}`);
  }

  const roomResult = await fetchJson(
    `${baseUrl}/api/chat/rooms/${roomId}`,
    { method: 'GET' },
    memberLogin.jar,
  );
  if (!roomResult.response.ok || !roomResult.data?.success) {
    throw new Error(`Chat room fetch failed: ${roomResult.data?.message || roomResult.response.status}`);
  }

  const messagesResult = await fetchJson(
    `${baseUrl}/api/chat/rooms/${roomId}/messages`,
    { method: 'GET' },
    memberLogin.jar,
  );
  if (!messagesResult.response.ok || !messagesResult.data?.success) {
    throw new Error(`Chat messages fetch failed: ${messagesResult.data?.message || messagesResult.response.status}`);
  }

  const messages = messagesResult.data?.data?.messages || [];
  const archiveResult = await fetchJson(
    `${baseUrl}/api/chat/rooms/${roomId}/archive`,
    { method: 'POST' },
    instructorLogin.jar,
  );
  if (!archiveResult.response.ok || !archiveResult.data?.success) {
    throw new Error(`Chat archive failed: ${archiveResult.data?.message || archiveResult.response.status}`);
  }

  console.log(
    JSON.stringify(
      {
        member: maskEmail(member.email),
        instructor: maskEmail(instructor.email),
        inquiryId,
        roomId,
        messages: messages.length,
        roomStatus: roomResult.data?.data?.room?.status || null,
        archived: true,
      },
      null,
      2,
    ),
  );
}

run().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
