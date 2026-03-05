import { AiImageInput } from './ai';

export type Level = 'household' | `cat_${string}`;
export type BottomTab = 'home' | 'records' | 'knowledge' | 'profile';
export type ActiveModal = 'feeding' | 'water' | 'elimination' | 'medication' | 'symptom' | 'settings' | 'blood' | 'bloodHistory' | 'bloodDetail' | 'kcalAdvice' | 'waterAdvice' | 'backup' | 'iap' | 'addCat' | 'editCat' | 'recordDetail' | 'weightRecord' | null;
export type CapturedImage = Required<Pick<AiImageInput, 'uri' | 'imageBase64' | 'mimeType'>>;
export type StoredFeedingT0 = CapturedImage & { capturedAt: number; manualWeight?: number; vesselId?: string };
export type StoredHydrationImage = CapturedImage & {
  capturedAt: number;
  waterLevelPct?: number;
  /** 像素 Y 座標，供純數學計算（確認後可丟掉照片） */
  bowl_top_y?: number;
  bowl_bottom_y?: number;
  water_y?: number;
  image_height?: number;
};
export type StoredHydrationW0 = StoredHydrationImage & { vesselId?: string };
// 向後相容：保留舊的類型名稱
export type StoredHydrationT0 = StoredHydrationW0;
export type FeedingOwnershipType = 'household_only' | 'household_and_tag';

export type FeedingPrecisionMode = 'standard' | 'precise';
export type VesselShape = 'cylinder' | 'trapezoid' | 'sphere';

/** 容器用途：食碗（飲食記錄用）、水碗（飲水記錄用） */
export type VesselType = 'feeding' | 'hydration';

/** 食物類型：乾飼料（預設份量沿用）／罐頭濕食（每次輸入克數） */
export type FoodType = 'dry' | 'wet';

export interface ProfileContourPoint {
  y: number; // 從碗口往下的高度（cm）
  radius: number; // 該高度處的半徑（cm），左右對稱時使用單一半徑
}

export interface ProfileContour {
  points: ProfileContourPoint[]; // 輪廓點陣列（從碗口 y=0 到底部）
  confidence: number; // AI 識別信心度 (0.0-1.0)
  estimatedHeightCm?: number; // AI 估算的總高度
}

export interface VesselCalibration {
  id: string;
  name: string;
  /** 食碗（飲食）或 水碗（飲水），未設時視為食碗以相容舊資料 */
  vesselType?: VesselType;
  shape: VesselShape;
  dimensions: {
    length?: number;
    width?: number;
    height: number;
    radius?: number; // legacy/simple，實際存儲的是直徑
    topRadius?: number; // 實際存儲的是直徑
    bottomRadius?: number; // 實際存儲的是直徑
  };
  volumeMl?: number;
  calibrationFactor?: number; // 校準係數：實際容量 / 計算容量（用於修正幾何計算誤差）
  measuredVolumeMl?: number; // 實際測量的容量（用於計算校準係數）
  
  // 校準方式：幾何尺寸 / 側面輪廓 / 直接已知容量
  calibrationMethod?: 'dimensions' | 'side_profile' | 'known_volume';
  sideProfileImageBase64?: string; // 側面照（base64）
  rimDiameterCm?: number; // 碗口直徑（側面輪廓方式的唯一輸入）
  profileContour?: ProfileContour; // 輪廓數據
  /** 空碗俯視照（校準參考，供 W0/W1 碗位比對使用；側面輪廓時為俯視檢查照，其他輸入方式亦可拍攝） */
  topViewImageBase64?: string;
  /** 滿水校準資料（僅用於已知容量模式） */
  fullWaterCalibration?: {
    /** 校準時的水位 Y 座標（像素） */
    fullY: number;
    /** 校準時的底線 Y 座標（像素） */
    bottomY: number;
    /** 校準時的頂線 Y 座標（像素） */
    topY: number;
    /** 圖片高度（像素） */
    imageHeight: number;
    /** 校準時間戳 */
    calibratedAt: number;
    /** 校準時的照片（base64） */
    imageBase64?: string;
  };
  /** 食物類型：乾飼料（可設預設份量）／罐頭濕食（每次必填克數） */
  foodType?: FoodType;
  /** 乾飼料預設份量（克），設定後沿用，不用每次輸入 */
  defaultPortionGrams?: number;
}

export interface FeedingOwnershipLog {
  id: string;
  createdAt: number;
  totalGram: number;
  kcal?: number;
  ownershipType: FeedingOwnershipType;
  selectedTagId: string | null;
  mode: FeedingPrecisionMode;
  confidence?: number; // AI 辨識信心度（0.0-1.0）
  vesselId?: string; // 使用的容器 ID（用於誤差計算）
  /** 使用者備註 */
  note?: string;
}

export interface HydrationOwnershipLog {
  id: string;
  createdAt: number;
  totalMl: number;
  actualWaterMl?: number;
  ownershipType: FeedingOwnershipType;
  selectedTagId: string | null;
}
