// ====== 통합 백엔드 URL 가져오기 ======
function getBoardApiUrl() {
    return window.SHEET_CONFIG?.teachers?.submitUrl || "https://script.google.com/macros/s/AKfycbxm-QD0hTr2FV7fVYRinOuWVOkS1CDSkb9urPt0BKMM9y1YrVrJjBX2BjMRaLbLx0Mv/exec";
}

// ====== 현재 사용자 정보 ======
function getCurrentUser() {
    const saved = sessionStorage.getItem('iumteo_auth');
    if (saved) {
        try {
            return JSON.parse(saved); // { role, user: { name, phone, ... } }
        } catch (err) { }
    }
    return null;
}

// ====== 문의하기 (기존 로직 유지, 통합 URL 연결 가능 시 대체) ======
function openContactModal() {
    const modal = document.getElementById('contact-modal');
    if (modal) modal.classList.add('is-open');

    // 자동 완성 로직 추가
    const auth = getCurrentUser();
    if (auth && auth.user) {
        const nameInput = document.getElementById('contact-name');
        const phoneInput = document.getElementById('contact-phone');
        if (nameInput) nameInput.value = auth.user.name || '';
        if (phoneInput) phoneInput.value = auth.user.phone || '';
    }
}

function closeContactModal() {
    document.getElementById('contact-modal').classList.remove('is-open');
    document.getElementById('contact-form').reset();
    const status = document.getElementById('contact-status');
    if (status) status.textContent = '';
}

async function submitContactForm(e) {
    e.preventDefault();
    const btn = document.getElementById('contact-submit-btn');
    const status = document.getElementById('contact-status');
    const name = document.getElementById('contact-name').value;
    const phone = document.getElementById('contact-phone').value;
    const message = document.getElementById('contact-message').value;

    btn.disabled = true;
    status.textContent = '제출 중...';
    status.style.color = '#666';

    try {
        const payload = {
            action: 'inquiry',
            teacherName: '센터공통(자유문의)',
            inquirerName: name,
            inquirerPhone: phone,
            purpose: '자유문의',
            message: message
        };

        const res = await fetch(getBoardApiUrl(), {
            method: "POST",
            headers: { "Content-Type": "text/plain" }, // no-cors 우회 위한 text/plain
            body: JSON.stringify(payload)
        });

        alert("문의가 접수되었습니다.");
        closeContactModal();
    } catch (err) {
        status.textContent = '제출 실패: ' + err.message;
        status.style.color = 'red';
    } finally {
        btn.disabled = false;
    }
}

// ====== 게시판 모달 ======
function openBoardModal() {
    document.getElementById('board-modal').classList.add('is-open');
    loadBoardData();
}

function closeBoardModal() {
    document.getElementById('board-modal').classList.remove('is-open');
    closeBoardWrite();
}

// 글쓰기 창 열기 전 권한 확인
function openBoardWrite(editId = null, editTitle = '', editMessage = '') {
    const auth = getCurrentUser();

    // ** 로그인 확인 **
    if (!auth || !auth.user) {
        alert("로그인한 회원만 글을 작성할 수 있습니다.\n'양양 이음터'의 로그인 버튼을 통해 로그인해주세요.");
        return;
    }

    document.getElementById('board-list-view').style.display = 'none';
    document.getElementById('board-write-view').style.display = 'block';

    // 폼 초기화 및 제목/내용/ID 세팅
    document.getElementById('board-form').reset();
    // 신규 작성 시 기본값 (이름 자동 세팅 등)
    if (document.getElementById('board-name')) {
        document.getElementById('board-name').value = auth.user.name || '익명';
        document.getElementById('board-name').readOnly = true; // 본인 이름 수정 불가
        document.getElementById('board-name').style.background = '#f5f5f5';
    }
    document.getElementById('board-row-id').value = editId || '';
    document.getElementById('board-message').value = editMessage || '';

    document.getElementById('board-form-title').textContent = editId ? '게시글 수정' : '새 게시글 작성';
    document.getElementById('board-submit-btn').textContent = editId ? '수정하기' : '등록하기';
}

function closeBoardWrite() {
    document.getElementById('board-form').reset();
    document.getElementById('board-row-id').value = '';
    const status = document.getElementById('board-status');
    if (status) status.textContent = '';
    document.getElementById('board-write-view').style.display = 'none';
    document.getElementById('board-list-view').style.display = 'block';
}

