export type DiseaseFocus = 'kidney' | 'diabetes' | 'fiv' | 'liver' | 'fip' | 'general';
export type CareLevel = 'basic' | 'advanced' | 'palliative';

export const DISEASE_LABEL: Record<DiseaseFocus, string> = {
  kidney: '腎貓',
  diabetes: '糖尿病',
  fiv: '愛滋貓',
  liver: '肝貓',
  fip: '腹膜炎(FIP)',
  general: '通則',
};

export const DISEASE_ICON: Record<DiseaseFocus, string> = {
  kidney: 'healing',
  diabetes: 'vaccines',
  fiv: 'pets',
  liver: 'bloodtype',
  fip: 'coronavirus',
  general: 'assignment',
};

export const CARE_LEVEL_LABEL: Record<CareLevel, string> = {
  basic: '基礎照護',
  advanced: '進階照護',
  palliative: '安寧照護',
};

export interface CarePoint {
  label: string;
  sub?: string[];
}

export interface CareSection {
  id: string;
  title: string;
  points: CarePoint[];
}

// 本文件僅供飼主了解常見疾病與照護原則，不構成診斷或處方建議。
// 所有「診斷、開藥、劑量、侵入性處置（皮下點滴、穿刺、餵食管等）」都必須由實際看診的獸醫決定與執行，請勿自行購藥或嘗試醫療操作。
export const CARE_KNOWLEDGE: Record<DiseaseFocus, Record<CareLevel, CareSection[]>> = {

  // ── 腎貓（慢性腎病）──────────────────────────────────────────────────────
  kidney: {
    basic: [
      {
        id: 'kidney_basic_diet',
        title: '飲食與水分',
        points: [
          { label: '使用腎臟處方飲食（低磷、中等蛋白、補充 B 群與電解質），避免自行亂換飲食。' },
          { label: '以濕食為主，或在食物中加水，提高總飲水量。' },
          { label: '家中多處放水碗或飲水機，鼓勵貓隨時喝水。' },
        ],
      },
      {
        id: 'kidney_basic_meds',
        title: '用藥與追蹤（由獸醫決定）',
        points: [
          {
            label: '常見藥物類型：',
            sub: ['降血壓藥、降磷劑、制酸劑、止吐藥、促食慾藥等。'],
          },
          { label: '原則：固定時間、固定劑量，不自行停藥或加減。' },
          {
            label: '規律回診檢查：',
            sub: [
              '血液：BUN、CREA、SDMA、磷、鈉、鉀等。',
              '尿液：尿比重、尿蛋白、尿沉渣。',
              '血壓：監測是否有高血壓。',
            ],
          },
        ],
      },
      {
        id: 'kidney_basic_observe',
        title: '在家觀察重點',
        points: [
          { label: '食慾是否下降、挑食或拒食。' },
          { label: '精神、活動力是否變差。' },
          { label: '體重是否持續下降（建議每 1–2 週量一次）。' },
          { label: '喝水與尿量是否突然增加或減少。' },
          { label: '嘔吐頻率、口臭是否加重。' },
        ],
      },
    ],
    advanced: [
      {
        id: 'kidney_adv_staging',
        title: '分期與治療目標',
        points: [
          {
            label: '早期：',
            sub: [
              '目標：延緩惡化。',
              '重點：腎處方飲食、控制血磷、血壓與蛋白尿、鼓勵多喝水。',
            ],
          },
          {
            label: '中度：',
            sub: [
              '目標：維持生活品質。',
              '重點：可能加入皮下點滴、處理貧血與低鉀、積極止吐與營養支持。',
            ],
          },
          {
            label: '晚期：',
            sub: [
              '目標：舒適優先。',
              '重點：多種藥物控制症狀，減少侵入性檢查與治療，評估安寧照護與安樂時機。',
            ],
          },
        ],
      },
      {
        id: 'kidney_adv_complications',
        title: '常見併發症與照護概念',
        points: [
          { label: '高血磷：加速腎臟惡化 → 低磷飲食＋磷結合劑。' },
          { label: '低鉀：無力、頸部垂頭、便祕 → 由獸醫評估補鉀。' },
          { label: '高血壓：增加視網膜剝離、失明與腦部風險 → 監測血壓＋降壓藥。' },
          { label: '貧血：虛弱、易喘 → 可能需補鐵、B 群、EPO 或輸血（獸醫決定）。' },
        ],
      },
      {
        id: 'kidney_adv_fluid',
        title: '皮下點滴與餵食管（獸醫指導下）',
        points: [
          { label: '皮下點滴：適合口服水分不足但可在家照顧者，須由獸醫教學頻率與量。' },
          { label: '餵食管：適用長期攝食不足或灌食壓力大者，手術與教學由獸醫負責。' },
        ],
      },
    ],
    palliative: [
      {
        id: 'kidney_pal_when',
        title: '3.3 何時考慮進入安寧階段',
        points: [
          { label: '頻繁尿毒症危機（嚴重嘔吐、食慾極差、虛弱）且住院改善有限。' },
          { label: '多次輸血、密集點滴後，生活品質仍未見起色。' },
          { label: '貓對醫療極度抗拒，長期處於恐懼與痛苦中。' },
        ],
      },
      {
        id: 'kidney_pal_care',
        title: '安寧照護重點',
        points: [
          { label: '以「不痛、不噁心、能休息」為目標：止痛、止吐藥由獸醫調整。' },
          { label: '減少折騰：能用口服或皮下注射就避免頻繁抽血與侵入處置。' },
          { label: '環境調整：短動線（食、水、砂盆靠近處）、柔軟溫暖的床、安靜少干擾。' },
        ],
      },
      {
        id: 'kidney_pal_euthanasia',
        title: '安樂死討論',
        points: [
          { label: '當貓長期處於明顯痛苦、拒絕進食、不再與環境互動，而醫療工具已盡時，可與獸醫討論安樂死作為終止痛苦的選項。決策須由獸醫與家人共同做出。' },
        ],
      },
    ],
  },

  // ── 糖尿病 (Diabetes) ──────────────────────────────────────────────────
  diabetes: {
    basic: [
      {
        id: 'db_basic_diet',
        title: '4.1 飲食與餵食目標',
        points: [
          { label: '高蛋白、相對低碳水主食，幫助穩定血糖並維持肌肉量。' },
          { label: '配合胰島素注射（同一時間、同樣模式），通常一日兩餐。' },
          { label: '避免隨意換料或餵食高碳水零食，以免血糖波動。' },
        ],
      },
      {
        id: 'db_basic_insulin',
        title: '4.2 胰島素注射 (概念)',
        points: [
          { label: '保存：多數需冷藏，不可劇烈搖晃（有些需輕輕滾動混勻）。' },
          { label: '注射手法：學會捏起皮膚形成皮下帳篷，避免打入肌肉或毛髮。' },
          { label: '安全守則：若該餐沒吃或貓明顯虛弱、步伐不穩，暫停打針並立即聯絡獸醫。' },
        ],
      },
      {
        id: 'db_basic_observe',
        title: '4.3 在家觀察與記錄',
        points: [
          { label: '每日記錄：食量、喝尿量變化、精神狀態及打針時間/劑量。' },
          { label: '體重監測：每 1-2 週一次，觀察有無「吃多但變胖或變瘦」現象。' },
        ],
      },
    ],
    advanced: [
      {
        id: 'db_adv_warning',
        title: '4.4 低血糖與高血糖警訊',
        points: [
          {
            label: '低血糖 (急症)：',
            sub: [
              '表現：虛弱、發抖、東倒西歪；嚴重時抽搐昏迷。',
              '急救：依醫囑塗抹糖水於牙齦並儘速送醫。',
            ],
          },
          {
            label: '長期控制不良：',
            sub: [
              '喝水尿量極多、吃多變瘦、毛質變差。',
              '酮酸中毒 (DKA) 警訊：嘔吐、極度虛弱、呼氣有丙酮味（水蜜桃/指甲油味）。',
            ],
          },
        ],
      },
      {
        id: 'db_adv_fup',
        title: '4.5 回診與長期追蹤',
        points: [
          { label: '穩定前：確診初期可能需每 1-2 週回診調整劑量。' },
          { label: '穩定後：每 2-3 個月回診檢查血糖曲線與血檢，監測併發症。' },
        ],
      },
    ],
    palliative: [
      {
        id: 'db_pal_care',
        title: '糖尿病安寧概念',
        points: [
          { label: '當有嚴重併發症（如腎衰）或癌症時，轉向維持基本血糖穩定，不造成渴或低血糖昏迷。' },
          { label: '維持基本舒適，不再強求精確血糖值。' },
          { label: '環境調整：短動線、柔軟床鋪、減少醫療干擾。' },
        ],
      },
    ],
  },

  // ── 愛滋貓（FIV 陽性）──────────────────────────────────────────────────
  fiv: {
    basic: [
      {
        id: 'fiv_basic_lifestyle',
        title: '生活型態',
        points: [
          { label: '建議全室內飼養，避免與陌生貓打架互咬，降低感染風險。' },
          { label: '減少環境變動，讓作息可預測，降低生活壓力。' },
        ],
      },
      {
        id: 'fiv_basic_diet_medical',
        title: '飲食與預防醫療',
        points: [
          { label: '均衡高品質飲食，避免生肉、生蛋等高細菌風險食物。' },
          { label: '定期健檢（約每 6 個月一次）：檢查口腔、皮膚與血檢。' },
        ],
      },
    ],
    advanced: [
      {
        id: 'fiv_adv_infection',
        title: '免疫不全與次發性感染',
        points: [
          { label: '常見問題：重度口炎、慢性呼吸道感染、難癒合傷口、腸炎。' },
          { label: '治療思路：優先提升生活品質與舒適度，而非追求病毒根除。' },
        ],
      },
      {
        id: 'fiv_adv_vaccine_surgery',
        title: '疫苗與手術',
        points: [
          { label: '疫苗補打需由獸醫依環境風險與免疫狀態個別評估。' },
          { label: '牙科手術（洗牙/拔牙）常能顯著改善重度口炎貓的生活品質。' },
        ],
      },
    ],
    palliative: [
      {
        id: 'fiv_pal_when',
        title: '5.3 何時進入安寧階段',
        points: [
          { label: '治療後感染仍頻繁且效果愈來愈差。' },
          { label: '出現多重器官問題（如嚴重貧血＋腫瘤＋慢性感染）。' },
          { label: '長期嚴重口痛，藥物與手術已難控制。' },
        ],
      },
      {
        id: 'fiv_pal_care',
        title: '安寧照護重點',
        points: [
          { label: '疼痛控制：使用止痛藥緩解口炎或腫瘤造成的不適。' },
          { label: '營養與餵食：提供軟質易吞食食物，必要時使用餵食管。' },
          { label: '環境調整：不再頻繁住院，專注居家症狀控制與安全感。' },
        ],
      },
      {
        id: 'fiv_pal_euthanasia',
        title: '安樂死討論',
        points: [
          { label: '當貓長期嚴重痛苦、無法進食，且無合理改善可能時，可討論終止痛苦。' },
        ],
      },
    ],
  },

  // ── 肝貓（肝病貓）──────────────────────────────────────────────────────
  liver: {
    basic: [
      {
        id: 'liver_basic_diet',
        title: '飲食與餵食',
        points: [
          { label: '選擇肝臟處方飲食（調整蛋白、脂肪、微量元素）。' },
          { label: '少量多餐，減少噁心感與肝臟處理負擔。' },
          { label: '若 2–3 天不吃（尤其是胖貓），請儘快就醫，防止脂肪肝。' },
        ],
      },
      {
        id: 'liver_basic_meds',
        title: '用藥與保肝（由獸醫決定）',
        points: [
          { label: '常用支持：SAMe、乳薊、維生素 B 群。' },
          { label: '膽管炎多需長療程抗生素與膽汁流動促進藥。' },
          { label: '免疫性肝炎需在血檢監測下使用免疫抑制劑。' },
        ],
      },
      {
        id: 'liver_basic_observe',
        title: '在家觀察重點',
        points: [
          { label: '食慾、體重、精神活力。' },
          { label: '黃疸訊號：眼白、牙齦、耳內發黃。' },
          { label: '尿色是否變深，是否有嘔吐、腹瀉。' },
        ],
      },
    ],
    advanced: [
      {
        id: 'liver_adv_types',
        title: '常見肝病策略',
        points: [
          { label: '脂肪肝：核心是穩定足量營養，多需餵食管長期支持。' },
          { label: '膽管炎：需長療程抗生素，有時搭配免疫藥物。' },
          { label: '肝性腦病變：出現神經症狀（發呆、癲癇），需調整飲食與使用乳果糖。' },
        ],
      },
      {
        id: 'liver_adv_tube',
        title: '6.2 餵食管照護（獸醫指導下）',
        points: [
          { label: '每次餵食後溫水沖洗管路防止堵塞。' },
          { label: '每日檢查管口皮膚衛生，保持乾燥。' },
          { label: '緩慢餵食避免嘔吐，異常脫落需立即回診。' },
        ],
      },
    ],
    palliative: [
      {
        id: 'liver_pal_when',
        title: '6.3 進入安寧階段的訊號',
        points: [
          { label: '黃疸持續嚴重且無法改善。' },
          { label: '肝性腦病變（意識模糊、癲癇）反覆發作。' },
          { label: '凝血功能異常或自發性出血。' },
          { label: '長期嗜睡、拒食、對環境失去反應。' },
        ],
      },
      {
        id: 'liver_pal_care',
        title: '安寧照護重點',
        points: [
          { label: '緩解症狀：止痛、止吐、控制癲癇。' },
          { label: '減少高侵入性處置，聚焦舒適度。' },
          { label: '防滑溫暖環境，協助其清潔身體維持尊嚴。' },
        ],
      },
      {
        id: 'liver_pal_euthanasia',
        title: '安樂死討論',
        points: [
          { label: '當神經症狀無法控制或長期昏迷，且無康復希望時。' },
        ],
      },
    ],
  },

  // ── FIP（貓傳染性腹膜炎）──────────────────────────────────────────────────────
  fip: {
    basic: [
      {
        id: 'fip_basic_env',
        title: '生活與環境',
        points: [
          { label: '溫暖安靜、不被打擾的環境。' },
          { label: '縮短動線：水、食、砂盆應靠近休息點，方便虛弱的貓。' },
        ],
      },
      {
        id: 'fip_basic_nutrition',
        title: '營養與水分',
        points: [
          { label: '目標是「吃得夠」：使用高熱量易消化食物，少量多餐。' },
          { label: '依醫囑使用食慾促進藥、點滴或餵食管，不自行決定。' },
        ],
      },
      {
        id: 'fip_basic_observe',
        title: '症狀記錄',
        points: [
          { label: '每日記錄體溫、食量與精神。' },
          { label: '觀察腹圍變化、呼吸快慢、眼睛混濁度。' },
        ],
      },
    ],
    advanced: [
      {
        id: 'fip_adv_treatment_tw',
        title: '台灣合法抗病毒研究方向',
        points: [
          { label: '目前已核准以 Molnupiravir 為基礎的動物用藥用於 FIP，應由醫囑開立。' },
          { label: 'GS-441524 目前尚未正式註冊為合法動物用藥，存在品質與法律風險。' },
          { label: '治療應採「合法藥物＋獸醫專業監督」為準。' },
        ],
      },
      {
        id: 'fip_adv_homecare',
        title: '治療期間照護',
        points: [
          { label: '規律給藥：不自行停藥、跳藥或改劑量。' },
          { label: '定期血檢：監測肝腎指標與發炎數據，確保療效安全。' },
          { label: '警訊：若好轉後突然發燒、腹水增加或神經症狀變差，須即刻回診。' },
        ],
      },
    ],
    palliative: [
      {
        id: 'fip_pal_symptoms',
        title: '7.4 症狀導向照護',
        points: [
          { label: '減輕痛苦：依獸醫處方給予止痛、抗噁心藥。' },
          { label: '腹/胸水壓迫：若造成呼吸困難，由獸醫評估是否抽水，不自行處置。' },
        ],
      },
      {
        id: 'fip_pal_terminal',
        title: '終末期與安樂死',
        points: [
          { label: '表現：高燒不退或極低體溫、張口喘氣、意識不清。' },
          { label: '在無治療可能且受苦嚴重時，可討論以此方式終止痛苦。' },
        ],
      },
    ],
  },

  // ── 通則（共通照護原則）────────────────────────────────────────────────
  general: {
    basic: [
      {
        id: 'gen_basic_env',
        title: '0.1 基本生活需求（環境與用品）',
        points: [
          {
            label: '環境佈置：',
            sub: [
              '室內安全防護：窗戶、陽台加裝防墜網/紗窗。',
              '垂直空間：提供高處（貓跳台、櫃頂）與躲藏處（紙箱、窩）。',
              '收好易吞食小物品、清潔劑與藥品。',
            ],
          },
          {
            label: '貓砂盆管理：',
            sub: [
              '數量：至少「貓口數 + 1」。',
              '位置：安靜、易到達，避免放在吵雜家電旁。',
              '清潔：每天至少清理兩次排泄物，定期整盆清換。',
            ],
          },
          {
            label: '抓柱與休息：',
            sub: [
              '提供穩固抓板（麻繩、紙質），需包含垂直與水平。',
              '多個低壓力的安靜休息點。',
            ],
          },
        ],
      },
      {
        id: 'gen_basic_diet',
        title: '1. 飲食營養與份量建議',
        points: [
          {
            label: '熱量需求估算：',
            sub: [
              '成貓大致為 40–60 kcal/kg/day。',
              '4.5kg 已結紮貓約需 220–280 kcal/day。',
              '受年齡、活動量、是否結紮影響。',
            ],
          },
          {
            label: '如何餵食：',
            sub: [
              '找到包裝標示熱量，每日目標熱量 ÷ 單位熱量 = 每日食量。',
              '建議 2–3 餐/天，避免自由採食（肥胖風險）。',
              '混合餵食：濕食可增加飲水量與嗜口性。',
            ],
          },
          {
            label: '禁忌食物：',
            sub: ['洋蔥、韭、蒜、葡萄、巧克力、酒精、咖啡因、過鹹調味。'],
          },
        ],
      },
      {
        id: 'gen_basic_redflags',
        title: '0.5 立刻就醫紅旗 (Red Flags)',
        points: [
          { label: '超過 24 小時不吃不喝。' },
          { label: '步態不穩、跛腳或突然跳不上去。' },
          { label: '持續嘔吐、血便或血尿。' },
          { label: '頻繁進出砂盆、蹲很久尿不出（尤其是公貓）。' },
          { label: '張口喘氣、呼吸急促或費力。' },
          { label: '抽搐、意識不清或昏迷。' },
        ],
      },
    ],
    advanced: [
      {
        id: 'gen_adv_checkups',
        title: '預防醫療',
        points: [
          { label: '健檢：1歲後每年一次，7歲後每半年一次。' },
          { label: '預防：定期補強疫苗與內外驅蟲防護。' },
          { label: '口腔：監控牙齦牙周狀況，定期安排專業洗牙。' },
        ],
      },
    ],
    palliative: [
      {
        id: 'gen_pal_spectrum',
        title: '8. 共通解析：緩和醫療 vs 臨終照護',
        points: [
          { label: '緩和醫療：任何階段皆可啟動，重點在止痛、止吐、改善 QoL。' },
          { label: '臨終照護：不再追逐延壽，專注於舒適、尊嚴與善終。' },
        ],
      },
      {
        id: 'gen_pal_qol',
        title: '8.2 生活品質 (QoL) 評估軸向',
        points: [
          { label: '吃與喝 (0-10)：是否有自發進食意願與水分攝取。' },
          { label: '痛與不適 (0-10)：疼痛、噁心或呼吸困擾是否可被藥物控制。' },
          { label: '精神互動 (0-10)：是否會探索環境、看窗外、連繫家人。' },
          { label: '清潔排泄 (0-10)：能否自理入廁，維持身體乾爽。' },
          { label: '結論：當壞日子遠多於好日子，即是考慮調整醫療強度或安樂時機。' },
        ],
      },
      {
        id: 'gen_pal_roles',
        title: '8.3 角色分工與決策',
        points: [
          { label: '飼主：觀察記錄、執行居家護理、代理個案利益。' },
          { label: '獸醫：診斷計畫、藥物設計、執行侵入醫療與安樂死。' },
          { label: 'APP/KB：提供理解支持與安全記錄，不代替專業判斷。' },
        ],
      },
    ],
  },
};
