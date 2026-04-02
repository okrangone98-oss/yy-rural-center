/**
 * Yangyang Iumteo Integrated Backend GAS v4 (3-sheet policy)
 *
 * 운영 원본 시트
 * 1) 양양이음터강사DB
 * 2) 이용자DB
 * 3) 문의접수
 */


/** 스크립트 속성에서 설정을 불러오는 헬퍼 함수 */
function getProperty_(key, defaultValue) {
  var value = PropertiesService.getScriptProperties().getProperty(key);
  return value || defaultValue || '';
}

function getSpreadsheetId_() {
  return getProperty_('SPREADSHEET_ID', '1vTO3geLtt5vZ-bOZiY4vb_Rd48xcQGJyZbmjXcHA1ZDnDmFQWAysgxvD-EumgkalVDlmRgdHfzqIVwf');
}

function getApiKey_() {
  return getProperty_('API_KEY', 'yy-iumteo-secret-key-2026');
}

const HEADER_ROW = 1;
const FIRST_DATA_ROW = 2;

const SHEET = {
  INSTRUCTOR_DB: '양양이음터강사DB',
  MEMBER_DB: '이용자DB',
  INQUIRY_CANDIDATES: ['문의접수', '문의내역DB']
};

const FIELD = {
  instructor: {
    name: ['성명'],
    org: ['소속'],
    intro: ['상세내용'],
    career: ['주요경력'],
    email: ['이메일'],
    instagram: ['인스타그램주소'],
    instagramOpen: ['인스타그램공개여부'],
    field: ['강의분야'],
    consent: ['동의여부'],
    local: ['로컬'],
    phone: ['연락처'],
    address: ['주소'],
    password: ['사용자비번'],
    profilePhoto: ['프로필사진'],
    status: ['상태'],
    instructorId: ['강사ID'],
    loginEmail: ['로그인용 이메일'],
    activityArea: ['Activity_Area'],
    finalStatus: ['승인상태(최종)'],
    updatedAt: ['Updated_At'],
    portfolio: ['Portfolio_Link']
  },
  member: {
    joinedAt: ['가입일'],
    name: ['이용자명'],
    email: ['이메일'],
    org: ['소속명'],
    phone: ['연락처'],
    password: ['비밀번호'],
    role: ['권한(USER)'],
    memberType: ['회원유형'],
    status: ['상태'],
    providerId: ['Provider_ID'],
    passwordHash: ['Password_Hash'],
    lastLogin: ['Last_Login']
  },
  inquiry: {
    receivedAt: ['접수일시'],
    teacherName: ['문의대상(강사명)'],
    inquirerName: ['신청인 성명'],
    inquirerPhone: ['신청인 연락처'],
    purpose: ['문의 목적'],
    message: ['상세 내용'],
    inquirerEmail: ['연락받을 이메일'],
    status: ['처리 상태']
  }
};

function normalizeText_(value) {
  return String(value || '').trim();
}

function normalizeHeader_(value) {
  return normalizeText_(value).replace(/\s+/g, ' ');
}

function compactHeader_(value) {
  return normalizeHeader_(value).replace(/\s+/g, '').toLowerCase();
}

function normalizeEmail(email) {
  return normalizeText_(email).toLowerCase();
}

function normalizePhone(phone) {
  return String(phone || '').replace(/\D+/g, '');
}

function nowIso_() {
  return new Date().toISOString();
}

