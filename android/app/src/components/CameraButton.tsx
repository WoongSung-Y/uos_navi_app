import React, { useEffect } from "react";
import { View, TouchableOpacity, Text, StyleSheet, PermissionsAndroid, Platform, Alert } from "react-native";
import { launchCamera, CameraOptions } from "react-native-image-picker";

type CameraButtonProps = {
  onCapture: (uri: string | null) => void;
};

const CameraButton = ({ onCapture }: CameraButtonProps) => {
  const requestCameraPermission = async () => {
    try {
      if (Platform.OS === "android") {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: "카메라 권한 요청",
            message: "이 앱은 카메라를 사용할 수 있는 권한이 필요합니다.",
            buttonNeutral: "나중에",
            buttonNegative: "취소",
            buttonPositive: "허용",
          }
        );

        if (granted === PermissionsAndroid.RESULTS.DENIED) {
          Alert.alert('카메라 권한이 거부되었습니다.');
        } else if (granted === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
          Alert.alert('카메라 권한이 영구적으로 거부되었습니다.', '설정에서 권한을 허용해주세요.');
        }
      }
    } catch (err) {
      console.warn(err);
    }
  };

  useEffect(() => {
    requestCameraPermission();
  }, []);

  const openCamera = async () => {
    const cameraOptions: CameraOptions = {
      mediaType: "photo",
      cameraType: "back",
      saveToPhotos: false, // 갤러리 저장 비활성화
      quality: 0.8,
    };

    launchCamera(cameraOptions, (response) => {
      if (response.didCancel) {
        onCapture(null); // 촬영 취소 시 null 전달
      } else if (response.errorCode) {
        Alert.alert('카메라 오류', response.errorMessage || '알 수 없는 오류');
        onCapture(null);
      } else if (response.assets?.[0]?.uri) {
        onCapture(response.assets[0].uri); // 촬영된 이미지 URI 전달
      }
    });
  };

  return (
    <TouchableOpacity 
      style={styles.button} 
      onPress={openCamera}
      accessibilityLabel="사진 촬영 버튼"
    >
      <Text style={styles.text}>사진 촬영</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    position: "absolute",
    bottom: 150,
    right: 20,
    backgroundColor: "#007AFF",
    padding: 15,
    borderRadius: 10,
  },
  text: {
    color: "white",
    fontWeight: "bold",
  },
});

export default CameraButton;