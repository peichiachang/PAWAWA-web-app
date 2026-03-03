import React, { useState, useEffect } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, Platform, Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { VesselCalibration, VesselShape, VesselType, CapturedImage } from '../../types/app';
import { styles } from '../../styles/common';
import { AppIcon } from '../AppIcon';
import {
  calculateVesselVolume,
  validateVesselDimensions,
  isVolumeReasonable,
  recalculateVesselVolume,
  calculateCalibrationFactor,
} from '../../utils/vesselVolume';
import { calculateTotalVolumeFromContour } from '../../utils/profileVolume';
import { AiRecognitionService } from '../../types/ai';
import { CustomCamera } from '../CustomCamera';

interface Props {
    visible: boolean;
    profiles: VesselCalibration[];
    onClose: () => void;
    onSave: (profiles: VesselCalibration[]) => void;
    ai?: AiRecognitionService; // AI 服務（可選，用於側面輪廓識別）
}

export function VesselCalibrationModal({ visible, profiles, onClose, onSave, ai }: Props) {
    const [editingProfile, setEditingProfile] = useState<VesselCalibration | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);

    // Form states
    const [name, setName] = useState('');
    const [vesselType, setVesselType] = useState<VesselType>('feeding');
    const [shape, setShape] = useState<VesselShape>('cylinder');
    const [length, setLength] = useState('');
    const [width, setWidth] = useState('');
    const [height, setHeight] = useState('');
    // radius 在圓柱模式下實際存的是「直徑」
    const [radius, setRadius] = useState('');
    const [topRadius, setTopRadius] = useState('');
    const [bottomRadius, setBottomRadius] = useState('');
    const [knownVolumeMl, setKnownVolumeMl] = useState(''); // 已知容量（毫升）
    const [inputMethod, setInputMethod] = useState<'dimensions' | 'volume' | 'side_profile'>('dimensions'); // 輸入方式：尺寸、已知容量或側面輪廓
    const [measuredVolumeMl, setMeasuredVolumeMl] = useState(''); // 實際測量容量（用於校準）
    
    // 側面輪廓相關狀態
    const [sideProfileImage, setSideProfileImage] = useState<CapturedImage | null>(null);
    const [topViewImage, setTopViewImage] = useState<CapturedImage | null>(null);
    const [rimDiameterCm, setRimDiameterCm] = useState('');
    const [isAnalyzingProfile, setIsAnalyzingProfile] = useState(false);
    const [profileAnalysisResult, setProfileAnalysisResult] = useState<any>(null);
    /** 是否正在拍攝側面照（內嵌相機顯示時為 true，拍完/取消後設為 false，照片會帶入同畫面 state） */
    const [isCapturingSide, setIsCapturingSide] = useState(false);
    const [isCapturingTop, setIsCapturingTop] = useState(false);

    const handleOpenMeasure = async () => {
        if (Platform.OS !== 'ios') {
            Alert.alert('提示', '測距儀功能僅支援 iOS 裝置。');
            return;
        }

        const url = 'measure://';

        try {
            const supported = await Linking.canOpenURL(url);
            if (supported) {
                await Linking.openURL(url);
            } else {
                Alert.alert('無法開啟', '請確認您的裝置已安裝 iOS 內建的「測距儀」App。');
            }
        } catch {
            Alert.alert('無法開啟', '請確認您的裝置已安裝 iOS 內建的「測距儀」App。');
        }
    };

    // 側面輪廓拍攝：改為內嵌相機，拍完照片直接帶入本畫面 state，不再用全域 launchCamera
    const handleStartCaptureSideProfile = () => {
        if (!ai || !ai.analyzeSideProfile) {
            Alert.alert('功能不可用', 'AI 側面輪廓識別功能尚未啟用。');
            return;
        }
        setIsCapturingSide(true);
    };

    // 俯視檢查照拍攝（選填，只存圖做檢查與未來可能的幾何校正）
    const handleStartCaptureTopView = () => {
        setIsCapturingTop(true);
    };

    // AI 識別側面輪廓（計算按鈕觸發）
    const handleAnalyzeSideProfile = async () => {
        if (!sideProfileImage || !rimDiameterCm || !ai || !ai.analyzeSideProfile) {
            Alert.alert('缺少資訊', '請先拍攝側面照並輸入碗口直徑。');
            return;
        }

        const rimD = parseFloat(rimDiameterCm);
        if (!rimD || rimD <= 0) {
            Alert.alert('輸入錯誤', '請輸入有效的碗口直徑（公分）。');
            return;
        }

        try {
            setIsAnalyzingProfile(true);
            const result = await ai.analyzeSideProfile({
                imageBase64: sideProfileImage.imageBase64!,
                rimDiameterCm: rimD,
            });
            
            if (result.contour && result.contour.points.length > 0) {
                setProfileAnalysisResult(result);
            } else {
                Alert.alert('計算失敗', '無法識別輪廓，請確認照片是否清晰且從正側面拍攝。');
            }
        } catch (error) {
            console.error('[VesselCalibration] Side profile analysis error:', error);
            Alert.alert('計算失敗', (error as Error).message || 'AI 計算失敗，請重試。');
        } finally {
            setIsAnalyzingProfile(false);
        }
    };

    const openForm = (profile: VesselCalibration | null = null) => {
        setEditingProfile(profile);
        setName(profile?.name || '');
        setVesselType(profile?.vesselType || 'feeding');
        setShape(profile?.shape || 'cylinder');
        setHeight(profile?.dimensions.height?.toString() || '');
        setLength(profile?.dimensions.length?.toString() || '');
        setWidth(profile?.dimensions.width?.toString() || '');
        setRadius(profile?.dimensions.radius?.toString() || '');
        setTopRadius(profile?.dimensions.topRadius?.toString() || '');
        setBottomRadius(profile?.dimensions.bottomRadius?.toString() || '');
        setKnownVolumeMl(profile?.volumeMl?.toString() || '');
        // measuredVolumeMl 目前 UI 不再顯示，但保留舊資料，不主動帶回表單
        setMeasuredVolumeMl('');
        setRimDiameterCm(profile?.rimDiameterCm?.toString() || '');
        setSideProfileImage(profile?.sideProfileImageBase64 ? {
            uri: '',
            imageBase64: profile.sideProfileImageBase64,
            mimeType: 'image/jpeg',
        } : null);

        // 舊資料的 profileContour 直接是 ProfileContour，新版 AI 回傳的是 { contour, ... }
        if (profile?.profileContour) {
            setProfileAnalysisResult({
                contour: profile.profileContour,
                confidence: (profile.profileContour as any).confidence ?? 0.9,
                estimatedVolumeMl: undefined,
            });
        } else {
            setProfileAnalysisResult(null);
        }

        setTopViewImage(profile?.topViewImageBase64 ? {
            uri: '',
            imageBase64: profile.topViewImageBase64,
            mimeType: 'image/jpeg',
        } : null);
        
        // 判斷輸入方式
        if (profile?.calibrationMethod === 'side_profile') {
            setInputMethod('side_profile');
        } else if (profile?.calibrationMethod === 'known_volume') {
            setInputMethod('volume');
        } else if (profile?.volumeMl && !profile.dimensions.radius && !profile.dimensions.length) {
            // 舊資料：沒有標記 calibrationMethod，但有 volumeMl 且沒有幾何尺寸，視為已知容量
            setInputMethod('volume');
        } else {
            setInputMethod('dimensions');
        }
        setIsFormOpen(true);
    };

    const handleSaveProfile = () => {
        const cal: VesselCalibration = {
            id: editingProfile?.id || `vessel_${Date.now()}`,
            name: name || (vesselType === 'hydration' ? '未命名水碗' : '未命名食碗'),
            vesselType,
            shape,
            dimensions: {
                height: parseFloat(height) || 0,
                length: length ? parseFloat(length) : undefined,
                width: width ? parseFloat(width) : undefined,
                radius: radius ? parseFloat(radius) : undefined,
                topRadius: topRadius ? parseFloat(topRadius) : undefined,
                bottomRadius: bottomRadius ? parseFloat(bottomRadius) : undefined,
            },
        };

        // 如果使用者選擇側面輪廓方式
        if (inputMethod === 'side_profile') {
                if (!sideProfileImage || !rimDiameterCm || !profileAnalysisResult || !height) {
                Alert.alert('缺少資訊', '請完成側面輪廓校準：\n1. 拍攝側面照\n2. 輸入碗口直徑與碗高度\n3. 點擊「計算輪廓」按鈕', [{ text: '確定', style: 'cancel' }]);
                return;
            }
            
            const rimD = parseFloat(rimDiameterCm);
            const bowlHeight = parseFloat(height);
            if (!rimD || rimD <= 0) {
                Alert.alert('輸入錯誤', '請輸入有效的碗口直徑（公分）。', [{ text: '確定', style: 'cancel' }]);
                return;
            }
            if (!bowlHeight || bowlHeight <= 0) {
                Alert.alert('輸入錯誤', '請輸入有效的碗高度（公分）。', [{ text: '確定', style: 'cancel' }]);
                return;
            }

            cal.calibrationMethod = 'side_profile';
            cal.sideProfileImageBase64 = sideProfileImage.imageBase64;
            cal.rimDiameterCm = rimD;
            // 將碗總高度一併存入 dimensions，後續水位推估可重用
            cal.dimensions.height = bowlHeight;
            // 若有俯視檢查照，一併存入（目前主要做記錄與未來校正使用）
            if (topViewImage?.imageBase64) {
                cal.topViewImageBase64 = topViewImage.imageBase64;
            }
            cal.profileContour = {
                points: profileAnalysisResult.contour.points,
                confidence: profileAnalysisResult.contour.confidence,
                estimatedHeightCm: profileAnalysisResult.contour.estimatedHeightCm,
            };
            
            // 計算體積（使用輪廓數據 + 高度校正）
            let contourVolume = calculateTotalVolumeFromContour(profileAnalysisResult.contour);

            // 高度校正：僅在「使用者高度 > AI 估計高度」時放大體積，避免 AI 高估高度時把體積壓得太小（例如同尺寸圓柱 4L、AI 卻只給 766ml）
            const estimatedHeight = profileAnalysisResult.contour.estimatedHeightCm ?? profileAnalysisResult.estimatedHeightCm;
            if (estimatedHeight != null && estimatedHeight > 0 && bowlHeight > 0) {
                if (bowlHeight > estimatedHeight) {
                    contourVolume = contourVolume * (bowlHeight / estimatedHeight);
                }
                // 若 bowlHeight <= estimatedHeight，不再乘 (bowlHeight/estimatedHeight)，避免過度縮小
            }

            cal.volumeMl = contourVolume;

            // 合理性檢查：同一組直徑+高度，圓柱公式約 π*(D/2)²*H；若 AI 輪廓體積遠小於此，多半是 AI 比例或高度估錯
            const cylinderVolumeMl = Math.PI * Math.pow(rimD / 2, 2) * bowlHeight;
            if (cylinderVolumeMl > 0 && contourVolume < cylinderVolumeMl * 0.5) {
                const doSaveAnyway = () => {
                    if (measuredVolumeMl && parseFloat(measuredVolumeMl) > 0) {
                        const measuredVol = parseFloat(measuredVolumeMl);
                        const calibrationFactor = calculateCalibrationFactor(contourVolume, measuredVol);
                        cal.calibrationFactor = calibrationFactor;
                        cal.measuredVolumeMl = measuredVol;
                        cal.volumeMl = contourVolume * calibrationFactor;
                    }
                    const nextProfiles = editingProfile ? profiles.map(p => p.id === editingProfile.id ? cal : p) : [...profiles, cal];
                    onSave(nextProfiles);
                    setIsFormOpen(false);
                };
                Alert.alert(
                    '計算結果可能不準',
                    `依您輸入的碗口直徑 ${rimD}cm、碗高 ${bowlHeight}cm，若為圓柱約 ${Math.round(cylinderVolumeMl)}ml。\n\nAI 輪廓算出約 ${Math.round(contourVolume)}ml，明顯偏小，可能原因：側面照比例或 AI 高度估計誤差。\n\n建議：改用「已知容量」直接輸入實際容量，或重新拍攝側面照後再試。`,
                    [
                        { text: '仍要儲存', onPress: doSaveAnyway },
                        { text: '取消', style: 'cancel' },
                    ]
                );
                return;
            }

            // 如果有實際測量值，計算校準係數
            if (measuredVolumeMl && parseFloat(measuredVolumeMl) > 0) {
                const measuredVol = parseFloat(measuredVolumeMl);
                const calibrationFactor = calculateCalibrationFactor(contourVolume, measuredVol);
                cal.calibrationFactor = calibrationFactor;
                cal.measuredVolumeMl = measuredVol;
                cal.volumeMl = contourVolume * calibrationFactor;
            }
        }
        // 如果使用者選擇直接輸入已知容量
        else if (inputMethod === 'volume') {
            const volume = parseFloat(knownVolumeMl);
            if (!volume || volume <= 0) {
                Alert.alert('輸入錯誤', '請輸入有效的容量值（毫升）。', [{ text: '確定', style: 'cancel' }]);
                return;
            }
            if (volume > 10000) {
                Alert.alert('容量異常', `容量 ${volume}ml（${(volume/1000).toFixed(1)}L）過大，請確認數值是否正確。`, [{ text: '確定', style: 'cancel' }]);
                return;
            }
            // 已知容量模式：明確標記為 known_volume，後續計算一律以 volumeMl 為主
            cal.calibrationMethod = 'known_volume';
            cal.calibrationFactor = undefined;
            cal.measuredVolumeMl = undefined;
            cal.volumeMl = volume;
        } else {
            // 驗證輸入尺寸的合理性
            const validation = validateVesselDimensions(shape, cal.dimensions);
            if (!validation.isValid) {
                Alert.alert('輸入值異常', validation.errorMessage, [{ text: '確定', style: 'cancel' }]);
                return;
            }

            // 計算幾何體積（主要方式）
            const calculatedVolume = calculateVesselVolume(cal);
            if (calculatedVolume === undefined) {
                Alert.alert('無法計算體積', '請確認所有必要的尺寸都已輸入，或選擇「已知容量」輸入方式。', [{ text: '確定', style: 'cancel' }]);
                return;
            }

            // 顯示計算詳情（用於調試）
            if (shape === 'cylinder' && cal.dimensions.radius) {
                const diameter = cal.dimensions.radius;
                const radius = diameter / 2;
                const height = cal.dimensions.height;
                console.log(`[VesselVolume] 計算詳情: 直徑=${diameter}cm, 半徑=${radius}cm, 高度=${height}cm, 體積=${calculatedVolume.toFixed(2)}ml`);
                console.log(`[VesselVolume] 公式: π × ${radius.toFixed(2)}² × ${height} = ${calculatedVolume.toFixed(2)}ml`);
            }

            // 如果有實際測量值，計算校準係數並應用修正
            if (measuredVolumeMl && parseFloat(measuredVolumeMl) > 0) {
                const measuredVol = parseFloat(measuredVolumeMl);
                const calibrationFactor = calculateCalibrationFactor(calculatedVolume, measuredVol);
                cal.calibrationFactor = calibrationFactor;
                cal.measuredVolumeMl = measuredVol;
                // 應用校準係數修正幾何計算結果
                cal.volumeMl = calculatedVolume * calibrationFactor;
                console.log(`[VesselVolume] 校準: 計算=${calculatedVolume.toFixed(2)}ml, 實際=${measuredVol}ml, 係數=${calibrationFactor.toFixed(3)}, 修正後=${cal.volumeMl.toFixed(2)}ml`);
            } else {
                // 沒有實際測量值，直接使用幾何計算結果
                cal.volumeMl = calculatedVolume;
            }

            // 檢查體積是否合理
            if (!isVolumeReasonable(calculatedVolume) && calculatedVolume > 5000) {
                const volumeLiters = (calculatedVolume / 1000).toFixed(1);
                Alert.alert(
                    '計算結果異常',
                    `計算出的體積為 ${Math.round(calculatedVolume)}ml（約 ${volumeLiters} 公升）。\n\n一般食碗體積範圍：200-2000ml\n\n如果這是飲水機等大型容器，建議使用「直接輸入已知容量」的方式。\n\n可能原因：\n1. 輸入數值錯誤\n2. 單位錯誤（應為「公分」而非「毫米」）\n3. 形狀選擇不正確\n4. 測量了外徑而非內徑`,
                    [
                        { text: '取消', style: 'cancel' },
                        { text: '改用已知容量', onPress: () => {
                            setInputMethod('volume');
                            setKnownVolumeMl(Math.round(calculatedVolume).toString());
                        }},
                        { text: '仍要儲存', onPress: () => {
                            let nextProfiles: VesselCalibration[];
                            if (editingProfile) {
                                nextProfiles = profiles.map(p => p.id === editingProfile.id ? cal : p);
                            } else {
                                nextProfiles = [...profiles, cal];
                            }
                            onSave(nextProfiles);
                            setIsFormOpen(false);
                        }}
                    ]
                );
                return;
            }
            
            // 額外檢查：如果計算結果與已知容量差異超過 50%，強烈建議使用已知容量
            if (inputMethod === 'dimensions' && knownVolumeMl && parseFloat(knownVolumeMl) > 0) {
                const knownVol = parseFloat(knownVolumeMl);
                const diffPercent = Math.abs((calculatedVolume - knownVol) / knownVol * 100);
                if (diffPercent > 50) {
                    Alert.alert(
                        '計算結果與已知容量差異過大',
                        `計算出的體積：${Math.round(calculatedVolume)}ml\n已知容量：${Math.round(knownVol)}ml\n差異：${diffPercent.toFixed(1)}%\n\n⚠️ 差異超過 50%，強烈建議：\n1. 檢查輸入的尺寸是否正確\n2. 確認測量的是「內徑」而非「外徑」\n3. 或直接使用「已知容量」輸入方式`,
                        [
                            { text: '取消', style: 'cancel' },
                            { text: '改用已知容量', onPress: () => {
                                setInputMethod('volume');
                            }},
                            { text: '檢查輸入值', style: 'default' },
                            { text: '仍要儲存', onPress: () => {
                                let nextProfiles: VesselCalibration[];
                                if (editingProfile) {
                                    nextProfiles = profiles.map(p => p.id === editingProfile.id ? cal : p);
                                } else {
                                    nextProfiles = [...profiles, cal];
                                }
                                onSave(nextProfiles);
                                setIsFormOpen(false);
                            }}
                        ]
                    );
                    return;
                }
            }
        }

        // 空碗俯視照（校準參考，供 T0/T1 碗位比對）
        if (topViewImage?.imageBase64) {
            cal.topViewImageBase64 = topViewImage.imageBase64;
        }

        let nextProfiles: VesselCalibration[];
        if (editingProfile) {
            nextProfiles = profiles.map(p => p.id === editingProfile.id ? cal : p);
        } else {
            nextProfiles = [...profiles, cal];
        }
        onSave(nextProfiles);
        setIsFormOpen(false);
    };

    const handleDelete = (id: string) => {
        onSave(profiles.filter(p => p.id !== id));
    };

    // 如果不可見，不渲染任何內容（必須在所有 hooks 之後）
    if (!visible) {
        return null;
    }

    if (isFormOpen) {
        // 側面輪廓：正在拍攝時，表單區改為內嵌相機，拍完/取消後照片會帶入同畫面
        const showSideCamera = inputMethod === 'side_profile' && isCapturingSide;
        const showTopCamera = (inputMethod === 'side_profile' || inputMethod === 'dimensions' || inputMethod === 'volume') && isCapturingTop;
        const showInlineCamera = showSideCamera || showTopCamera;
        return (
            <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
                <SafeAreaView style={styles.modalBackdrop}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{editingProfile ? '編輯食碗' : '新增食碗'}</Text>
                            <Pressable onPress={() => { setIsFormOpen(false); setIsCapturingSide(false); setIsCapturingTop(false); }}><Text style={styles.closeText}>×</Text></Pressable>
                        </View>
                        {showInlineCamera ? (
                            <View style={[styles.modalBody, { flex: 1 }]}>
                                {showSideCamera ? (
                                    <CustomCamera
                                        title="側面輪廓校準（從正側面拍攝空碗）"
                                        customOptions={{ showGuide: false }}
                                        onCapture={(image) => {
                                            setSideProfileImage(image);
                                            setProfileAnalysisResult(null);
                                            setIsCapturingSide(false);
                                        }}
                                        onCancel={() => setIsCapturingSide(false)}
                                    />
                                ) : showTopCamera ? (
                                    <CustomCamera
                                        title="空碗俯視照（從上方拍攝空碗，作為飲食記錄校準參考）"
                                        customOptions={{ showGuide: false }}
                                        onCapture={(image) => {
                                            setTopViewImage(image);
                                            setIsCapturingTop(false);
                                        }}
                                        onCancel={() => setIsCapturingTop(false)}
                                    />
                                ) : null}
                            </View>
                        ) : (
                        <ScrollView style={styles.modalBody}>
                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>名稱</Text>
                                <TextInput
                                    style={styles.input}
                                    value={name}
                                    onChangeText={setName}
                                    placeholder={vesselType === 'hydration' ? '例如: 飲水機' : '例如: 藍色圓碗'}
                                />
                            </View>

                            <View style={{ marginBottom: 16 }}>
                                <Text style={styles.formLabel}>用途</Text>
                                <View style={styles.choiceRow}>
                                    <Pressable
                                        style={[styles.choiceBtn, vesselType === 'feeding' && styles.choiceBtnActive]}
                                        onPress={() => setVesselType('feeding')}
                                    >
                                        <Text style={[styles.choiceBtnText, vesselType === 'feeding' && styles.choiceBtnTextActive]}>食碗</Text>
                                    </Pressable>
                                    <Pressable
                                        style={[styles.choiceBtn, vesselType === 'hydration' && styles.choiceBtnActive]}
                                        onPress={() => setVesselType('hydration')}
                                    >
                                        <Text style={[styles.choiceBtnText, vesselType === 'hydration' && styles.choiceBtnTextActive]}>水碗</Text>
                                    </Pressable>
                                </View>
                                <Text style={{ fontSize: 11, color: '#666', marginTop: 4 }}>食碗用於飲食記錄，水碗用於飲水記錄</Text>
                            </View>

                            <View style={{ marginBottom: 16 }}>
                                <Text style={styles.formLabel}>碗型選擇</Text>
                                <View style={styles.choiceRow}>
                                    {(['cylinder', 'trapezoid', 'sphere'] as VesselShape[]).map((s) => (
                                        <Pressable
                                            key={s}
                                            style={[styles.choiceBtn, shape === s && styles.choiceBtnActive]}
                                            onPress={() => setShape(s)}
                                        >
                                            <Text style={[styles.choiceBtnText, shape === s && styles.choiceBtnTextActive]}>
                                                {s === 'cylinder' ? '圓柱' : s === 'trapezoid' ? '梯形/方' : '球形'}
                                            </Text>
                                        </Pressable>
                                    ))}
                                </View>
                            </View>

                            <View style={{ marginBottom: 16 }}>
                                <Text style={styles.formLabel}>輸入方式</Text>
                                <View style={styles.choiceRow}>
                                    <Pressable
                                        style={[styles.choiceBtn, inputMethod === 'dimensions' && styles.choiceBtnActive]}
                                        onPress={() => setInputMethod('dimensions')}
                                    >
                                        <Text style={[styles.choiceBtnText, inputMethod === 'dimensions' && styles.choiceBtnTextActive]}>
                                            測量尺寸
                                        </Text>
                                    </Pressable>
                                    <Pressable
                                        style={[styles.choiceBtn, inputMethod === 'side_profile' && styles.choiceBtnActive]}
                                        onPress={() => {
                                            if (!ai || !ai.analyzeSideProfile) {
                                                Alert.alert('功能不可用', '側面輪廓識別功能需要 AI 服務支援。');
                                                return;
                                            }
                                            setInputMethod('side_profile');
                                        }}
                                    >
                                        <Text style={[styles.choiceBtnText, inputMethod === 'side_profile' && styles.choiceBtnTextActive]}>
                                            側面輪廓
                                        </Text>
                                    </Pressable>
                                    <Pressable
                                        style={[styles.choiceBtn, inputMethod === 'volume' && styles.choiceBtnActive]}
                                        onPress={() => setInputMethod('volume')}
                                    >
                                        <Text style={[styles.choiceBtnText, inputMethod === 'volume' && styles.choiceBtnTextActive]}>
                                            已知容量
                                        </Text>
                                    </Pressable>
                                </View>
                                <Text style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                                    {inputMethod === 'dimensions' 
                                        ? '透過測量尺寸計算體積（AI 辨識主要方式）。可選填實際測量值進行校準'
                                        : inputMethod === 'side_profile'
                                        ? 'AI 側面輪廓重建（最準確，誤差 ±3-5%）。只需拍攝側面照 + 輸入碗口直徑'
                                        : '直接輸入已知容量（適合飲水機等大型容器）'}
                                </Text>
                            </View>

                            {inputMethod === 'side_profile' ? (
                                <>
                                    <View style={{ marginBottom: 16, padding: 12, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#3b82f6', borderRadius: 4 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                                            <AppIcon name="camera-alt" size={16} color="#1e40af" style={{ marginRight: 6 }} />
                                            <Text style={{ fontSize: 12, fontWeight: '700', color: '#1e40af' }}>側面輪廓校準（一次性）</Text>
                                        </View>
                                        <Text style={{ fontSize: 11, color: '#1e3a8a', lineHeight: 16, marginBottom: 8 }}>
                                            從正側面拍攝空碗照片，AI 會自動識別輪廓。只需輸入碗口直徑 + 碗高度兩個數值，誤差可望降至 ±3-5%
                                        </Text>
                                        
                                        {/* ① 拍攝側面照 */}
                                        <View style={{ marginBottom: 12 }}>
                                            <Text style={{ fontSize: 11, fontWeight: '700', color: '#1e40af', marginBottom: 4 }}>① 拍攝側面照</Text>
                                            {sideProfileImage ? (
                                                <View style={{ padding: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#3b82f6', borderRadius: 4, marginTop: 4 }}>
                                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                            <AppIcon name="check-circle" size={16} color="#059669" style={{ marginRight: 6 }} />
                                                            <Text style={{ fontSize: 11, color: '#059669' }}>側面照已拍攝</Text>
                                                        </View>
                                                        <Pressable onPress={() => { setSideProfileImage(null); setProfileAnalysisResult(null); }}>
                                                            <Text style={{ fontSize: 10, color: '#dc2626' }}>重新拍攝</Text>
                                                        </Pressable>
                                                    </View>
                                                </View>
                                            ) : (
                                                <Pressable
                                                    style={{ marginTop: 4, padding: 12, backgroundColor: '#3b82f6', borderRadius: 4, alignItems: 'center' }}
                                                    onPress={handleStartCaptureSideProfile}
                                                >
                                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                        <AppIcon name="camera-alt" size={18} color="#fff" style={{ marginRight: 6 }} />
                                                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>拍攝側面照</Text>
                                                    </View>
                                                </Pressable>
                                            )}
                                        </View>

                                        {/* ② 輸入碗口直徑 */}
                                        <View style={{ marginBottom: 12 }}>
                                            <Text style={{ fontSize: 11, fontWeight: '700', color: '#1e40af', marginBottom: 4 }}>② 輸入碗口直徑 (cm)</Text>
                                            <TextInput
                                                style={[styles.input, { height: 40 }]}
                                                value={rimDiameterCm}
                                                onChangeText={setRimDiameterCm}
                                                keyboardType="numeric"
                                                placeholder="例如: 12"
                                            />
                                            <Text style={{ fontSize: 10, color: '#1e3a8a', marginTop: 4 }}>
                                                請測量碗口最寬處的直徑（從一邊到另一邊）
                                            </Text>
                                        </View>

                                        {/* ③ 輸入碗高度 */}
                                        <View style={{ marginBottom: 12 }}>
                                            <Text style={{ fontSize: 11, fontWeight: '700', color: '#1e40af', marginBottom: 4 }}>③ 輸入碗高度 (cm)</Text>
                                            <TextInput
                                                style={[styles.input, { height: 40 }]}
                                                value={height}
                                                onChangeText={setHeight}
                                                keyboardType="numeric"
                                                placeholder="例如: 5"
                                            />
                                            <Text style={{ fontSize: 10, color: '#1e3a8a', marginTop: 4 }}>
                                                從碗內部最底部量到碗口邊緣的垂直高度
                                            </Text>
                                        </View>
                                        
                                        {/* ④（選填）俯視檢查照 */}
                                        <View style={{ marginBottom: 12 }}>
                                            <Text style={{ fontSize: 11, fontWeight: '700', color: '#1e40af', marginBottom: 4 }}>④（選填）拍攝俯視檢查照</Text>
                                            {topViewImage ? (
                                                <View style={{ padding: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#3b82f6', borderRadius: 4, marginTop: 4 }}>
                                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                            <AppIcon name="check-circle" size={16} color="#059669" style={{ marginRight: 6 }} />
                                                            <Text style={{ fontSize: 11, color: '#059669' }}>俯視檢查照已拍攝</Text>
                                                        </View>
                                                        <Pressable onPress={() => setTopViewImage(null)}>
                                                            <Text style={{ fontSize: 10, color: '#dc2626' }}>重新拍攝</Text>
                                                        </Pressable>
                                                    </View>
                                                    <Text style={{ fontSize: 10, color: '#1e3a8a', marginTop: 4 }}>
                                                        此照片目前主要用於檢查碗是否接近圓形，未來版本可用來進一步自動校正。
                                                    </Text>
                                                </View>
                                            ) : (
                                                <Pressable
                                                    style={{ marginTop: 4, padding: 12, backgroundColor: '#bfdbfe', borderRadius: 4, alignItems: 'center' }}
                                                    onPress={handleStartCaptureTopView}
                                                >
                                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                        <AppIcon name="camera-alt" size={18} color="#1e3a8a" style={{ marginRight: 6 }} />
                                                        <Text style={{ color: '#1e3a8a', fontSize: 12, fontWeight: '700' }}>從上方拍攝空碗（建議）</Text>
                                                    </View>
                                                </Pressable>
                                            )}
                                        </View>

                                        {/* ⑤ 計算輪廓 */}
                                        {sideProfileImage && rimDiameterCm && parseFloat(rimDiameterCm) > 0 && height && parseFloat(height) > 0 && !profileAnalysisResult && (
                                        <View style={{ marginBottom: 12 }}>
                                                <Text style={{ fontSize: 11, fontWeight: '700', color: '#1e40af', marginBottom: 4 }}>⑤ 計算輪廓</Text>
                                                <Pressable
                                                    style={{ padding: 12, backgroundColor: '#3b82f6', borderRadius: 4, alignItems: 'center' }}
                                                    onPress={handleAnalyzeSideProfile}
                                                    disabled={isAnalyzingProfile}
                                                >
                                                    {isAnalyzingProfile ? (
                                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                            <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                                                            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>AI 正在計算...</Text>
                                                        </View>
                                                    ) : (
                                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                            <AppIcon name="calculate" size={18} color="#fff" style={{ marginRight: 6 }} />
                                                            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>計算輪廓</Text>
                                                        </View>
                                                    )}
                                                </Pressable>
                                            </View>
                                        )}

                                        {/* ⑤ 計算結果顯示 */}
                                        {profileAnalysisResult && (
                                            <View style={{ marginBottom: 12 }}>
                                                <Text style={{ fontSize: 11, fontWeight: '700', color: '#1e40af', marginBottom: 4 }}>⑤ 計算結果</Text>
                                                <View style={{ padding: 12, backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#22c55e', borderRadius: 4 }}>
                                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                            <AppIcon name="check-circle" size={18} color="#059669" style={{ marginRight: 6 }} />
                                                            <Text style={{ fontSize: 12, fontWeight: '700', color: '#059669' }}>計算完成</Text>
                                                        </View>
                                                        <Pressable 
                                                            onPress={() => {
                                                                setProfileAnalysisResult(null);
                                                            }}
                                                            style={{ padding: 4 }}
                                                        >
                                                            <Text style={{ fontSize: 10, color: '#dc2626' }}>重新計算</Text>
                                                        </Pressable>
                                                    </View>
                                                    <View style={{ backgroundColor: '#fff', padding: 8, borderRadius: 4, marginBottom: 4 }}>
                                                        <Text style={{ fontSize: 11, color: '#166534', marginBottom: 4 }}>
                                                            <Text style={{ fontWeight: '700' }}>輪廓點數：</Text>{profileAnalysisResult.contour?.points?.length || 0} 個
                                                        </Text>
                                                        <Text style={{ fontSize: 11, color: '#166534', marginBottom: 4 }}>
                                                            <Text style={{ fontWeight: '700' }}>AI 信心度：</Text>{((profileAnalysisResult.confidence || 0) * 100).toFixed(1)}%
                                                        </Text>
                                                        <Text style={{ fontSize: 11, color: '#166534' }}>
                                                            <Text style={{ fontWeight: '700' }}>預估總容量：</Text>{Math.round(profileAnalysisResult.estimatedVolumeMl || 0)}ml
                                                        </Text>
                                                    </View>
                                                    {(() => {
                                                        const calculatedVolume = calculateTotalVolumeFromContour(profileAnalysisResult.contour);
                                                        const cylVol = rimDiameterCm && height && parseFloat(rimDiameterCm) > 0 && parseFloat(height) > 0
                                                            ? Math.PI * Math.pow(parseFloat(rimDiameterCm) / 2, 2) * parseFloat(height)
                                                            : 0;
                                                        return (
                                                            <>
                                                                <View style={{ backgroundColor: '#dbeafe', padding: 8, borderRadius: 4, marginBottom: 4 }}>
                                                                    <Text style={{ fontSize: 11, color: '#1e40af', fontWeight: '700', marginBottom: 2 }}>
                                                                        輪廓計算容量：
                                                                    </Text>
                                                                    <Text style={{ fontSize: 14, color: '#1e3a8a', fontWeight: '700' }}>
                                                                        {Math.round(calculatedVolume)}ml
                                                                    </Text>
                                                                </View>
                                                                {cylVol > 0 && (
                                                                    <View style={{ backgroundColor: '#f3f4f6', padding: 6, borderRadius: 4 }}>
                                                                        <Text style={{ fontSize: 10, color: '#4b5563' }}>
                                                                            同尺寸圓柱近似：{Math.round(cylVol)}ml（僅供比對；若輪廓值遠小於此，建議改用「已知容量」或重拍）
                                                                        </Text>
                                                                    </View>
                                                                )}
                                                            </>
                                                        );
                                                    })()}
                                                </View>
                                            </View>
                                        )}

                                        {/* 拍攝提示 */}
                                        <View style={{ marginTop: 12, padding: 8, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 4 }}>
                                            <Text style={{ fontSize: 10, color: '#4b5563', fontWeight: '700', marginBottom: 4 }}>📸 拍攝提示：</Text>
                                            <Text style={{ fontSize: 10, color: '#6b7280', lineHeight: 14 }}>
                                                • 從正側面拍攝（與碗垂直）{'\n'}
                                                • 確保碗口清晰可見{'\n'}
                                                • 建議白色背景，光線充足{'\n'}
                                                • 碗內必須是空的
                                            </Text>
                                        </View>
                                    </View>
                                </>
                            ) : inputMethod === 'volume' ? (
                                <View style={styles.formGroup}>
                                    <Text style={styles.formLabel}>已知容量 (ml)</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={knownVolumeMl}
                                        onChangeText={setKnownVolumeMl}
                                        keyboardType="numeric"
                                        placeholder="例如: 2000 (2公升)"
                                    />
                                    <Text style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                                        請輸入容器標示的容量（毫升）。例如：2L = 2000ml
                                    </Text>
                                    <Text style={{ fontSize: 10, color: '#666', marginTop: 4, fontStyle: 'italic' }}>
                                        💡 提示：如果實際測量的容量與計算結果有 10-15% 差異，這是正常的幾何計算誤差（實際容器形狀不完全規則）
                                    </Text>
                                    {knownVolumeMl && parseFloat(knownVolumeMl) > 0 && shape === 'cylinder' && height && parseFloat(height) > 0 && (
                                        <View style={{ marginTop: 8, padding: 8, backgroundColor: '#e0f2fe', borderWidth: 1, borderColor: '#0284c7', borderRadius: 4 }}>
                                            <Text style={{ fontSize: 11, color: '#0c4a6e', fontWeight: '700', marginBottom: 4 }}>
                                                💡 參考尺寸（基於已知容量）：
                                            </Text>
                                            <Text style={{ fontSize: 10, color: '#075985', lineHeight: 16 }}>
                                                如果容量是 {knownVolumeMl}ml，高度是 {height}cm，{'\n'}
                                                合理的內徑應該是：{Math.sqrt(parseFloat(knownVolumeMl) / (Math.PI * parseFloat(height))) * 2}cm
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            ) : (
                                <>
                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>高度 (cm)</Text>
                                <TextInput
                                    style={styles.input}
                                    value={height}
                                    onChangeText={setHeight}
                                    keyboardType="numeric"
                                    placeholder="例如: 5"
                                />
                                <Text style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                                    一般食碗高度約 3-8cm
                                </Text>
                            </View>

                            {shape === 'cylinder' && (
                                <View style={styles.formGroup}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                        <Text style={styles.formLabel}>直徑 (cm)</Text>
                                        {radius && height && parseFloat(radius) > 0 && parseFloat(height) > 0 && (() => {
                                            const calculatedVol = calculateVesselVolume({
                                                id: '',
                                                name: '',
                                                shape: 'cylinder',
                                                dimensions: {
                                                    height: parseFloat(height),
                                                    radius: parseFloat(radius),
                                                },
                                            }) || 0;
                                            const radiusVal = parseFloat(radius);
                                            const heightVal = parseFloat(height);
                                            const actualRadius = radiusVal / 2;
                                            return (
                                                <View>
                                                    <Text style={{ fontSize: 11, color: '#666' }}>
                                                        預估體積: {Math.round(calculatedVol)}ml
                                                    </Text>
                                                    <Text style={{ fontSize: 10, color: '#999', marginTop: 2 }}>
                                                        計算：直徑 {radiusVal}cm → 半徑 {actualRadius.toFixed(1)}cm → π × {actualRadius.toFixed(1)}² × {heightVal} = {Math.round(calculatedVol)}ml
                                                    </Text>
                                                </View>
                                            );
                                        })()}
                                    </View>
                                    <TextInput
                                        style={styles.input}
                                        value={radius}
                                        onChangeText={setRadius}
                                        keyboardType="numeric"
                                        placeholder="例如: 12"
                                    />
                                    <Text style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                                        請測量食碗最寬處的直徑（從一邊到另一邊）。一般食碗直徑約 10-24cm
                                    </Text>
                                    <Text style={{ fontSize: 11, color: '#ef4444', marginTop: 4, fontWeight: '700' }}>
                                        ⚠️ 重要：請測量「內徑」（內部有效容量），而非外徑。飲水機等容器請優先使用「已知容量」輸入方式。
                                    </Text>
                                    {knownVolumeMl && parseFloat(knownVolumeMl) > 0 && radius && height && parseFloat(radius) > 0 && parseFloat(height) > 0 && (() => {
                                        const inputVol = calculateVesselVolume({
                                            id: '',
                                            name: '',
                                            shape: 'cylinder',
                                            dimensions: { height: parseFloat(height), radius: parseFloat(radius) },
                                        }) || 0;
                                        const knownVol = parseFloat(knownVolumeMl);
                                        const diffPercent = Math.abs((inputVol - knownVol) / knownVol * 100);
                                        const correctDiameter = Math.sqrt(knownVol / (Math.PI * parseFloat(height))) * 2;
                                        if (diffPercent > 30) {
                                            return (
                                                <View style={{ marginTop: 8, padding: 8, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#dc2626', borderRadius: 4 }}>
                                                    <Text style={{ fontSize: 11, color: '#991b1b', fontWeight: '700', marginBottom: 4 }}>
                                                        ⚠️ 輸入值與已知容量差異過大
                                                    </Text>
                                                    <Text style={{ fontSize: 10, color: '#7f1d1d', lineHeight: 16 }}>
                                                        已知容量：{knownVol}ml{'\n'}
                                                        計算結果：{Math.round(inputVol)}ml{'\n'}
                                                        差異：{diffPercent.toFixed(1)}%{'\n'}
                                                        建議內徑：{correctDiameter.toFixed(1)}cm（目前輸入：{radius}cm）
                                                    </Text>
                                                </View>
                                            );
                                        }
                                        return null;
                                    })()}
                                </View>
                            )}

                            {shape === 'sphere' && (
                                <>
                                    <View style={styles.formGroup}>
                                        <Text style={styles.formLabel}>頂直徑 (cm)</Text>
                                        <TextInput
                                            style={styles.input}
                                            value={topRadius}
                                            onChangeText={setTopRadius}
                                            keyboardType="numeric"
                                            placeholder="例如: 14"
                                        />
                                        <Text style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                                            請測量食碗頂部最寬處的直徑
                                        </Text>
                                    </View>
                                    <View style={styles.formGroup}>
                                        <Text style={styles.formLabel}>底直徑 (cm, 尖底可為 0)</Text>
                                        <TextInput
                                            style={styles.input}
                                            value={bottomRadius}
                                            onChangeText={setBottomRadius}
                                            keyboardType="numeric"
                                            placeholder="例如: 0 或 4"
                                        />
                                        <Text style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                                            請測量食碗底部最寬處的直徑（尖底碗可輸入 0）
                                        </Text>
                                    </View>
                                </>
                            )}

                            {shape === 'trapezoid' && (
                                <>
                                    <View style={styles.formGroup}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                            <Text style={styles.formLabel}>長度 (cm)</Text>
                                            {length && width && height && parseFloat(length) > 0 && parseFloat(width) > 0 && parseFloat(height) > 0 && (
                                                <Text style={{ fontSize: 11, color: '#666' }}>
                                                    預估體積: {Math.round(parseFloat(length) * parseFloat(width) * parseFloat(height))}ml
                                                </Text>
                                            )}
                                        </View>
                                        <TextInput
                                            style={styles.input}
                                            value={length}
                                            onChangeText={setLength}
                                            keyboardType="numeric"
                                            placeholder="例如: 12"
                                        />
                                    </View>
                                    <View style={styles.formGroup}>
                                        <Text style={styles.formLabel}>寬度 (cm)</Text>
                                        <TextInput
                                            style={styles.input}
                                            value={width}
                                            onChangeText={setWidth}
                                            keyboardType="numeric"
                                            placeholder="例如: 10"
                                        />
                                    </View>
                                    <Text style={{ fontSize: 11, color: '#666', marginTop: -8, marginBottom: 8 }}>
                                        一般食碗長寬約 10-25cm
                                    </Text>
                                </>
                            )}
                                </>
                            )}

                            <View style={{ marginTop: 24, padding: 12, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 4 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}><AppIcon name="lightbulb" size={14} color="#4b5563" style={{ marginRight: 4 }} /><Text style={{ fontSize: 13, fontWeight: '700', color: '#4b5563' }}>測量小秘訣</Text></View>
                                <Text style={{ fontSize: 11, color: '#4b5563', lineHeight: 16, marginBottom: 12 }}>
                                    {inputMethod === 'dimensions' 
                                        ? '精確的直徑與高度能讓 AI 換算更精準。若手邊沒有尺，可以使用 iOS 內建的「測距儀」協助。'
                                        : '如果容器標示了容量（如 2L、2000ml），建議直接輸入已知容量，比測量尺寸更準確。'}
                                </Text>
                                {inputMethod === 'dimensions' && (
                                    <Pressable
                                        style={{ padding: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#000', borderRadius: 4, alignItems: 'center' }}
                                        onPress={handleOpenMeasure}
                                    >
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}><AppIcon name="straighten" size={14} color="#000" style={{ marginRight: 4 }} /><Text style={{ fontSize: 12, fontWeight: '700' }}>開啟「測距儀」App</Text></View>
                                    </Pressable>
                                )}
                            </View>

                            {/* 空碗俯視照（測量尺寸、已知容量時可拍攝，作為飲食記錄校準參考） */}
                            {(inputMethod === 'dimensions' || inputMethod === 'volume') && (
                                <View style={{ marginTop: 20, marginBottom: 8 }}>
                                    <Text style={styles.formLabel}>空碗俯視照（選填，校準參考）</Text>
                                    <Text style={{ fontSize: 11, color: '#666', marginBottom: 8 }}>
                                        從上方拍攝空碗，供飲食記錄時 T0/T1 碗位比對使用。
                                    </Text>
                                    {topViewImage ? (
                                        <View style={{ padding: 12, backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#22c55e', borderRadius: 4 }}>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                    <AppIcon name="check-circle" size={18} color="#166534" style={{ marginRight: 6 }} />
                                                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#166534' }}>已快取俯視照</Text>
                                                </View>
                                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                                    <Pressable
                                                        onPress={handleStartCaptureTopView}
                                                        style={{ padding: 4, borderWidth: 1, borderRadius: 4, borderColor: '#166534' }}
                                                    >
                                                        <Text style={{ fontSize: 10, color: '#166534' }}>重新拍攝</Text>
                                                    </Pressable>
                                                    <Pressable
                                                        onPress={() => setTopViewImage(null)}
                                                        style={{ padding: 4, borderWidth: 1, borderRadius: 4, borderColor: '#dc2626' }}
                                                    >
                                                        <Text style={{ fontSize: 10, color: '#dc2626' }}>刪除</Text>
                                                    </Pressable>
                                                </View>
                                            </View>
                                        </View>
                                    ) : (
                                        <Pressable
                                            style={{ padding: 12, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#3b82f6', borderRadius: 4, alignItems: 'center' }}
                                            onPress={handleStartCaptureTopView}
                                        >
                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                <AppIcon name="camera-alt" size={18} color="#1e40af" style={{ marginRight: 6 }} />
                                                <Text style={{ color: '#1e40af', fontSize: 12, fontWeight: '700' }}>拍攝空碗俯視照</Text>
                                            </View>
                                        </Pressable>
                                    )}
                                </View>
                            )}

                            <View style={{ marginTop: 24 }}>
                                <Pressable style={styles.primaryBtn} onPress={handleSaveProfile}>
                                    <Text style={styles.primaryBtnText}>儲存設定</Text>
                                </Pressable>
                            </View>
                        </ScrollView>
                        )}
                    </View>
                </SafeAreaView>
            </Modal>
        );
    }

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
            <SafeAreaView style={styles.modalBackdrop}>
                <View style={styles.modalCard}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>食碗管理 (收藏夾)</Text>
                        <Pressable onPress={onClose}><Text style={styles.closeText}>×</Text></Pressable>
                    </View>
                    <ScrollView style={styles.modalBody}>
                        <View style={{ marginBottom: 16 }}>
                            <Text style={styles.infoTitle}>已儲存的食碗</Text>
                            {profiles.length === 0 && (
                                <Text style={{ fontSize: 13, color: '#666', textAlign: 'center', marginVertical: 20 }}>
                                    尚未建立任何食碗設定。
                                </Text>
                            )}
                            {profiles.map(p => {
                                // 確保顯示的是正確計算的體積
                                const correctedVessel = recalculateVesselVolume(p);
                                const displayVolume = correctedVessel.volumeMl || 0;
                                // 顯示輸入值詳情（用於調試）
                                const dimensionsInfo = p.shape === 'cylinder' && p.dimensions.radius 
                                    ? ` (直徑${p.dimensions.radius}cm, 高${p.dimensions.height}cm)`
                                    : p.shape === 'sphere' && p.dimensions.topRadius
                                    ? ` (頂${p.dimensions.topRadius}cm, 底${p.dimensions.bottomRadius || 0}cm, 高${p.dimensions.height}cm)`
                                    : '';
                                const typeLabel = p.vesselType === 'hydration' ? '水碗' : '食碗';
                                return (
                                <View key={p.id} style={[styles.recordItem, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                                    <View style={{ flex: 1 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                                            <Text style={styles.recordTitle}>{p.name}</Text>
                                            <View style={{ marginLeft: 8, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: p.vesselType === 'hydration' ? '#dbeafe' : '#fef3c7', borderRadius: 4 }}>
                                                <Text style={{ fontSize: 10, fontWeight: '700', color: p.vesselType === 'hydration' ? '#1e40af' : '#92400e' }}>{typeLabel}</Text>
                                            </View>
                                        </View>
                                        <Text style={{ fontSize: 11, color: '#666' }}>
                                            {p.shape === 'cylinder' ? '圓柱' : p.shape === 'trapezoid' ? '梯形' : '球形'} |
                                            約 {Math.round(displayVolume)}ml
                                            {displayVolume > 5000 && <Text style={{ color: '#ef4444', fontWeight: '700' }}> ⚠️異常</Text>}
                                        </Text>
                                        {dimensionsInfo && (
                                            <Text style={{ fontSize: 9, color: '#999', marginTop: 2 }}>
                                                輸入值{dimensionsInfo}
                                            </Text>
                                        )}
                                    </View>
                                    <View style={{ flexDirection: 'row' }}>
                                        <Pressable onPress={() => openForm(p)} style={{ marginRight: 12 }}>
                                            <Text style={{ color: '#000', fontSize: 12 }}>編輯</Text>
                                        </Pressable>
                                        <Pressable onPress={() => handleDelete(p.id)}>
                                            <Text style={{ color: '#ef4444', fontSize: 12 }}>刪除</Text>
                                        </Pressable>
                                    </View>
                                </View>
                                );
                            })}
                        </View>

                        <Pressable style={styles.primaryBtn} onPress={() => openForm(null)}>
                            <Text style={styles.primaryBtnText}>+ 新增食碗／水碗</Text>
                        </Pressable>
                    </ScrollView>
                </View>
            </SafeAreaView>
        </Modal>
    );
}
