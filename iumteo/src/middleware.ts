import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { getAppPath, getRoutePath } from "@/lib/app-url";

export default withAuth(
    function middleware(req) {
        const token = req.nextauth.token;
        const path = req.nextUrl.pathname;
        const routePath = getRoutePath(path);
        const role = String(token?.role || '');
        const registerUrl = new URL(getAppPath("/register"), req.url);

        console.log(`[Middleware] Path: ${path} | RoutePath: ${routePath} | Role: ${role || 'UNAUTHENTICATED'}`);

        if (!token) {
            return NextResponse.redirect(new URL(getAppPath("/login"), req.url));
        }

        if (role === 'ADMIN') {
            return NextResponse.next();
        }

        if (routePath.startsWith("/admin")) {
            if (role === 'ADMIN') {
                return NextResponse.next();
            }
            if (role === 'GUEST') {
                return NextResponse.redirect(registerUrl);
            }
            return NextResponse.redirect(new URL(getAppPath("/login?error=unauthorized"), req.url));
        }

        if (routePath.startsWith("/profile")) {
            if (role === 'USER') {
                return NextResponse.next();
            }
            if (role === 'GUEST') {
                return NextResponse.redirect(registerUrl);
            }
            return NextResponse.redirect(new URL(getAppPath("/admin"), req.url));
        }

        if (routePath === "/teacher" && role !== 'INSTRUCTOR') {
            if (role === 'GUEST') {
                return NextResponse.redirect(registerUrl);
            }
            return NextResponse.redirect(new URL(getAppPath("/login?error=unauthorized"), req.url));
        }

        if (routePath.startsWith("/chat")) {
            if (role === 'USER' || role === 'INSTRUCTOR') {
                return NextResponse.next();
            }
            if (role === 'GUEST') {
                return NextResponse.redirect(registerUrl);
            }
            return NextResponse.redirect(new URL(getAppPath("/login?error=unauthorized"), req.url));
        }

        return NextResponse.next();
    },
    {
        pages: {
            signIn: getAppPath("/login"),
        },
        callbacks: {
            authorized: ({ token }) => !!token,
        },
    }
);

export const config = {
    matcher: ["/admin/:path*", "/teacher", "/profile/:path*", "/chat/:path*"],
};
