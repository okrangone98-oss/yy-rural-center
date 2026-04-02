import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getRequiredSession } from '@/lib/rbac';

const SPREADSHEET_ID = '1PMi4ajeKeY_aY5Sh9zBy4kWw8tz7pwQoH9uOLa1A6ag';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const sheetName = searchParams.get('sheet');

    if (!sheetName) {
        return NextResponse.json({ success: false, message: 'Sheet name is required' }, { status: 0 });
    }

    try {
        const auth = new google.auth.JWT(
            process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            undefined,
            process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            ['https://www.googleapis.com/auth/spreadsheets.readonly']
        );

        const sheets = google.sheets({ version: 'v4', auth });
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!A:Z`,
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            return new Response('', { headers: { 'Content-Type': 'text/csv' } });
        }

        const csvContent = rows
            .map((row) =>
                row
                    .map((cell) => {
                        const str = String(cell || '');
                        return str.includes(',') || str.includes('"') || str.includes('\n')
                            ? `"${str.replace(/"/g, '""')}"`
                            : str;
                    })
                    .join(',')
            )
            .join('\n');

        return new Response(csvContent, {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Access-Control-Allow-Origin': '*',
            },
        });
    } catch (error) {
        console.error('CSV Proxy Error:', error);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}
