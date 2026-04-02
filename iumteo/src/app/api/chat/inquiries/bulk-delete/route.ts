import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { getFirestoreAdmin } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { inquiryIds } = await req.json();
        if (!Array.isArray(inquiryIds) || inquiryIds.length === 0) {
            return NextResponse.json({ success: false, message: 'inquiryIds missing or invalid' }, { status: 400 });
        }

        const db = getFirestoreAdmin();
        const batch = db.batch();
        const now = new Date().toISOString();

        for (const inquiryId of inquiryIds) {
            // Search for existing chat room
            const snapshot = await db.collection('chatRooms')
                .where('inquiryId', '==', inquiryId)
                .limit(1)
                .get();

            if (snapshot.empty) {
                // Create a dummy deleted room
                const newRoomRef = db.collection('chatRooms').doc();
                batch.set(newRoomRef, {
                    id: newRoomRef.id,
                    inquiryId,
                    status: 'DELETED',
                    totalLength: 0,
                    createdAt: now,
                    updatedAt: now,
                    hiddenFor: [session.user.email],
                });
            } else {
                // Mark existing room as deleted
                const doc = snapshot.docs[0];
                batch.update(doc.ref, {
                    status: 'DELETED',
                    updatedAt: now,
                    hiddenFor: admin.firestore.FieldValue.arrayUnion(session.user.email)
                });
            }
        }

        await batch.commit();

        return NextResponse.json({ success: true, count: inquiryIds.length });
    } catch (error) {
        console.error('[bulk-delete] error:', error);
        return NextResponse.json(
            { success: false, message: error instanceof Error ? error.message : 'Database error' },
            { status: 500 }
        );
    }
}
