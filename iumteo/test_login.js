async function testLogin() {
    const baseUrl = 'http://localhost:3000';

    try {
        console.log('Fetching CSRF token...');
        // 1. Get CSRF Token
        const csrfRes = await fetch(`${baseUrl}/api/auth/csrf`);
        const { csrfToken } = await csrfRes.json();
        const cookies = csrfRes.headers.get('set-cookie');

        console.log('CSRF Token:', csrfToken);

        // 2. Attempt Login
        console.log('Attempting login...');
        const loginRes = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': cookies
            },
            body: new URLSearchParams({
                username: 'admin',
                password: 'admin',
                csrfToken: csrfToken,
                json: 'true'
            })
        });

        const result = await loginRes.json();
        console.log('Login Result Status:', loginRes.status);
        console.log('Login Result:', result);
    } catch (error) {
        console.error('Test failed:', error);
    }
}

testLogin();
