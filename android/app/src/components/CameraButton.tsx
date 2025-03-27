import React, { useEffect, useState } from "react";
import { View, TouchableOpacity, Text, StyleSheet, PermissionsAndroid, Platform } from "react-native";
import { launchCamera } from "react-native-image-picker";
import RNFS from 'react-native-fs';

const CameraButton = ({ selectedEdgeId, allEdge, onCapture }) => {
  const [direction, setDirection] = useState(1); // 1: 순방향, 2: 역방향

  const openCamera = async () => {
    const options = {
      mediaType: "photo",
      cameraType: "back",
      saveToPhotos: false,
    };

    launchCamera(options, async (response) => {
      if (response.didCancel || response.errorCode || !response.assets?.length) {
        console.warn("촬영 실패 또는 취소");
        return;
      }

      const imageUri = response.assets[0].uri;
      console.log("📸 원본 이미지 URI:", imageUri);

              // ✅ edgeId로 해당 링크 정보 찾기
      const edgeInfo = allEdge.find(e => e.id === selectedEdgeId);
      if (!edgeInfo) {
        console.error("❌ 링크 정보 없음");
        return;
      }

      const nodeId = direction === 1 ? edgeInfo.node1 : edgeInfo.node2;

      const fileName = `edge_${selectedEdgeId}_${nodeId}.jpg`;
      const destPath = `${RNFS.ExternalDirectoryPath}/${fileName}`;

      try {
        await RNFS.copyFile(imageUri, destPath);
        console.log("✅ 파일 저장 성공:", destPath);

        onCapture({
          uri: 'file://' + destPath + '?t=' + Date.now(),  // ← 캐시 방지
          edgeId: selectedEdgeId,
          direction: nodeId,  // ← nodeId 넘김
        });

        


      } catch (err) {
        console.error("❌ 파일 저장 실패:", err);
      }
    });
  };

  return (
    <View style={{ position: "absolute", bottom: 80, right: 20 }}>
      {/* 방향 선택 버튼 */}
      <View style={styles.directionContainer}>
        <TouchableOpacity
          style={[styles.directionButton,styles.node1Button, direction === 1 && styles.node1Selected]}
          onPress={() => setDirection(1)}
        >
          <Text style={styles.text}>node1</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.directionButton, styles.node2Button, ,direction === 2 && styles.node2Selected]}
          onPress={() => setDirection(2)}
        >
          <Text style={styles.text}>node2</Text>
        </TouchableOpacity>
      </View>

      {/* 카메라 버튼 */}
      <TouchableOpacity style={styles.button} onPress={openCamera}>
        <Text style={styles.text}>📷 카메라</Text>
      </TouchableOpacity>
    </View>
  );
};

// 1. 버튼 스타일 지정
const styles = StyleSheet.create({
  directionContainer: {
    flexDirection: "row",
    marginBottom: 10,
    justifyContent: "space-between",
  },
  directionButton: {
    padding: 10,
    borderRadius: 10,
    marginHorizontal: 5,
  },
  node1Button: {
    backgroundColor: "#A5F3A0", // 연한 초록
  },
  node1Selected: {
    backgroundColor: "#00C800", // 진한 초록
  },
  node2Button: {
    backgroundColor: "#FFD580", // 연한 주황
  },
  node2Selected: {
    backgroundColor: "#FFA500", // 진한 주황
  },
  button: {
    backgroundColor: "#007AFF",
    padding: 15,
    borderRadius: 10,
  },
  text: {
    color: "white",
    fontWeight: "bold",
    textAlign: "center",
  },
});


export default CameraButton;