function nowSeoul_() {
  return Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function ok_(message, data) {
  return json_({ ok: true, success: true, message: message, data: data || null });
}

function fail_(message, code) {
  return json_({ ok: false, success: false, message: message, code: code || 400 });
}

function ensureApiKey_(requestKey) {
  var apiKey = getApiKey_();
  if (!apiKey || requestKey !== apiKey) {
    throw new Error('Unauthorized API key');
  }
}

function getSS_() {
  try {
    return SpreadsheetApp.openById(getSpreadsheetId_());
  } catch (e) {
    return SpreadsheetApp.getActiveSpreadsheet();
  }
}

function getSheet_(name) {
  var sh = getSS_().getSheetByName(name);
  if (!sh) throw new Error('Sheet not found: ' + name);
  return sh;
}

function getInquirySheet_() {
  var ss = getSS_();
  for (var i = 0; i < SHEET.INQUIRY_CANDIDATES.length; i += 1) {
    var sh = ss.getSheetByName(SHEET.INQUIRY_CANDIDATES[i]);
    if (sh) return sh;
  }
  throw new Error("문의 시트를 찾을 수 없습니다. '문의접수' 또는 '문의내역DB'를 확인하세요.");
}

function getHeaderInfo_(sheet) {
  var headers = sheet.getRange(HEADER_ROW, 1, 1, sheet.getLastColumn()).getValues()[0];
  var map = {};
  for (var i = 0; i < headers.length; i += 1) {
    var key = normalizeHeader_(headers[i]);
    if (key) {
      map[key] = i;
    }
  }
  return { headers: headers, map: map };
}

function findHeaderKey_(headerMap, aliases) {
  for (var i = 0; i < aliases.length; i += 1) {
    var alias = compactHeader_(aliases[i]);
    var keys = Object.keys(headerMap);
    for (var j = 0; j < keys.length; j += 1) {
      if (compactHeader_(keys[j]) === alias) {
        return keys[j];
      }
    }
  }
  return null;
}

function getColumnIndex_(headerMap, aliases) {
  var key = findHeaderKey_(headerMap, aliases);
  return key === null ? null : headerMap[key];
}

function getDataEntries_(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < FIRST_DATA_ROW) return [];

  var headerInfo = getHeaderInfo_(sheet);
  var rows = sheet.getRange(FIRST_DATA_ROW, 1, lastRow - FIRST_DATA_ROW + 1, sheet.getLastColumn()).getValues();
  var entries = [];

  for (var i = 0; i < rows.length; i += 1) {
    var row = rows[i];
    var hasValue = row.some(function (value) {
      return normalizeText_(value) !== '';
    });
    if (!hasValue) continue;

    var record = {};
    Object.keys(headerInfo.map).forEach(function (key) {
      record[key] = row[headerInfo.map[key]];
    });

    entries.push({
      rowIndex: FIRST_DATA_ROW + i,
      values: row,
      record: record,
      headerMap: headerInfo.map
    });
  }

  return entries;
}

function getRecordValue_(record, aliases) {
  for (var i = 0; i < aliases.length; i += 1) {
    var alias = compactHeader_(aliases[i]);
    var keys = Object.keys(record);
    for (var j = 0; j < keys.length; j += 1) {
      if (compactHeader_(keys[j]) === alias) {
        var value = record[keys[j]];
        if (value !== null && value !== undefined && normalizeText_(value) !== '') {
          return normalizeText_(value);
        }
      }
    }
  }
  return '';
}

function pickFirst_(values) {
  for (var i = 0; i < values.length; i += 1) {
    var value = values[i];
    if (value !== null && value !== undefined && normalizeText_(value) !== '') {
      return normalizeText_(value);
    }
  }
  return '';
}

function buildRowByHeader_(sheet, headerMap, record) {
  var row = new Array(sheet.getLastColumn()).fill('');
  Object.keys(record).forEach(function (header) {
    if (headerMap[header] === undefined) return;
    row[headerMap[header]] = record[header];
  });
  return row;
}

function appendRecord_(sheet, record) {
  var headerInfo = getHeaderInfo_(sheet);
  var row = buildRowByHeader_(sheet, headerInfo.map, record);
  var rowIndex = Math.max(sheet.getLastRow() + 1, FIRST_DATA_ROW);
  sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
  return { rowIndex: rowIndex, sheet: sheet.getName() };
}

function updateRecord_(sheet, rowIndex, record) {
  var headerInfo = getHeaderInfo_(sheet);
  Object.keys(record).forEach(function (header) {
    if (headerInfo.map[header] === undefined) return;
    sheet.getRange(rowIndex, headerInfo.map[header] + 1).setValue(record[header]);
  });
  return { rowIndex: rowIndex, sheet: sheet.getName() };
}

