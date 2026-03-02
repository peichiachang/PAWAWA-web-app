import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Image, Text, Pressable, PanResponder, StyleSheet, SafeAreaView } from 'react-native';

/** 標記結果：含百分比與像素 Y 座標（供純數學計算） */
export type WaterLevelMarkResult = {
  waterLevelPct: number;
  rimPct: number;
  bottomPct: number;
  waterPct: number;
  /** 像素 Y 座標，供純數學計算（不碰照片、不碰 AI） */
  bowl_top_y: number;
  bowl_bottom_y: number;
  water_y: number;
  image_height: number;
};

interface Props {
  imageUri: string;
  onConfirm: (result: WaterLevelMarkResult) => void;
  onCancel: () => void;
}

/**
 * 計算 resizeMode="contain" 時，圖片在容器內的實際顯示區域
 */
function getContainedImageRect(containerW: number, containerH: number, imgW: number, imgH: number) {
  if (imgW <= 0 || imgH <= 0) return { x: 0, y: 0, width: containerW, height: containerH };
  const scale = Math.min(containerW / imgW, containerH / imgH);
  const width = imgW * scale;
  const height = imgH * scale;
  const x = (containerW - width) / 2;
  const y = (containerH - height) / 2;
  return { x, y, width, height };
}

/**
 * 依 rim、bottom、water 三點計算 waterLevelPct
 * waterLevelPct=0 表示滿（水面在碗口），1 表示空（水面在碗底）
 */
function calcWaterLevelPct(rimPct: number, bottomPct: number, waterPct: number): number {
  const top = Math.min(rimPct, bottomPct);
  const bottom = Math.max(rimPct, bottomPct);
  if (bottom - top < 0.02) return 0.5; //  degenerate
  return Math.max(0, Math.min(1, (waterPct - top) / (bottom - top)));
}

type LineType = 'rim' | 'bottom' | 'water';

const LINE_CONFIG: Record<LineType, { label: string; color: string; bgColor: string }> = {
  rim: { label: '碗口', color: '#22c55e', bgColor: '#166534' },
  bottom: { label: '碗底', color: '#f97316', bgColor: '#c2410c' },
  water: { label: '水面', color: '#3b82f6', bgColor: '#1d4ed8' },
};

