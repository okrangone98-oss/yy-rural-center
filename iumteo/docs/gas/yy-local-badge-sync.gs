/**
 * 양양이음터 로컬 배지 동기화
 *
 * 사용법:
 * 1) 양양이음터강사DB 시트에서 A열(색상표시 기준)을 사용한다면,
 * 2) 이 함수를 실행해 isLocal 컬럼을 Y/빈값으로 동기화합니다.
 */
function syncLocalStatusByColor() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('양양이음터강사DB') || SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const HEADER_ROW = 1;
  const FIRST_DATA_ROW = 3;
  const lastRow = sheet.getLastRow();
  if (lastRow < FIRST_DATA_ROW) return;

  const headers = sheet.getRange(HEADER_ROW, 1, 1, sheet.getLastColumn()).getValues()[0];
  const localColIndex = headers.indexOf('isLocal') + 1;
  if (localColIndex < 1) throw new Error('isLocal 헤더를 찾을 수 없습니다.');

  const colorRange = sheet.getRange(FIRST_DATA_ROW, 1, lastRow - FIRST_DATA_ROW + 1, 1);
  const backgrounds = colorRange.getBackgrounds();

  const values = backgrounds.map((row) => {
    const color = String(row[0] || '').toLowerCase();
    return color && color !== '#ffffff' && color !== 'white' ? ['Y'] : [''];
  });

  sheet.getRange(FIRST_DATA_ROW, localColIndex, values.length, 1).setValues(values);
  SpreadsheetApp.getUi().alert('로컬 상태 업데이트 완료');
}
