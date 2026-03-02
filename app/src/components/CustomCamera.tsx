import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions, SafeAreaView, ActivityIndicator, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LightSensor } from 'expo-sensors';
import { CapturedImage } from '../types/app';
import { AppIcon } from './AppIcon';
import { pickFromCamera, pickFromLibrary } from '../utils/camera';

/** 相機客製化選項，各 Modal 可依情境傳入 */
export interface CameraCustomOptions {
    /** 照片品質 0–1，預設 0.3 */
    quality?: number;
    /** 是否顯示對焦框與引導文字，預設 true */
    showGuide?: boolean;
    /** 引導文字，預設「請將目標物放置於框內中心」 */
    guideText?: string;
    /** 是否顯示縮放控制，預設 true */
    showZoom?: boolean;
    /** 是否顯示前後鏡頭切換，預設 false */
    showFlipButton?: boolean;
    /** 初始鏡頭，預設 'back' */
    initialCameraType?: 'front' | 'back';
    /** 是否顯示光線過暗警告，預設 true */
    showLightWarning?: boolean;
}

interface Props {
    title?: string;
    onCapture: (image: CapturedImage) => void;
    onCancel: () => void;
    /** 部分相機客製化選項 */
    customOptions?: CameraCustomOptions;
}

const MIN_LUX_REQUIRED = 50; // Threshold for low light warning

const DEFAULT_OPTIONS: Required<CameraCustomOptions> = {
    quality: 0.3,
    showGuide: true,
    guideText: '請將目標物放置於框內中心',
    showZoom: true,
    showFlipButton: false,
    initialCameraType: 'back',
    showLightWarning: true,
};