// 게시글 작성 & 수정
async function submitBoardForm(e) {
    e.preventDefault();
    const btn = document.getElementById('board-submit-btn');
    const status = document.getElementById('board-status');
    const auth = getCurrentUser();

    if (!auth || !auth.user) {
        alert("권한이 없습니다.");
        return;
    }

    const rowId = document.getElementById('board-row-id').value;
    const name = document.getElementById('board-name') ? document.getElementById('board-name').value : auth.user.name;
    const phone = auth.user.phone; // 작성자 식별용
    const message = document.getElementById('board-message').value;

    btn.disabled = true;
    status.textContent = rowId ? '수정 중...' : '등록 중...';
    status.style.color = '#666';

    const actionType = rowId ? 'boardEdit' : 'boardWrite';

    try {
        const payload = {
            action: actionType,
            rowId: rowId,
            name: name,
            phone: phone,
            message: message
        };

        const res = await fetch(getBoardApiUrl(), {
            method: "POST",
            headers: { "Content-Type": "text/plain" },
            body: JSON.stringify(payload)
        });

        alert(rowId ? "게시글이 성공적으로 수정되었습니다." : "게시글이 성공적으로 등록되었습니다.");
        closeBoardWrite();
        loadBoardData();
    } catch (err) {
        status.textContent = '처리 실패: ' + err.message;
        status.style.color = 'red';
    } finally {
        btn.disabled = false;
    }
}

// 게시글 삭제
async function deleteBoardPost(rowId) {
    if (!confirm("정말 이 게시글을 삭제하시겠습니까?")) return;

    const auth = getCurrentUser();
    if (!auth || !auth.user) return;

    try {
        const payload = {
            action: 'boardDelete',
            rowId: rowId,
            phone: auth.user.phone
        };

        const res = await fetch(getBoardApiUrl(), {
            method: "POST",
            headers: { "Content-Type": "text/plain" },
            body: JSON.stringify(payload)
        });

        alert("게시글이 삭제되었습니다.");
        loadBoardData();
    } catch (err) {
        alert("삭제 실패: " + err.message);
    }
}

// 데이터 읽어오기
async function loadBoardData() {
    const loading = document.getElementById('board-loading');
    const table = document.getElementById('board-table');
    const tbody = document.getElementById('board-tbody');
    const auth = getCurrentUser();

    loading.style.display = 'block';
    loading.innerHTML = '<span style="display:inline-block; animation: spin 1s linear infinite;">⏳</span> 게시글을 불러오는 중입니다...';
    loading.style.color = '#888';
    table.style.display = 'none';
    tbody.innerHTML = '';

    try {
        // 기존의 doGet이나 queryString을 사용하는 방식. (config.js의 통합 url 뒤에 ?action=boardRead)
        const url = getBoardApiUrl() + "?action=boardRead";
        const res = await fetch(url);
        if (!res.ok) throw new Error("네트워크 응답 에러");
        const text = await res.text();

        let data;
        try {
            data = JSON.parse(text); // [ { rowId, timestamp, name, message, phone }, ... ]
        } catch (err) {
            console.error(text);
            throw new Error("서버 데이터 파싱 오류");
        }

        loading.style.display = 'none';
        table.style.display = 'table';

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 40px 20px; color: #888;">등록된 게시글이 없습니다.</td></tr>';
            return;
        }

        // 최신 글이 위로 오도록 역순 출력 (이미 백에서 해준다면 불필요)
        const sortedData = data.reverse ? data.reverse() : data;

        sortedData.forEach(item => {
            let dateText = item.timestamp;
            try {
                const d = new Date(item.timestamp);
                if (!isNaN(d.getTime())) {
                    dateText = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
                }
            } catch (e) { }

            const safeMessage = (item.message || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            const safeName = (item.name || "익명").replace(/</g, "&lt;").replace(/>/g, "&gt;");

            const tr = document.createElement('tr');

            // 본인 글이거나 관리자면 수정/삭제 표시
            let actionHtml = '';
            if (auth && (auth.role === 'ADMIN' || (auth.user && auth.user.phone === item.phone))) {
                actionHtml = `
                    <div style="margin-top: 8px; text-align: right; gap: 6px; display: flex; justify-content: flex-end;">
                        <button onclick='openBoardWrite("${item.rowId}", "", ${JSON.stringify(item.message || "")})' style="font-size:0.75rem; padding: 3px 6px; border:1px solid #ccc; background:#fff; border-radius:4px; cursor:pointer;">수정</button>
                        <button onclick='deleteBoardPost("${item.rowId}")' style="font-size:0.75rem; padding: 3px 6px; border:1px solid #e74c3c; color:#e74c3c; background:#fff; border-radius:4px; cursor:pointer;">삭제</button>
                    </div>
                `;
            }

            tr.innerHTML = `
        <td style="color: #777; font-size: 0.85rem; text-align: center; vertical-align: top; padding-top: 14px;">${dateText}</td>
        <td style="line-height: 1.6; white-space: pre-wrap; font-size: 0.95rem; vertical-align: top; padding-top: 14px;">
            ${safeMessage}
            ${actionHtml}
        </td>
        <td style="text-align: center; font-weight: 500; vertical-align: top; padding-top: 14px;">${safeName}</td>
      `;
            tbody.appendChild(tr);
        });

    } catch (err) {
        loading.textContent = '게시글을 불러오는 중 오류가 발생했습니다. (' + err.message + ')';
        loading.style.color = 'red';
    }
}

