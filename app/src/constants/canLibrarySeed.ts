import type { CannedItem } from '../types/app';

/** 罐頭庫種子（Wet Food DB）。目前為空，之後可擴充；格式同 CannedItem（id 由 app 產生則可省略）。 */
export const WET_CAN_SEED: (Omit<CannedItem, 'id'> & { id?: string })[] = [];