export function CustomCamera({ title, onCapture, onCancel, customOptions }: Props) {
    const opts = { ...DEFAULT_OPTIONS, ...customOptions };
    const isWeb = Platform.OS === 'web';
    const [permission, requestPermission] = useCameraPermissions();
    const [illuminance, setIlluminance] = useState<number>(100);
    const [isProcessing, setIsProcessing] = useState(false);
    const [cameraType, setCameraType] = useState<'front' | 'back'>(opts.initialCameraType);
    const [zoom, setZoom] = useState(0);
    const cameraRef = useRef<CameraView>(null);

    useEffect(() => {
        console.log('[CustomCamera] Component mounted');
        return () => console.log('[CustomCamera] Component unmounted');
    }, []);

    useEffect(() => {
        if (isWeb) return;
        let subscription: any;
        LightSensor.isAvailableAsync().then((available) => {
            if (available) {
                LightSensor.setUpdateInterval(500);
                subscription = LightSensor.addListener((data) => {
                    setIlluminance(data.illuminance);
                });
            }
        });
        return () => {
            if (subscription) subscription.remove();
        };
    }, [isWeb]);

    const handlePickImage = async () => {
        if (isProcessing) return;
        setIsProcessing(true);
        try {
            const image = await pickFromLibrary();
            if (image) {
                onCapture(image);
            }
        } finally {
            setIsProcessing(false);
        }
    };

    const handleTakePhoto = async () => {
        if (isProcessing) return;
        setIsProcessing(true);
        try {
            const image = await pickFromCamera();
            if (image) {
                onCapture(image);
            }
        } finally {
            setIsProcessing(false);
        }
    };

    if (isWeb) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={[styles.permissionContainer, { paddingHorizontal: 24 }]}>
                    <Text style={[styles.title, { textAlign: 'center', marginBottom: 16, flex: 0, paddingRight: 0 }]}>
                        {title || '上傳圖片'}
                    </Text>
                    <Text style={[styles.permissionText, { textAlign: 'center', marginBottom: 20 }]}>
                        Web 版支援直接拍照或上傳既有圖片
                    </Text>
                    <Pressable style={[styles.permissionBtn, { marginBottom: 10 }]} onPress={handleTakePhoto} disabled={isProcessing}>
                        {isProcessing ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.permissionBtnText}>拍照</Text>
                        )}
                    </Pressable>
                    <Pressable style={styles.permissionBtn} onPress={handlePickImage} disabled={isProcessing}>
                        {isProcessing ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.permissionBtnText}>上傳圖片</Text>
                        )}
                    </Pressable>
                    <Pressable style={[styles.permissionBtn, { backgroundColor: '#666', marginTop: 12 }]} onPress={onCancel}>
                        <Text style={styles.permissionBtnText}>取消</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        );
    }

    if (!permission) {
        return (
            <View style={styles.permissionContainer}>
                <ActivityIndicator size="large" color="#ffffff" />
                <Text style={[styles.permissionText, { marginTop: 16 }]}>正在初始化相機...</Text>
            </View>
        );
    }

    if (!permission.granted) {
        return (
            <View style={styles.permissionContainer}>
                <Text style={styles.permissionText}>需要相機權限才能拍攝</Text>
                <Pressable style={styles.permissionBtn} onPress={requestPermission}>
                    <Text style={styles.permissionBtnText}>賦予權限</Text>
                </Pressable>
                <Pressable style={[styles.permissionBtn, { backgroundColor: '#666', marginTop: 12 }]} onPress={onCancel}>
                    <Text style={styles.permissionBtnText}>取消</Text>
                </Pressable>
            </View>
        );
    }

    const handleCapture = async () => {
        if (cameraRef.current && !isProcessing) {
            setIsProcessing(true);
            try {
                const photo = await cameraRef.current.takePictureAsync({
                    quality: opts.quality,
                    base64: true,
                });

                if (photo && photo.base64) {
                    onCapture({
                        uri: photo.uri,
                        imageBase64: photo.base64,
                        mimeType: 'image/jpeg',
                    });
                } else {
                    setIsProcessing(false);
                }
            } catch (e) {
                console.error(e);
                setIsProcessing(false);
            }
        }
    };

    const isDark = illuminance < MIN_LUX_REQUIRED;

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                {title ? (
                    <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
                        {title}
                    </Text>
                ) : (
                    <View style={styles.titleSpacer} />
                )}
                {opts.showFlipButton && (
                    <Pressable
                        onPress={() => setCameraType(prev => prev === 'back' ? 'front' : 'back')}
                        style={{ padding: 8, marginRight: 8 }}
                    >
                        <AppIcon name="flip-camera-ios" size={24} color="#fff" />
                    </Pressable>
                )}
                <Pressable onPress={onCancel} style={styles.closeBtn}>
                    <Text style={styles.closeBtnText}>取消</Text>
                </Pressable>
            </View>

            <View style={styles.cameraWrapper}>
                <CameraView
                    ref={cameraRef}
                    style={styles.camera}
                    facing={cameraType}
                    autofocus="on"
                    zoom={zoom}
                >
                    {/* Centering Guide */}
                    {opts.showGuide && (
                        <View style={styles.guideOverlay}>
                            <View style={styles.guideBox} />
                            <Text style={styles.guideText}>{opts.guideText}</Text>
                            {opts.showLightWarning && isDark && (
                                <View style={[styles.warningBox, { flexDirection: 'row', alignItems: 'center' }]}>
                                    <AppIcon name="warning" size={16} color="#856404" style={{ marginRight: 6 }} />
                                    <Text style={styles.warningText}>光線過暗可能影響判斷</Text>
                                </View>
                            )}
                        </View>
                    )}

                    {/* Zoom Controls */}
                    {opts.showZoom && (
                        <View style={styles.zoomControls}>
                            <Pressable
                                style={styles.zoomBtn}
                                onPress={() => setZoom(prev => Math.min(1, prev + 0.1))}
                            >
                                <Text style={styles.zoomBtnText}>+</Text>
                            </Pressable>
                            <View style={styles.zoomLevel}>
                                <Text style={styles.zoomLevelText}>{Math.round(zoom * 10 + 1)}x</Text>
                            </View>
                            <Pressable
                                style={styles.zoomBtn}
                                onPress={() => setZoom(prev => Math.max(0, prev - 0.1))}
                            >
                                <Text style={styles.zoomBtnText}>-</Text>
                            </Pressable>
                        </View>
                    )}
                </CameraView>
            </View>

            <View style={styles.footer}>
                <Pressable
                    style={[styles.captureBtn, isProcessing && { opacity: 0.5 }]}
                    onPress={handleCapture}
                    disabled={isProcessing}
                >
                    {isProcessing ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <View style={styles.captureBtnInner} />
                    )}
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
        zIndex: 9999, // Ensure it sits on top of everything
    },
    permissionContainer: {
        flex: 1,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    permissionText: {
        color: '#fff',
        fontSize: 16,
        marginBottom: 20,
    },
    permissionBtn: {
        backgroundColor: '#3b82f6',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    permissionBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    title: {
        flex: 1,
        paddingRight: 12,
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    titleSpacer: {
        flex: 1,
    },
    closeBtn: {
        flexShrink: 0,
        padding: 8,
    },
    closeBtnText: {
        color: '#fff',
        fontSize: 16,
    },
    cameraWrapper: {
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
    },
    camera: {
        flex: 1,
    },
    guideOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    guideBox: {
        width: Dimensions.get('window').width * 0.7,
        height: Dimensions.get('window').width * 0.7,
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.6)',
        borderStyle: 'dashed',
        borderRadius: 20,
    },
    guideText: {
        color: '#fff',
        fontSize: 14,
        marginTop: 20,
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        overflow: 'hidden',
    },
    warningBox: {
        position: 'absolute',
        bottom: 40,
        backgroundColor: 'rgba(220, 38, 38, 0.8)', // Red alert
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    warningText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
    },
    zoomControls: {
        position: 'absolute',
        right: 20,
        top: '50%',
        marginTop: -100,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 24,
        padding: 8,
        alignItems: 'center',
        gap: 12,
    },
    zoomBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    zoomBtnText: {
        color: '#fff',
        fontSize: 24,
        fontWeight: '600',
    },
    zoomLevel: {
        width: 36,
        alignItems: 'center',
    },
    zoomLevelText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
    },
    footer: {
        paddingVertical: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    captureBtn: {
        width: 72,
        height: 72,
        borderRadius: 36,
        borderWidth: 4,
        borderColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    captureBtnInner: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#fff',
    },
});
