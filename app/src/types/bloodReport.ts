export type BloodCategory =
  | 'cbc_rbc'
  | 'cbc_wbc'
  | 'cbc_plt'
  | 'kidney'
  | 'liver'
  | 'glucose'
  | 'protein'
  | 'electrolyte'
  | 'pancreas'
  | 'endocrine'
  | 'infectious'
  | 'urine'
  | 'coagulation'
  | 'other';

export const BLOOD_CATEGORY_LABEL: Record<BloodCategory, string> = {
  cbc_rbc: '紅血球系列',
  cbc_wbc: '白血球系列',
  cbc_plt: '血小板系列',
  kidney: '腎臟功能',
  liver: '肝臟功能',
  glucose: '血糖與脂質',
  protein: '蛋白質',
  electrolyte: '電解質',
  pancreas: '胰臟相關',
  endocrine: '內分泌',
  infectious: '感染疾病篩檢',
  urine: '尿液相關',
  coagulation: '凝血功能',
  other: '其他',
};

export interface BloodMarkerKnowledge {
  code: string;
  aliases?: string[];
  nameZh: string;
  nameEn: string;
  category: BloodCategory;
  unit: string;
  description: string;
  highContext?: string;
  lowContext?: string;
}

export interface BloodMarkerRaw {
  code: string;
  value: number;
  unit: string;
  refLow?: number;
  refHigh?: number;
}

export type BloodMarkerStatus = 'high' | 'low' | 'normal' | 'unknown';

export interface BloodMarkerInterpretation {
  code: string;
  nameZh: string;
  nameEn: string;
  category: BloodCategory;
  value: number;
  unit: string;
  refRange: string;
  status: BloodMarkerStatus;
  description: string;
  context?: string;
}

export interface BloodReportRecord {
  id: string;
  catId: string;
  reportDate: string;
  photoUri: string;
  interpretations: BloodMarkerInterpretation[];
  createdAt: number;
}
