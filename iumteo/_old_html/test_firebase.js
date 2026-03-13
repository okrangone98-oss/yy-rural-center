const { initializeApp } = require('firebase/app');
const { getStorage, ref, uploadString } = require('firebase/storage');
const { getAuth, signInAnonymously } = require('firebase/auth');

const firebaseConfig = {
    apiKey: "AIzaSyClvHWm-MClkya2okNt8gONnXrj0AAUSP8",
    authDomain: "yy-content-system.firebaseapp.com",
    projectId: "yy-content-system",
    storageBucket: "yy-content-system.firebasestorage.app",
    messagingSenderId: "844281329204",
    appId: "1:844281329204:web:7806a578063576d6947c61"
};

const app = initializeApp(firebaseConfig);
const storage = getStorage(app);
const auth = getAuth(app);

async function checkStorage() {
    try {
        console.log("Firebase 로그인 시도...");
        await signInAnonymously(auth);
        console.log("로그인 성공! 스토리지에 폴더(파일) 생성 시도...");

        // 파이어베이스는 파일이 위치한 경로가 곧 폴더가 됩니다.
        // 폴더를 시각적으로 유지하기 위해 빈 텍스트 파일을 업로드합니다.
        const fileRef = ref(storage, 'images/양양이음터_강사사진/.keep');

        await uploadString(fileRef, 'This file ensures the folder exists in Firebase Storage.', 'raw');
        console.log("SUCCESS: 'images/양양이음터_강사사진' 폴더가 Firebase 스토리지에 성공적으로 준비/확인되었습니다!");

        process.exit(0);
    } catch (error) {
        console.error("FAIL: 스토리지 점검 중 오류 발생", error);
        process.exit(1);
    }
}

checkStorage();
