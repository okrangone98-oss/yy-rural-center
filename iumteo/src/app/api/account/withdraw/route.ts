import { NextResponse } from 'next/server';
import { getRequiredSession } from '@/lib/rbac';
import { assertGasSuccess, gasPost, isGasConfigured } from '@/lib/gas-api';
import { getFirestoreAdmin, isFirebaseMirrorEnabled } from '@/lib/firebase-admin';

/**
 * Handle account withdrawal (deletion) for both Members and Instructors.
 */
export async function POST() {
    const { session, error } = await getRequiredSession(['USER', 'INSTRUCTOR', 'ADMIN']);
    if (error) return error;

    const email = session.user.email || '';
    const role = session.user.role;

    try {
        // 1. GAS (Google Sheets) Synchronization
        // The GAS script should handle 'deleteUser' action to remove the row from sheets.
        if (isGasConfigured()) {
            try {
                const gasResult = await gasPost({
                    action: 'deleteUser',
                    email,
                });
                assertGasSuccess(gasResult as any, 'deleteUser');
            } catch (gasError) {
                console.error('[withdraw POST] GAS deletion failed:', gasError);
                // We continue anyway to ensure Firestore/Local cleanup, 
                // but report the error if it's critical.
            }
        }

        // 2. Firestore Mirror Cleanup
        if (isFirebaseMirrorEnabled()) {
            const db = getFirestoreAdmin();
            const batch = db.batch();

            // Delete Instructor Profile if applicable
            if (role === 'INSTRUCTOR' || role === 'ADMIN') {
                const lecturerRef = db.collection('lecturer_profiles').doc(email);
                batch.delete(lecturerRef);
            }

            // Delete User record if it exists
            const userRef = db.collection('users').doc(email);
            batch.delete(userRef);

            // Note: We don't delete inquiries or chat rooms to preserve history for the other party (Admin/Teacher),
            // but they are now linked to a non-existent user.

            await batch.commit();
        }

        return NextResponse.json({
            success: true,
            message: '회원 탈퇴 처리가 완료되었습니다.',
        });
    } catch (err) {
        console.error('[withdraw POST] Error:', err);
        return NextResponse.json(
            {
                success: false,
                message: err instanceof Error ? err.message : '회원 탈퇴 중 오류가 발생했습니다.',
            },
            { status: 500 }
        );
    }
}
