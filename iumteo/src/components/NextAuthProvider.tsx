'use client';

import { useEffect } from 'react';
import { SessionProvider, useSession } from 'next-auth/react';
import { getAppPath } from '@/lib/app-url';

function SessionStorageBridge() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (status === 'authenticated' && session?.user) {
      const sessionUser = session.user as typeof session.user & { phone?: string | null };

      window.sessionStorage.setItem(
        'iumteo_auth',
        JSON.stringify({
          role: sessionUser.role,
          user: {
            id: sessionUser.id,
            name: sessionUser.name || '',
            email: sessionUser.email || '',
            phone: sessionUser.phone || '',
          },
          isLoggedIn: true,
        }),
      );
      return;
    }

    if (status === 'unauthenticated') {
      window.sessionStorage.removeItem('iumteo_auth');
    }
  }, [session, status]);

  return null;
}

export default function NextAuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider basePath={getAppPath('/api/auth')}>
      <SessionStorageBridge />
      {children}
    </SessionProvider>
  );
}
