export type Gender = 'male' | 'female' | 'unknown';
export type ChronicCondition = 'ckd' | 'diabetes' | 'hyperthyroidism' | 'obesity' | 'fip' | 'heart_disease' | 'ibd' | 'asthma' | 'flutd' | 'other';

export interface CatIdentity {
  id: string;
  name: string;
  birthDate: string;
  gender: Gender;
  spayedNeutered: boolean;
  baselineWeightKg: number;
  currentWeightKg: number;
  targetWeightKg: number;
  bcsScore: number;
  chronicConditions: ChronicCondition[];
  allergyWhitelist: string[];
  allergyBlacklist: string[];
}

export interface VitalsLog {
  id: string;
  catId: string;
  weightKg: number;
  temperatureC: number;
  medicineFlag: boolean;
  timestamp: string;
}

export interface FeedingLog {
  sessionId: string;
  catId: string;
  baselineImg: string;
  outcomeImg: string;
  intakeGram: number;
  kcalPerGram: number;
  bowlRatio: number;
  wetFoodAddedWaterMl: number;
  waterT0Ml: number;
  waterT1Ml: number;
  envFactorMl: number;
  timestamp: string;
}

export interface MedicationLog {
  id: string;
  catId: string;
  medicationName: string;
  dosage: string;
  reminderTime?: string;
  completedAt?: string;
  notes?: string;
  createdAt: number;
}

export type SymptomSeverity = 'mild' | 'moderate' | 'severe';

export interface SymptomLog {
  id: string;
  catId: string;
  symptom: string;
  severity: SymptomSeverity;
  observedAt?: string;
  notes?: string;
  createdAt: number;
}

export type AlertType = 'allergy' | 'weight' | 'fever' | 'intake' | 'hydration';
export type AlertSeverity = 'low' | 'medium' | 'high';

export interface MedicalAlert {
  alertId: string;
  catId: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  timestamp: string;
}

export interface ClinicalSummary {
  catId: string;
  periodDays: number;
  avgTemperatureC: number;
  totalKcalIntake: number;
  totalActualWaterMl: number;
  /** 今日攝取熱量（僅當日紀錄） */
  todayKcalIntake: number;
  /** 今日飲水量（僅當日紀錄） */
  todayWaterMl: number;
  weeklyWeightChangeRatePct: number;
  medicationLogs: MedicationLog[];
  alerts: MedicalAlert[];
}
