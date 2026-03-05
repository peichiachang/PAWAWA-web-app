import React, { useState, useEffect } from 'react';
import { Modal, SafeAreaView, ScrollView, Text, View, Pressable, Alert } from 'react-native';
import { CustomCamera } from '../CustomCamera';
import { WaterLevelMarker } from '../WaterLevelMarker';
import { CapturedImage } from '../../types/app';
import type { WaterLevelMarkResult } from '../WaterLevelMarker';
import { styles } from '../../styles/common';

/** 滿量基準校準：水碗用 volumeMl，食碗用 portionGrams 作為滿量參考值 */
interface Props {
  visible: boolean;
  /** 水碗為 ml，食碗為 g（僅顯示用） */
  volumeMl: number;
  vesselName: string;
  onClose: () => void;
  onComplete: (calibration: {
    fullY: number;
    bottomY: number;
    topY: number;
    imageHeight: number;
    calibratedAt: number;
    imageBase64?: string;
  }) => void;
  /** 水碗：滿水基準；食碗：滿碗基準。文案與單位依此切換 */
  calibrationType?: 'water' | 'food';
}

export function FullWaterCalibrationModal({ visible, volumeMl, vesselName, onClose, onComplete, calibrationType = 'water' }: Props) {
  const isFood = calibrationType === 'food';
  const step1Line1 = '① 請先將容器裝到滿的狀態';
  const step1Line3 = '③ 系統將以此作為容量上限的對應基準';
  const warnText = '⚠️ 請確認是裝到滿再拍照';
  const confirmSubtitle = isFood
    ? '水位／食物線：目前的位置（滿的狀態）'
    : '水位線：目前的水面位置（滿的狀態）';
  const completeDesc = isFood
    ? '之後每次記錄 T0 和 T1，系統會依此換算並計算差值。'
    : '之後每次記錄 W0 和 W1，系統會自動換算水量並計算差值。';
  const [step, setStep] = useState<'intro' | 'camera' | 'marking' | 'confirm'>('intro');
  const [capturedImage, setCapturedImage] = useState<CapturedImage | null>(null);
  const [markResult, setMarkResult] = useState<WaterLevelMarkResult | null>(null);

  // 當 Modal 關閉時重置狀態
  useEffect(() => {
    if (!visible) {
      setStep('intro');
      setCapturedImage(null);
      setMarkResult(null);
    }
  }, [visible]);

  function handleStartCalibration() {
    setStep('camera');
  }

  function handleCapture(image: CapturedImage) {
    setCapturedImage(image);
    setStep('marking');
  }

  function handleMarkConfirm(result: WaterLevelMarkResult) {
    setMarkResult(result);
    setStep('confirm');
  }

  function handleComplete() {
    if (!capturedImage || !markResult) return;
    
    onComplete({
      fullY: markResult.water_y, // 滿水時的水位線
      bottomY: markResult.bowl_bottom_y,
      topY: markResult.bowl_top_y,
      imageHeight: markResult.image_height,
      calibratedAt: Date.now(),
      imageBase64: capturedImage.imageBase64,
    });
    
    // 重置狀態
    setStep('intro');
    setCapturedImage(null);
    setMarkResult(null);
    onClose();
  }

  function handleCancel() {
    if (step === 'intro') {
      onClose();
    } else {
      Alert.alert('取消校準', '確定要取消滿量基準校準嗎？', [
        { text: '繼續校準', style: 'cancel' },
        { text: '取消', onPress: () => {
          setStep('intro');
          setCapturedImage(null);
          setMarkResult(null);
          onClose();
        }}
      ]);
    }
  }

  if (!visible) return null;

  // Step 1: 說明頁
  if (step === 'intro') {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
        <SafeAreaView style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>設定滿量基準</Text>
              <Pressable onPress={handleCancel}><Text style={styles.closeText}>×</Text></Pressable>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={{ fontSize: 14, marginBottom: 16, lineHeight: 22 }}>只需要做一次。</Text>

              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 14, marginBottom: 8 }}>{step1Line1}</Text>
                <Text style={{ fontSize: 14, marginBottom: 8 }}>② 拍照標記三條線</Text>
                <Text style={{ fontSize: 14 }}>{step1Line3}</Text>
              </View>

              <View style={[styles.infoBox, { marginBottom: 16, borderColor: '#f59e0b', backgroundColor: '#fef3c7' }]}>
                <Text style={{ fontWeight: '700', marginBottom: 4, color: '#92400e' }}>{warnText}</Text>
              </View>

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
                <Pressable style={[styles.choiceBtn, { flex: 1 }]} onPress={handleCancel}>
                  <Text style={styles.choiceBtnText}>取消</Text>
                </Pressable>
                <Pressable style={[styles.primaryBtn, { flex: 2 }]} onPress={handleStartCalibration}>
                  <Text style={styles.primaryBtnText}>開始拍照</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  // Step 2: 拍照
  if (step === 'camera') {
    return (
      <CustomCamera
        title="設定滿量基準"
        onCapture={handleCapture}
        onCancel={handleCancel}
        customOptions={{
          showGuide: true,
          guideShape: 'square',
          guideText: '請將水位觀察窗或碗口完整置於方框內',
        }}
      />
    );
  }

  // Step 3: 標記
  if (step === 'marking' && capturedImage) {
    return (
      <WaterLevelMarker
        imageUri={capturedImage.uri}
        onConfirm={handleMarkConfirm}
        onCancel={handleCancel}
        title="設定滿量基準"
        subtitle={`請拖曳三條線分別對齊：\n• 頂線：觀察窗或碗口的上緣\n• 底線：觀察窗或碗的底部\n• ${confirmSubtitle}`}
      />
    );
  }

  // Step 4: 完成頁
  if (step === 'confirm' && markResult) {
    const calibratedAtStr = new Date(markResult ? Date.now() : 0).toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
        <SafeAreaView style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>✅ 滿量基準設定完成</Text>
            </View>
            <ScrollView style={styles.modalBody}>
              <View style={{ marginBottom: 24 }}>
                <Text style={{ fontSize: 14, color: '#666' }}>設定時間：{calibratedAtStr}</Text>
              </View>

              <View style={[styles.infoBox, { marginBottom: 24 }]}>
                <Text style={{ fontSize: 14, lineHeight: 22 }}>
                  {completeDesc}
                </Text>
              </View>

              <Pressable style={styles.primaryBtn} onPress={handleComplete}>
                <Text style={styles.primaryBtnText}>完成</Text>
              </Pressable>
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  return null;
}