function findInstructorByEmail_(email) {
  var normalized = normalizeEmail(email);
  if (!normalized) return null;

  var sheet = getSheet_(SHEET.INSTRUCTOR_DB);
  var entries = getDataEntries_(sheet);

  for (var i = 0; i < entries.length; i += 1) {
    var entry = entries[i];
    var loginEmail = normalizeEmail(getRecordValue_(entry.record, FIELD.instructor.loginEmail));
    var contactEmail = normalizeEmail(getRecordValue_(entry.record, FIELD.instructor.email));
    if (loginEmail === normalized || contactEmail === normalized) {
      return entry;
    }
  }
  return null;
}

function findMemberByEmail_(email) {
  var normalized = normalizeEmail(email);
  if (!normalized) return null;

  var sheet = getSheet_(SHEET.MEMBER_DB);
  var entries = getDataEntries_(sheet);

  for (var i = 0; i < entries.length; i += 1) {
    var entry = entries[i];
    var memberEmail = normalizeEmail(getRecordValue_(entry.record, FIELD.member.email));
    if (memberEmail === normalized) {
      return entry;
    }
  }
  return null;
}

function assertEmailAvailable_(email) {
  if (findInstructorByEmail_(email) || findMemberByEmail_(email)) {
    throw new Error('이미 등록된 이메일입니다: ' + email);
  }
}

function formatInstructorForClient_(entry) {
  var record = entry.record;
  return Object.assign({}, record, {
    _role: 'INSTRUCTOR',
    _sourceSheet: SHEET.INSTRUCTOR_DB,
    _rowIndex: entry.rowIndex,
    Email: pickFirst_([
      getRecordValue_(record, FIELD.instructor.loginEmail),
      getRecordValue_(record, FIELD.instructor.email)
    ]),
    Name: getRecordValue_(record, FIELD.instructor.name),
    Phone: getRecordValue_(record, FIELD.instructor.phone),
    Org: getRecordValue_(record, FIELD.instructor.org),
    Password_Hash: getRecordValue_(record, FIELD.instructor.password),
    Role: 'INSTRUCTOR'
  });
}

function formatMemberForClient_(entry) {
  var record = entry.record;
  return Object.assign({}, record, {
    _role: 'USER',
    _sourceSheet: SHEET.MEMBER_DB,
    _rowIndex: entry.rowIndex,
    Email: getRecordValue_(record, FIELD.member.email),
    Name: getRecordValue_(record, FIELD.member.name),
    Phone: getRecordValue_(record, FIELD.member.phone),
    Org: getRecordValue_(record, FIELD.member.org),
    Password_Hash: pickFirst_([
      getRecordValue_(record, FIELD.member.passwordHash),
      getRecordValue_(record, FIELD.member.password)
    ]),
    Role: 'USER'
  });
}

function getUserByEmail_(email, preferredRole) {
  var normalizedEmail = normalizeEmail(email);
  var instructorMatch = findInstructorByEmail_(normalizedEmail);
  var memberMatch = findMemberByEmail_(normalizedEmail);

  if (preferredRole === 'INSTRUCTOR' && instructorMatch) {
    return formatInstructorForClient_(instructorMatch);
  }
  if (preferredRole === 'USER' && memberMatch) {
    return formatMemberForClient_(memberMatch);
  }

  if (instructorMatch) return formatInstructorForClient_(instructorMatch);
  if (memberMatch) return formatMemberForClient_(memberMatch);
  return null;
}

function generateInstructorId_() {
  return 'I-' + Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyMMddHHmmss');
}