export function WaterLevelMarker({ imageUri, onConfirm, onCancel }: Props) {
  const [rimY, setRimY] = useState(0.15);
  const [bottomY, setBottomY] = useState(0.85);
  const [waterY, setWaterY] = useState(0.5);
  const refs = useRef({ rimY: 0.15, bottomY: 0.85, waterY: 0.5 });
  refs.current = { rimY, bottomY, waterY };

  const [imageRect, setImageRect] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const containerLayoutRef = useRef({ width: 0, height: 0 });
  const imageSizeRef = useRef({ width: 0, height: 0 });
  const displayRectRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const containerScreenYRef = useRef(0);
  const containerRef = useRef<View | null>(null);
  const activeLineRef = useRef<LineType | null>(null);
  const startYRef = useRef(0);

  const updateImageRect = useCallback(() => {
    const { width: cw, height: ch } = containerLayoutRef.current;
    const { width: iw, height: ih } = imageSizeRef.current;
    if (cw > 0 && ch > 0 && iw > 0 && ih > 0) {
      const rect = getContainedImageRect(cw, ch, iw, ih);
      displayRectRef.current = rect;
      setImageRect(rect);
    }
  }, []);

  useEffect(() => {
    Image.getSize(imageUri, (w, h) => {
      imageSizeRef.current = { width: w, height: h };
      updateImageRect();
    });
  }, [imageUri, updateImageRect]);

  const getLineY = (type: LineType) => (type === 'rim' ? rimY : type === 'bottom' ? bottomY : waterY);
  const setLineY = (type: LineType, v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    if (type === 'rim') setRimY(clamped);
    else if (type === 'bottom') setBottomY(clamped);
    else setWaterY(clamped);
  };

  const findNearestLine = (pageY: number): LineType | null => {
    const touchY = pageY - containerScreenYRef.current;
    const rect = displayRectRef.current;
    if (rect.height <= 0) return null;
    const rimPos = rect.y + rimY * rect.height;
    const bottomPos = rect.y + bottomY * rect.height;
    const waterPos = rect.y + waterY * rect.height;
    const threshold = 40;
    const dist = (a: number) => Math.abs(touchY - a);
    const dRim = dist(rimPos);
    const dBottom = dist(bottomPos);
    const dWater = dist(waterPos);
    const min = Math.min(dRim, dBottom, dWater);
    if (min > threshold) return null;
    if (dRim === min) return 'rim';
    if (dBottom === min) return 'bottom';
    return 'water';
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const pageY = evt.nativeEvent.pageY;
        const line = findNearestLine(pageY);
        activeLineRef.current = line;
        if (line) startYRef.current = refs.current[line === 'rim' ? 'rimY' : line === 'bottom' ? 'bottomY' : 'waterY'];
      },
      onPanResponderMove: (_evt, gestureState) => {
        const line = activeLineRef.current;
        const rect = displayRectRef.current;
        if (!line || rect.height <= 0) return;
        const deltaPct = gestureState.dy / rect.height;
        const newY = Math.max(0, Math.min(1, startYRef.current + deltaPct));
        setLineY(line, newY);
      },
      onPanResponderRelease: () => {
        activeLineRef.current = null;
      },
    })
  ).current;

  const handleConfirm = () => {
    const waterLevelPct = calcWaterLevelPct(rimY, bottomY, waterY);
    const imgH = imageSizeRef.current.height || 1;

    onConfirm({
      waterLevelPct,
      rimPct: rimY,
      bottomPct: bottomY,
      waterPct: waterY,
      bowl_top_y: Math.round(rimY * imgH),
      bowl_bottom_y: Math.round(bottomY * imgH),
      water_y: Math.round(waterY * imgH),
      image_height: imgH,
    });
  };

  const renderLine = (type: LineType) => {
    const y = getLineY(type);
    const cfg = LINE_CONFIG[type];
    const top = imageRect.height > 0 ? imageRect.y + y * imageRect.height : y * 100;
    const topStyle = imageRect.height > 0 ? { top } : { top: `${y * 100}%` as unknown as number };

    return (
      <View key={type} style={[styles.markerLineContainer, topStyle]} pointerEvents="none">
        <View style={styles.markerHitArea}>
          <View style={[styles.markerLine, { backgroundColor: cfg.color, shadowColor: cfg.color }]} />
          <View style={[styles.markerHandle, { backgroundColor: cfg.bgColor }]}>
            <Text style={styles.markerHandleText}>{cfg.label}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>標記水位</Text>
        <Text style={styles.subtitle}>拖曳三條線分別對齊碗口、碗底、水面</Text>
      </View>

      <View
        ref={containerRef}
        style={styles.imageContainer}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          containerLayoutRef.current = { width, height };
          updateImageRect();
          containerRef.current?.measureInWindow((_x, y) => { containerScreenYRef.current = y; });
        }}
      >
        <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />

        <View style={styles.gridOverlay} pointerEvents="none">
          <View style={styles.gridLineHorizontal} />
          <View style={styles.gridLineHorizontal} />
          <View style={styles.gridLineVertical} />
          <View style={styles.gridLineVertical} />
        </View>

        {/* 透明觸控層：點擊靠近某線時拖曳該線 */}
        <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers} />

        {renderLine('rim')}
        {renderLine('bottom')}
        {renderLine('water')}
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#22c55e' }]} />
          <Text style={styles.legendText}>碗口</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#f97316' }]} />
          <Text style={styles.legendText}>碗底</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#3b82f6' }]} />
          <Text style={styles.legendText}>水面</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Pressable style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelBtnText}>重拍</Text>
        </Pressable>
        <Pressable style={styles.confirmBtn} onPress={handleConfirm}>
          <Text style={styles.confirmBtnText}>確認標記</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { padding: 20, alignItems: 'center' },
  title: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  subtitle: { color: '#ddd', fontSize: 14 },
  imageContainer: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111',
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
  gridLineHorizontal: {
    position: 'absolute',
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  gridLineVertical: {
    height: '100%',
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  markerLineContainer: {
    position: 'absolute',
    width: '100%',
    height: 56,
    marginTop: -28,
    justifyContent: 'center',
    zIndex: 10,
  },
  markerHitArea: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  markerLine: {
    width: '100%',
    height: 3,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  markerHandle: {
    position: 'absolute',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fff',
  },
  markerHandleText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    paddingVertical: 12,
    backgroundColor: '#111',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: '#ddd', fontSize: 12 },
  footer: {
    flexDirection: 'row',
    padding: 24,
    gap: 16,
    paddingBottom: 48,
  },
  cancelBtn: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
  },
  cancelBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  confirmBtn: {
    flex: 2,
    backgroundColor: '#3b82f6',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
