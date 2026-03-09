import { AiImageInput } from './ai';

export type Level = 'household' | `cat_${string}`;
export type BottomTab = 'home' | 'records' | 'knowledge' | 'profile';
export type ActiveModal = 'feeding' | 'feedingLateEntry' | 'water' | 'elimination' | 'medication' | 'symptom' | 'settings' | 'blood' | 'bloodHistory' | 'bloodDetail' | 'kcalAdvice' | 'waterAdvice' | 'backup' | 'iap' | 'addCat' | 'editCat' | 'recordDetail' | 'weightRecord' | 'canLibrary' | 'feedLibrary' | null;
export type CapturedImage = Required<Pick<AiImageInput, 'uri' | 'imageBase64' | 'mimeType'>>;
export type StoredFeedingT0 = CapturedImage & { capturedAt: number; manualWeight?: number; foodType?: 'dry' | 'wet' | 'mixed'; vesselId?: string };
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
export type DepthCategory = 'shallow' | 'normal' | 'deep';

/** 容器用途：食碗（食物記錄用）、水碗（飲水記錄用） */
export type VesselType = 'feeding' | 'hydration';

/** 食物類型：乾飼料（預設份量沿用）／罐頭濕食（每次輸入克數） */
export type FoodType = 'dry' | 'wet';

/** 食物記錄來源：自動餵食器／乾糧一次給一天／罐頭／自煮 */
export type FoodSourceType = 'auto_feeder' | 'dry_once' | 'canned' | 'homemade';

/** 罐頭庫項目（極簡版，Canned / Wet Food DB；新欄位可選以相容舊儲存） */
export interface CannedItem {
  id: string;
  brand?: string;
  /** 品名內可帶「主食罐/副食罐/幼貓/泌尿配方」等 */
  product_name?: string;
  flavor?: string;
  food_form?: 'wet';
  complete_or_complement?: string;
  is_prescription?: 'yes' | 'no';
  search_keywords?: string;
  /** brand + " " + product_name + " " + flavor；新增時必填 */
  display_name?: string;
  /** 預設克數（一罐／一份），記錄時用 */
  defaultGrams?: number;
  /** 每 100g 熱量（kcal），用於預估；未設則用預設值 */
  kcalPer100?: number;
  /** 是否來自種子庫（false = 使用者自選加入，紀錄時優先顯示） */
  fromSeed?: boolean;
  /** 向後相容舊資料，請用 getCannedDisplayName() */
  name?: string;
}

/** 飼料設定項目（極簡版，Dry Food DB；新欄位可選以相容舊儲存） */
export interface FeedLibraryItem {
  id: string;
  brand?: string;
  /** 品名內可帶幼貓/室內/泌尿保健等字 */
  product_name?: string;
  flavor?: string;
  food_form?: 'dry';
  complete_or_complement?: string;
  is_prescription?: 'yes' | 'no';
  search_keywords?: string;
  /** brand + " " + product_name + " " + flavor；新增時必填 */
  display_name?: string;
  /** 每克熱量 kcal/g（記錄時帶入） */
  kcalPerGram: number;
  /** 是否來自種子庫（false = 使用者自選加入，紀錄時優先顯示） */
  fromSeed?: boolean;
  /** 向後相容舊資料，請用 getFeedDisplayName() */
  name?: string;
}

/** 罐頭標籤掃描 API 回傳（後端串接後補齊） */
export interface CanLabelScanResult {
  name?: string;
  defaultGrams?: number;
  kcalPer100?: number;
}

/** 罐頭顯示名稱（相容舊 name；新資料用 display_name） */
export function getCannedDisplayName(item: CannedItem): string {
  if (item.display_name) return item.display_name;
  if (item.name) return item.name;
  const parts = [item.brand, item.product_name, item.flavor].filter(Boolean);
  return parts.length ? parts.join(' ') : '罐頭';
}

/** 飼料顯示名稱（相容舊 name；新資料用 display_name） */
export function getFeedDisplayName(item: FeedLibraryItem): string {
  if (item.display_name) return item.display_name;
  if (item.name) return item.name;
  const parts = [item.brand, item.product_name, item.flavor].filter(Boolean);
  return parts.length ? parts.join(' ') : '飼料';
}

/** 自煮食材選項（Spec v3：熱量範圍僅供參考） */
export const HOMEMADE_INGREDIENTS: Array<{ id: string; label: string; minKcal: number; maxKcal: number }> = [
  { id: 'chicken', label: '雞肉', minKcal: 100, maxKcal: 150 },
  { id: 'fish', label: '魚肉', minKcal: 90, maxKcal: 130 },
  { id: 'beef', label: '牛肉', minKcal: 120, maxKcal: 180 },
  { id: 'other', label: '其他', minKcal: 80, maxKcal: 200 },
];

/** 攝取程度（Spec v1）：幾乎沒吃 0% ～ 吃完了 100% */
export type IntakeLevel = 'almost_none' | 'some' | 'half' | 'most' | 'all';

export const INTAKE_LEVEL_LABEL: Record<IntakeLevel, string> = {
  almost_none: '幾乎沒吃',
  some: '吃了一些',
  half: '吃了一半',
  most: '吃了大半',
  all: '吃完了',
};

export const INTAKE_LEVEL_RATIO: Record<IntakeLevel, number> = {
  almost_none: 0,
  some: 0.25,
  half: 0.5,
  most: 0.75,
  all: 1,
};

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
  /** 食碗（食物）或 水碗（飲水），未設時視為食碗以相容舊資料 */
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

  // 深度分類與淺/深碗判定
  depthCategory?: DepthCategory;
  isShallow?: boolean;
  isDeep?: boolean;
  rimToBottomDistanceCm?: number; // 碗口到碗底的精確深度

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
  /** 滿碗克數（可選）：乾飼料裝滿時約幾克；有設時優先於 volumeMl×0.8×0.45 作為放飯參考與 AI 錨定 */
  maxGramsWhenFull?: number;
  /** 食碗容器類型：食碗模式（一般碗）／自動餵食器模式。僅 vesselType === 'feeding' 時使用 */
  feedingContainerMode?: 'bowl' | 'auto_feeder';
  /** 自動餵食器模式：每日出糧次數。僅 feedingContainerMode === 'auto_feeder' 時使用 */
  dailyPortionCount?: number;
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
  /** 食物記錄來源（Spec v1） */
  foodSourceType?: FoodSourceType;
  /** 攝取程度（Spec v1：0%～100% 對應 almost_none～all） */
  intakeLevel?: IntakeLevel;
  /** 是否為補填記錄（忘記記 T1 後補） */
  isLateEntry?: boolean;
  /** 罐頭庫項目 ID（僅 foodSourceType === 'canned'） */
  canId?: string;
  /** 自煮食材（僅 foodSourceType === 'homemade'） */
  ingredients?: string[];
  /** 手動輸入時可自由填寫的食物類型（例：混飼料、罐頭+乾糧） */
  manualFoodType?: string;
}

export interface HydrationOwnershipLog {
  id: string;
  createdAt: number;
  totalMl: number;
  actualWaterMl?: number;
  ownershipType: FeedingOwnershipType;
  selectedTagId: string | null;
}
