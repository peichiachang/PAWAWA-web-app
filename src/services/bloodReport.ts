import { BloodMarkerRaw, BloodMarkerInterpretation, BloodMarkerStatus } from '../types/bloodReport';
import { KNOWLEDGE_MAP } from '../data/bloodReportKnowledge';

export const BLOOD_REPORT_DISCLAIMER =
  '以下說明為一般醫學資訊翻譯，僅供參考，不構成診斷意見。' +
  '所有數值的臨床意義需結合貓咪的症狀、其他檢查結果及獸醫師的專業判斷。' +
  '請以報告上標示的參考區間為準。';

function resolveStatus(value: number, refLow?: number, refHigh?: number): BloodMarkerStatus {
  if (refLow == null && refHigh == null) return 'unknown';
  if (refHigh != null && value > refHigh) return 'high';
  if (refLow != null && value < refLow) return 'low';
  return 'normal';
}

function formatRefRange(refLow?: number, refHigh?: number, unit?: string): string {
  if (refLow == null && refHigh == null) return '—';
  if (refLow == null) return `< ${refHigh} ${unit ?? ''}`.trim();
  if (refHigh == null) return `> ${refLow} ${unit ?? ''}`.trim();
  return `${refLow} – ${refHigh} ${unit ?? ''}`.trim();
}

export function interpretBloodReport(markers: BloodMarkerRaw[]): BloodMarkerInterpretation[] {
  return markers.map((marker) => {
    const key = marker.code.toUpperCase();
    const knowledge = KNOWLEDGE_MAP[key];
    const status = resolveStatus(marker.value, marker.refLow, marker.refHigh);

    if (!knowledge) {
      return {
        code: marker.code,
        nameZh: marker.code,
        nameEn: marker.code,
        category: 'other',
        value: marker.value,
        unit: marker.unit,
        refRange: formatRefRange(marker.refLow, marker.refHigh, marker.unit),
        status,
        description: '此指標暫無對應說明，請參考報告上的參考區間，或向獸醫師詢問。',
      };
    }

    let context: string | undefined;
    if (status === 'high' && knowledge.highContext) {
      context = knowledge.highContext;
    } else if (status === 'low' && knowledge.lowContext) {
      context = knowledge.lowContext;
    }

    return {
      code: marker.code,
      nameZh: knowledge.nameZh,
      nameEn: knowledge.nameEn,
      category: knowledge.category,
      value: marker.value,
      unit: marker.unit || knowledge.unit,
      refRange: formatRefRange(marker.refLow, marker.refHigh, marker.unit || knowledge.unit),
      status,
      description: knowledge.description,
      context,
    };
  });
}