function buildMemberRecord_(payload, existingRecord) {
  var now = nowSeoul_();
  var base = existingRecord || {};

  return {
    '가입일': pickFirst_([getRecordValue_(base, FIELD.member.joinedAt), now]),
    '이용자명': pickFirst_([payload.name, payload.Name, getRecordValue_(base, FIELD.member.name)]),
    '이메일': normalizeEmail(payload.email || payload.Email || getRecordValue_(base, FIELD.member.email)),
    '소속명': pickFirst_([payload.org, payload.Org, getRecordValue_(base, FIELD.member.org)]),
    '연락처': pickFirst_([payload.phone, payload.Phone, getRecordValue_(base, FIELD.member.phone)]),
    '비밀번호': pickFirst_([payload.password, payload.Password_Hash, getRecordValue_(base, FIELD.member.password)]),
    '권한(USER)': '일반회원',
    '회원유형': pickFirst_([payload.memberType, payload.Member_Type, '일반회원']),
    '상태': pickFirst_([payload.status, payload.Status, getRecordValue_(base, FIELD.member.status), '활성']),
    'Provider_ID': pickFirst_([payload.providerId, payload.provider_id, payload.Provider_ID, getRecordValue_(base, FIELD.member.providerId)]),
    'Password_Hash': pickFirst_([
      payload.passwordHash,
      payload.password_hash,
      payload.Password_Hash,
      payload.password,
      getRecordValue_(base, FIELD.member.passwordHash),
      getRecordValue_(base, FIELD.member.password)
    ]),
    'Last_Login': now
  };
}

function buildInstructorRecord_(payload, existingRecord) {
  var now = nowSeoul_();
  var base = existingRecord || {};
  var email = normalizeEmail(payload.email || payload.Email || getRecordValue_(base, FIELD.instructor.loginEmail) || getRecordValue_(base, FIELD.instructor.email));
  var consent = payload.profilePublicAccepted === false ? '미동의' : pickFirst_([
    payload.consentStatus,
    payload['동의여부'],
    getRecordValue_(base, FIELD.instructor.consent),
    '동의'
  ]);

  return {
    '성명': pickFirst_([payload.name, payload.Name, payload['성명'], getRecordValue_(base, FIELD.instructor.name)]),
    '소속': pickFirst_([payload.org, payload.Org, payload['소속'], getRecordValue_(base, FIELD.instructor.org)]),
    '상세내용': pickFirst_([payload.intro, payload.Intro, payload['상세내용'], payload['소개'], getRecordValue_(base, FIELD.instructor.intro)]),
    '주요경력': pickFirst_([payload.career, payload['주요경력'], getRecordValue_(base, FIELD.instructor.career)]),
    '이메일': pickFirst_([payload.contactEmail, payload['이메일'], email, getRecordValue_(base, FIELD.instructor.email)]),
    '인스타그램주소': pickFirst_([payload.instagram, payload.Instagram, payload['인스타그램주소'], getRecordValue_(base, FIELD.instructor.instagram)]),
    '인스타그램공개여부': pickFirst_([payload.instagramOpen, payload['인스타그램공개여부'], getRecordValue_(base, FIELD.instructor.instagramOpen), '미공개']),
    '강의분야': pickFirst_([payload.field, payload.Field, payload['강의분야'], getRecordValue_(base, FIELD.instructor.field)]),
    '동의여부': consent,
    '로컬': pickFirst_([payload.isLocal, payload['로컬'], getRecordValue_(base, FIELD.instructor.local)]),
    '연락처': pickFirst_([payload.phone, payload.Phone, payload['연락처'], getRecordValue_(base, FIELD.instructor.phone)]),
    '주소': pickFirst_([payload.address, payload.Address, payload['주소'], getRecordValue_(base, FIELD.instructor.address)]),
    '사용자비번': pickFirst_([payload.password, payload.Password_Hash, payload['사용자비번'], getRecordValue_(base, FIELD.instructor.password)]),
    '프로필사진': pickFirst_([payload.profilePhoto, payload.Profile_Photo, payload['프로필사진'], getRecordValue_(base, FIELD.instructor.profilePhoto)]),
    '상태': pickFirst_([payload.status, payload.Status, payload['상태'], getRecordValue_(base, FIELD.instructor.status), '대기']),
    '강사ID': pickFirst_([payload.instructorId, payload['강사ID'], getRecordValue_(base, FIELD.instructor.instructorId), generateInstructorId_()]),
    '로그인용 이메일': pickFirst_([email, getRecordValue_(base, FIELD.instructor.loginEmail)]),
    'Activity_Area': pickFirst_([payload.area, payload.Activity_Area, payload['활동지역'], getRecordValue_(base, FIELD.instructor.activityArea)]),
    '승인상태(최종)': pickFirst_([payload.finalStatus, payload['승인상태(최종)'], getRecordValue_(base, FIELD.instructor.finalStatus), '대기']),
    'Updated_At': now,
    'Portfolio_Link': pickFirst_([payload.portfolioLink, payload.Portfolio_Link, getRecordValue_(base, FIELD.instructor.portfolio)])
  };
}

