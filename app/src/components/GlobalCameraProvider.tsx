import React, { createContext, useContext, useState, ReactNode } from 'react';
import { View, StyleSheet, Alert, Modal } from 'react-native';
import { CustomCamera } from './CustomCamera';
import { CapturedImage } from '../types/app';

interface CameraContextProps {
    launchCamera: (title: string) => Promise<CapturedImage | null>;
    isCameraVisible: boolean;
}

const CameraContext = createContext<CameraContextProps | null>(null);

export function useGlobalCamera() {
    const context = useContext(CameraContext);
    if (!context) {
        throw new Error('useGlobalCamera must be used within a GlobalCameraProvider');
    }
    return context;
}

export function GlobalCameraProvider({ children }: { children: ReactNode }) {
    const [isVisible, setIsVisible] = useState(false);
    const [title, setTitle] = useState('');
    const [resolver, setResolver] = useState<(value: CapturedImage | null) => void>();

    const launchCamera = (cameraTitle: string): Promise<CapturedImage | null> => {
        console.log('[GlobalCamera] launchCamera called:', cameraTitle);
        setTitle(cameraTitle);
        setIsVisible(true);
        return new Promise((resolve) => {
            setResolver(() => resolve);
        });
    };

    const handleCapture = (image: CapturedImage) => {
        console.log('[GlobalCamera] Image captured successfully');
        setIsVisible(false);
        if (resolver) resolver(image);
    };

    const handleCancel = () => {
        console.log('[GlobalCamera] Selection canceled');
        setIsVisible(false);
        if (resolver) resolver(null);
    };

    return (
        <CameraContext.Provider value={{ launchCamera, isCameraVisible: isVisible }}>
            {children}
            <Modal visible={isVisible} transparent animationType="slide">
                <View style={StyleSheet.absoluteFill}>
                    <CustomCamera
                        title={title}
                        onCapture={handleCapture}
                        onCancel={handleCancel}
                    />
                </View>
            </Modal>
        </CameraContext.Provider>
    );
}
