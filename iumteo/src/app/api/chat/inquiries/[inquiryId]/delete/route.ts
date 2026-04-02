import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { getFirestoreAdmin } from '@/lib/firebase-admin';

export async function POST(req: Request, { params }: { params: { inquiryId: string } }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { inquiryId } = params;
    if (!inquiryId) {
        return NextResponse.json({ success: false, message: 'inquiryId missing' }, { status: 400 });
    }

    try {
        const db = getFirestoreAdmin();
        // Search for existing chat room
        const snapshot = await db.collection('chatRooms')
            .where('inquiryId', '==', inquiryId)
            .limit(1)
            .get();

        if (snapshot.empty) {
            // Create a dummy deleted room
            const newRoomRef = db.collection('chatRooms').doc();
            await newRoomRef.set({
                id: newRoomRef.id,
                inquiryId,
                status: 'DELETED',
                totalLength: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                hiddenFor: [session.user.email],
            } as any);
        } else {
            // Mark existing room as deleted
            const doc = snapshot.docs[0];
            const firestore = require('firebase-admin').firestore;
            await doc.ref.update({
                status: 'DELETED',
                updatedAt: new Date().toISOString(),
                hiddenFor: firestore.FieldValue.arrayUnion(session.user.email)
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json(
            { success: false, message: error instanceof Error ? error.message : 'Database error' },
            { status: 500 }
        );
    }
}