function registerMember_(payload) {
  var email = normalizeEmail(payload.email || payload.Email);
  if (!email) throw new Error('Email is required');
  assertEmailAvailable_(email);

  var sheet = getSheet_(SHEET.MEMBER_DB);
  var record = buildMemberRecord_(payload, null);
  return appendRecord_(sheet, record);
}

function registerInstructor_(payload) {
  var email = normalizeEmail(payload.email || payload.Email);
  if (!email) throw new Error('Email is required');
  assertEmailAvailable_(email);

  var sheet = getSheet_(SHEET.INSTRUCTOR_DB);
  var record = buildInstructorRecord_(payload, null);
  return appendRecord_(sheet, record);
}

function updateMemberProfile_(payload) {
  var email = normalizeEmail(payload.email || payload.Email);
  if (!email) throw new Error('Email is required');

  var match = findMemberByEmail_(email);
  if (!match) throw new Error('Member not found: ' + email);

  var record = buildMemberRecord_(payload, match.record);
  return updateRecord_(getSheet_(SHEET.MEMBER_DB), match.rowIndex, record);
}

function updateInstructorProfile_(payload) {
  var email = normalizeEmail(payload.email || payload.Email);
  if (!email) throw new Error('Email is required');

  var match = findInstructorByEmail_(email);
  if (!match) throw new Error('Instructor not found: ' + email);

  var source = payload.profileData || payload;
  var record = buildInstructorRecord_(source, match.record);
  return updateRecord_(getSheet_(SHEET.INSTRUCTOR_DB), match.rowIndex, record);
}

function updateInstructorStatus_(payload) {
  var email = normalizeEmail(payload.email || payload.Email);
  var status = normalizeText_(payload.status || payload.Status);
  if (!email) throw new Error('Email is required');
  if (!status) throw new Error('status is required');

  var match = findInstructorByEmail_(email);
  if (!match) throw new Error('Instructor not found: ' + email);

  return updateRecord_(getSheet_(SHEET.INSTRUCTOR_DB), match.rowIndex, {
    '상태': status,
    '승인상태(최종)': status,
    'Updated_At': nowSeoul_()
  });
}

function parseInquiryRowIndex_(payload) {
  var direct = Number(payload.rowIndex || payload.sheetRowIndex || 0);
  if (direct > 0) return direct;

  var inquiryId = normalizeText_(payload.inquiryId);
  var match = inquiryId.match(/^sheet-(\d+)$/);
  if (match) {
    return Number(match[1]);
  }
  return 0;
}

function updateInquiryStatus_(payload) {
  var rowIndex = parseInquiryRowIndex_(payload);
  var status = normalizeText_(payload.status || payload.Status);
  if (!rowIndex) throw new Error('문의 rowIndex 또는 inquiryId(sheet-행번호)가 필요합니다.');
  if (!status) throw new Error('status is required');

  var sheet = getInquirySheet_();
  var headerInfo = getHeaderInfo_(sheet);
  var statusIndex = getColumnIndex_(headerInfo.map, FIELD.inquiry.status);
  if (statusIndex === null) {
    throw new Error("문의접수 시트에 '처리 상태' 헤더가 없습니다.");
  }

  sheet.getRange(rowIndex, statusIndex + 1).setValue(status);
  return { rowIndex: rowIndex, sheet: sheet.getName(), status: status };
}

function submitInquiry_(payload) {
  var sheet = getInquirySheet_();
  var record = {
    '접수일시': nowSeoul_(),
    '문의대상(강사명)': payload.teacherName || '',
    '신청인 성명': payload.inquirerName || '',
    '신청인 연락처': payload.inquirerPhone || '',
    '문의 목적': payload.purpose || '',
    '상세 내용': payload.message || '',
    '연락받을 이메일': payload.inquirerEmail || '',
    '처리 상태': payload.status || '접수대기'
  };
  return appendRecord_(sheet, record);
}

