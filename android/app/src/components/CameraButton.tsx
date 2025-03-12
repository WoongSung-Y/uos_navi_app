import React, { useEffect } from "react";
import { View, TouchableOpacity, Text, StyleSheet, PermissionsAndroid, Platform } from "react-native";
import { launchCamera } from "react-native-image-picker";

const CameraButton = ({ onCapture }) => {
  // ✅ 안드로이드에서 카메라 권한 요청 함수
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
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          console.log("카메라 권한이 허용됨");
        } else {
          console.log("카메라 권한이 거부됨");
        }
      }
    } catch (err) {
      console.warn(err);
    }
  };

  useEffect(() => {
    requestCameraPermission(); // 앱 실행 시 한 번 권한 요청
  }, []);

  // 카메라 실행 함수
  const openCamera = async () => {
    const options = {
      mediaType: "photo",
      cameraType: "back",
      saveToPhotos: true,
    };
    // 카메라 버튼 누르면 실행되는 함수
    launchCamera(options, (response) => {
      if (response.didCancel) {
        console.log("사용자가 카메라를 취소했습니다.");
      } else if (response.errorCode) {
        console.log("카메라 오류:", response.errorMessage);
      } else if (response.assets && response.assets.length > 0) {
        const imageUri = response.assets[0].uri;
        onCapture(imageUri); // 촬영한 이미지 URI를 부모 컴포넌트에 전달
      }
    });
  };

  return (
    <TouchableOpacity style={styles.button} onPress={openCamera}>
      <Text style={styles.text}>📷 카메라</Text>
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
