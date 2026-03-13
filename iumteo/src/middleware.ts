import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
    function middleware(req) {
        const token = req.nextauth.token;
        const path = req.nextUrl.pathname;
        const role = token?.role;
        const registerUrl = new URL("/register", req.url);

        console.log(`[Middleware] Path: ${path} | Role: ${role || 'UNAUTHENTICATED'}`);

        // 1. Redirect if trying to access protected routes without token
        if (!token) {
            console.log(`[Middleware] No token found. Redirecting to /login`);
            return NextResponse.redirect(new URL("/login", req.url));
        }

        // 2. ADMIN - Can access everything
        if (role === 'ADMIN') {
            return NextResponse.next();
        }

        // 3. RBAC checks
        // /admin serves as the unified dashboard for USER / INSTRUCTOR / ADMIN.
        if (path.startsWith("/admin")) {
            if (role === 'USER' || role === 'INSTRUCTOR') {
                return NextResponse.next();
            }
            if (role === 'GUEST') {
                console.log(`[Middleware] GUEST access to /admin. Redirecting to /register`);
                return NextResponse.redirect(registerUrl);
            }
            console.log(`[Middleware] Unauthorized access to /admin by ${role}. Redirecting.`);
            return NextResponse.redirect(new URL("/login?error=unauthorized", req.url));
        }

        if (path.startsWith("/profile")) {
            if (role === 'USER') {
                return NextResponse.next();
            }
            if (role === 'GUEST') {
                console.log(`[Middleware] GUEST access to /profile. Redirecting to /register`);
                return NextResponse.redirect(registerUrl);
            }
            console.log(`[Middleware] Unauthorized access to /profile by ${role}. Redirecting.`);
            return NextResponse.redirect(new URL("/admin", req.url));
        }

        if (path.startsWith("/teacher") && role !== 'INSTRUCTOR') {
            if (role === 'GUEST') {
                console.log(`[Middleware] GUEST access to /teacher. Redirecting to /register`);
                return NextResponse.redirect(registerUrl);
            }
            console.log(`[Middleware] Unauthorized access to /teacher by ${role}. Redirecting.`);
            return NextResponse.redirect(new URL("/login?error=unauthorized", req.url));
        }

        if (path.startsWith("/qna") && role === 'GUEST') {
            console.log(`[Middleware] GUEST access to /qna. Redirecting to /register`);
            return NextResponse.redirect(registerUrl);
        }

        return NextResponse.next();
    },
    {
        callbacks: {
            authorized: ({ token }) => !!token,
        },
    }
);

export const config = {
    matcher: ["/admin/:path*", "/qna/:path*", "/teacher/:path*", "/profile/:path*"],
};