function getInstructors_(includeAll) {
  var sheet = getSheet_(SHEET.INSTRUCTOR_DB);
  var entries = getDataEntries_(sheet);
  var result = [];

  for (var i = 0; i < entries.length; i += 1) {
    var entry = entries[i];
    var record = entry.record;
    var status = getRecordValue_(record, FIELD.instructor.status);
    var consent = getRecordValue_(record, FIELD.instructor.consent);

    if (includeAll || (status === '승인' && consent !== '미동의')) {
      var obj = Object.assign({}, record, {
        rowIndex: entry.rowIndex,
        status: pickFirst_([status, '대기']),
        isLocal: pickFirst_([getRecordValue_(record, FIELD.instructor.local), 'N'])
      });
      if (!obj['로그인용 이메일'] && obj['이메일']) {
        obj['로그인용 이메일'] = obj['이메일'];
      }
      result.push(obj);
    }
  }

  return result;
}

function getMembers_() {
  var sheet = getSheet_(SHEET.MEMBER_DB);
  var entries = getDataEntries_(sheet);
  return entries.map(function (entry) {
    return Object.assign({}, entry.record, {
      rowIndex: entry.rowIndex
    });
  });
}

function getInquiries_() {
  var sheet = getInquirySheet_();
  var entries = getDataEntries_(sheet);
  return entries.map(function (entry) {
    return Object.assign({}, entry.record, {
      rowIndex: entry.rowIndex,
      inquiryId: 'sheet-' + entry.rowIndex
    });
  });
}

function doGet(e) {
  try {
    var action = e.parameter.action;
    var apiKey = e.parameter.apiKey;

    if (action === 'getInstructors') {
      var includeAll = String(e.parameter.includeAll || '') === 'Y' || String(e.parameter.includeAll || '') === 'true';
      if (includeAll) ensureApiKey_(apiKey);
      return ok_('Instructors loaded', getInstructors_(includeAll));
    }

    if (action === 'getUser') {
      ensureApiKey_(apiKey);
      var user = getUserByEmail_(e.parameter.email, e.parameter.role || e.parameter.type);
      if (!user) return fail_('User not found', 404);
      return ok_('User loaded', user);
    }

    if (action === 'getMembers') {
      ensureApiKey_(apiKey);
      return ok_('Members loaded', getMembers_());
    }

    if (action === 'getInquiries') {
      ensureApiKey_(apiKey);
      return ok_('Inquiries loaded', getInquiries_());
    }

    if (action === 'health') {
      return ok_('ok', { now: nowIso_(), spreadsheetId: SPREADSHEET_ID, policy: '3-sheet' });
    }

    return fail_('Unsupported GET action', 400);
  } catch (err) {
    return fail_(err.message || String(err), 500);
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.tryLock(15000);

    var payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var action = payload.action;

    if (action === 'inquiry') {
      return ok_('Inquiry submitted', submitInquiry_(payload));
    }

    ensureApiKey_(payload.apiKey);

    if (action === 'registerMember') {
      return ok_('Member registered', registerMember_(payload));
    }

    if (action === 'registerInstructor') {
      return ok_('Instructor registered', registerInstructor_(payload));
    }

    if (action === 'updateMemberProfile') {
      return ok_('Member profile updated', updateMemberProfile_(payload));
    }

    if (action === 'updateInstructorProfile' || action === 'updateProfile') {
      return ok_('Instructor profile updated', updateInstructorProfile_(payload));
    }

    if (action === 'updateInstructorStatus') {
      return ok_('Instructor status updated', updateInstructorStatus_(payload));
    }

    if (action === 'updateInquiryStatus') {
      return ok_('Inquiry status updated', updateInquiryStatus_(payload));
    }

    return fail_('Unsupported POST action', 400);
  } catch (err) {
    return fail_(err.message || String(err), 500);
  } finally {
    try {
      lock.releaseLock();
    } catch (e) {
      // noop
    }
  }
}

function doOptions() {
  return ContentService.createTextOutput('').setMimeType(ContentService.MimeType.TEXT);
}
