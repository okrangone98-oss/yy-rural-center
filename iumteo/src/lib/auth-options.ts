import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import NaverProvider from "next-auth/providers/naver";
import KakaoProvider from "next-auth/providers/kakao";
import CredentialsProvider from "next-auth/providers/credentials";

type AppRole = 'GUEST' | 'USER' | 'INSTRUCTOR' | 'ADMIN';

function resolveRole(userData: any): AppRole {
    const roleStr = String(
        userData?._role ||
        userData?.Role ||
        userData?.['권한(USER)'] ||
        'USER'
    ).toUpperCase();

    if (roleStr.includes('ADMIN') || roleStr.includes('관리자')) return 'ADMIN';
    if (roleStr.includes('INSTRUCTOR') || roleStr.includes('강사')) return 'INSTRUCTOR';
    if (roleStr.includes('GUEST')) return 'GUEST';
    return 'USER';
}

async function loadGasUserByEmail(email?: string | null) {
    const normalizedEmail = email?.trim().toLowerCase();
    const apiUrl = process.env.GAS_API_URL;
    const apiKey = process.env.GAS_API_KEY;

    if (!normalizedEmail || !apiUrl || !apiKey) {
        return null;
    }

    try {
        const response = await fetch(
            `${apiUrl}?action=getUser&email=${encodeURIComponent(normalizedEmail)}&apiKey=${encodeURIComponent(apiKey)}`,
            {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                cache: 'no-store',
            }
        );

        const result = await response.json();
        if (!result.success || !result.data) {
            return null;
        }

        const userData = result.data;
        return {
            id: String(userData['강사ID'] || userData._rowIndex || normalizedEmail),
            name: userData['성명'] || userData['이용자명'] || userData['Name'] || normalizedEmail.split('@')[0],
            email: normalizedEmail,
            role: resolveRole(userData),
            provider: userData['Provider'] || 'credentials',
            consentDate: userData['Consent_Date'] || 'sheet-registered',
            consentRequired: false,
            password: String(
                userData['Password_Hash'] ||
                userData['사용자비번'] ||
                userData['비밀번호'] ||
                ''
            ),
        };
    } catch (error) {
        console.error('[NextAuth] Failed to load GAS user:', error);
        return null;
    }
}

// Extend the built-in session types to include our custom RBAC roles and consent info
declare module "next-auth" {
    interface Session {
        user: {
            id: string;
            name?: string | null;
            email?: string | null;
            image?: string | null;
            role: 'GUEST' | 'USER' | 'INSTRUCTOR' | 'ADMIN';
            provider: string;
            consentDate?: string | null;
            consentRequired?: boolean;
        }
    }

    interface User {
        id: string;
        role: 'GUEST' | 'USER' | 'INSTRUCTOR' | 'ADMIN';
        provider: string;
        consentDate?: string | null;
        consentRequired?: boolean;
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        id: string;
        role: 'GUEST' | 'USER' | 'INSTRUCTOR' | 'ADMIN';
        provider: string;
        consentDate?: string | null;
        consentRequired?: boolean;
    }
}
const providers: any[] = [
    CredentialsProvider({
        name: "Credentials",
        credentials: {
            username: { label: "Username", type: "text" },
            password: { label: "Password", type: "password" }
        },
        async authorize(credentials) {
            const email = credentials?.username?.trim();
            const password = credentials?.password;

            console.log("[NextAuth] Authorize attempt:", { email });

            // Hardcoded admin for testing and fallback
            if (email === "admin" && password === "admin") {
                console.log("[NextAuth] Authorize SUCCESS: admin login");
                return {
                    id: "admin-1",
                    name: "Admin User",
                    email: "admin@yangyang.go.kr",
                    role: "ADMIN",
                    provider: "credentials"
                };
            }

            if (!email || !password) return null;

            try {
                console.log(`[NextAuth] Fetching from GAS API for email: ${email}`);
                const gasUser = await loadGasUserByEmail(email);

                if (gasUser) {
                    const dbPassword = gasUser.password;

                    // 시트의 평문 비밀번호와 비교
                    if (String(password) === dbPassword) {
                        console.log("[NextAuth] Login SUCCESS via GAS for:", email);

                        return {
                            id: gasUser.id,
                            name: gasUser.name,
                            email: email,
                            role: gasUser.role,
                            provider: "credentials"
                        };
                    } else {
                        console.log("[NextAuth] Password mismatch for:", email);
                        return null;
                    }
                }

                console.log("[NextAuth] User not found in GAS DB");
                return null;
            } catch (err) {
                console.error("[NextAuth] GAS API Fetch Exception:", err);
                return null;
            }
        }
    })
];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push(GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }));
}

if (process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET) {
    providers.push(NaverProvider({
        clientId: process.env.NAVER_CLIENT_ID,
        clientSecret: process.env.NAVER_CLIENT_SECRET,
    }));
}

if (process.env.KAKAO_CLIENT_ID && process.env.KAKAO_CLIENT_SECRET) {
    providers.push(KakaoProvider({
        clientId: process.env.KAKAO_CLIENT_ID,
        clientSecret: process.env.KAKAO_CLIENT_SECRET,
    }));
}

export const authOptions: NextAuthOptions = {
    providers: providers,
    callbacks: {
        async jwt({ token, user, account }) {
            if (user) {
                token.id = user.id;
                const provider = account?.provider || user.provider || 'unknown';
                const isSocialProvider = provider !== 'credentials';
                const hasConsent = Boolean(user.consentDate);

                // Keep social logins in GUEST state until the same consent policy is captured.
                token.role = user.role || (isSocialProvider && !hasConsent ? 'GUEST' : 'USER');
                token.provider = provider;
                token.consentDate = user.consentDate || null;
                token.consentRequired = isSocialProvider && !hasConsent;
                console.log("[NextAuth] Token generated:", {
                    id: token.id,
                    role: token.role,
                    provider: token.provider,
                    consentRequired: token.consentRequired,
                });
            }

            if (token.email && (token.role === 'GUEST' || !token.role)) {
                const gasUser = await loadGasUserByEmail(token.email);
                if (gasUser) {
                    token.id = gasUser.id;
                    token.role = gasUser.role;
                    token.provider = token.provider || gasUser.provider;
                    token.consentDate = gasUser.consentDate;
                    token.consentRequired = false;
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
                session.user.consentDate = token.consentDate;
                session.user.consentRequired = token.consentRequired;
                console.log("[NextAuth] Session started:", {
                    id: session.user.id,
                    role: session.user.role,
                    provider: session.user.provider,
                    consentRequired: session.user.consentRequired,
                });
            }
            return session;
        }
    },
    pages: {
        signIn: '/login',
        error: '/login',
    },
    session: {
        strategy: 'jwt',
        maxAge: 30 * 24 * 60 * 60, // 30 days
    },
    secret: process.env.NEXTAUTH_SECRET,
};
