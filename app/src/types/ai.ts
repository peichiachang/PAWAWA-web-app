import { VesselCalibration } from './app';

export interface BowlDetection {
  bowlId: string;
  tag: string;
  estimatedIntakeGram: number;
}

export interface AiImageInput {
  imageRef?: string;
  imageBase64?: string;
  mimeType?: string;
  uri?: string;
  capturedAt?: number;
  waterLevelPct?: number;
  manualWeight?: number; // T0 手動測重的克數（用於精確模式）
}

/** T1 相對於 T0 的進食程度（五分位離散分級） */
export type ConsumptionLevel = 'almost_all_eaten' | 'more_than_half' | 'about_half' | 'a_little' | 'almost_none';

export interface FeedingPreCheck {
  Q1?: boolean;
  Q2?: boolean;
  Q3?: boolean;
  Q4?: boolean;
}

export interface FeedingVisionResult {
  bowlsDetected: number;
  assignments: BowlDetection[];
  householdTotalGram: number;
  consumedRatio?: number; // 0~1，程式端會再映射成離散 consumptionLevel
  /** 離散分級：幾乎全吃完 / 吃了一半以上 / 吃了不到一半 / 幾乎沒吃 */
  consumptionLevel?: ConsumptionLevel;
  isBowlMatch: boolean;
  mismatchReason?: string;
  confidence?: number;
  estimatedErrorMargin?: number; // AI 自己估算的誤差範圍（0.08-0.20）
  preCheck?: FeedingPreCheck;
}

/** Majority Vote 結果：與 FeedingVisionResult 相容，額外含 distribution */
export interface FeedingMajorityVoteResult extends FeedingVisionResult {
  /** 各 consumptionLevel 出現次數，如 { "about_half": 2, "more_than_half": 1 } */
  distribution?: Partial<Record<ConsumptionLevel, number>>;
}

export interface NutritionOCRResult {
  kcalPerGram: number;
  proteinPct: number;
  phosphorusPct: number;
  rawText: string;
}

export interface HydrationVisionResult {
  waterT0Ml: number;
  waterT1Ml: number;
  tempC: number;
  humidityPct: number;
  envFactorMl: number;
  actualIntakeMl: number;
  isBowlMatch: boolean;
  mismatchReason?: string;
  confidence?: number;
}

export interface EliminationVisionResult {
  color: string;
  bristolType: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  shapeType: string;
  abnormal: boolean;
  confidence: number;
  note: string;
}

export interface BloodMarkerRaw {
  code: string;
  value: number;
  unit: string;
  refLow?: number;
  refHigh?: number;
}

export interface BloodReportOCRResult {
  markers: BloodMarkerRaw[];
  reportDate?: string;
  labName?: string;
  confidence?: number;
}

export interface SideProfileAnalysisResult {
  contour: {
    points: Array<{ y: number; radius: number }>; // 輪廓點（y: 從碗口往下高度, radius: 半徑）
    confidence: number;
    estimatedHeightCm?: number;
  };
  confidence: number;
  estimatedVolumeMl?: number; // AI 估算的總容量（參考）
}

export interface AiRecognitionService {
  analyzeFeedingImages(input: { t0: AiImageInput; t1: AiImageInput; vessel?: VesselCalibration; isShallow?: boolean; isDeep?: boolean }): Promise<FeedingVisionResult>;
  /** 可選：3 次並行分析後 Majority Vote，提升穩定性 */
  analyzeWithMajorityVote?(input: { t0: AiImageInput; t1: AiImageInput; vessel?: VesselCalibration; isShallow?: boolean; isDeep?: boolean }): Promise<FeedingMajorityVoteResult>;
  extractNutritionLabel(input: AiImageInput): Promise<NutritionOCRResult>;
  analyzeHydrationImages(input: { t0: AiImageInput; t1: AiImageInput; vessel?: VesselCalibration }): Promise<HydrationVisionResult>;
  analyzeEliminationImage(input: AiImageInput): Promise<EliminationVisionResult>;
  extractBloodReport(input: AiImageInput): Promise<BloodReportOCRResult>;
  analyzeSideProfile?(input: { imageBase64: string; rimDiameterCm: number }): Promise<SideProfileAnalysisResult>; // 側面輪廓識別（可選）
}
