import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import { CapturedImage } from '../types/app';

function toCapturedImage(
  result: ImagePicker.ImagePickerResult,
  titleWhenMissingBase64: string
): CapturedImage | null {
  if (result.canceled || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];
  if (!asset.base64) {
    Alert.alert(titleWhenMissingBase64, '無法取得影像資料，請重試。');
    return null;
  }

  return {
    uri: asset.uri,
    imageBase64: asset.base64,
    mimeType: asset.mimeType || 'image/jpeg',
  };
}

export async function pickFromLibrary(): Promise<CapturedImage | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert('需要相簿權限', '請先允許存取相簿才能選取照片。');
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 0.5,
    base64: true,
  });

  return toCapturedImage(result, '選取失敗');
}

export async function pickFromCamera(): Promise<CapturedImage | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    Alert.alert('需要相機權限', '請先允許使用相機才能拍照。');
    return null;
  }

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: false,
    quality: 0.5,
    base64: true,
  });

  return toCapturedImage(result, '拍照失敗');
}
