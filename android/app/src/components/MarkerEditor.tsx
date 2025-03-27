// MarkerEditor.tsx - ViewShot 기반 최적화 + 고화질 + 검정 여백 제거 + 드래그 가능
import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
  PanResponder,
} from 'react-native';
import ViewShot from 'react-native-view-shot';
import { useNavigation, useRoute } from '@react-navigation/native';
import {uploadImageToServer} from '../services/api';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
let markerId = 0;

const markerOptions = [
  {
    name: '출입구',
    source: require('../assets/markers/IrumakerE.png'),
  },
  {
    name: '화살표',
    source: require('../assets/markers/IrumakerY.png'),
  },
];

const MarkerEditor = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { imageUri, edgeId, direction, allEdge } = route.params;

  const [markers, setMarkers] = useState([]);
  const [selectedMarkerSource, setSelectedMarkerSource] = useState(markerOptions[0].source);
  const [isSaving, setIsSaving] = useState(false);
  const viewRef = useRef();

  const addMarker = () => {
    markerId += 1;
    setMarkers((prev) => [
      ...prev,
      {
        id: markerId,
        x: screenWidth / 2 - 30,
        y: screenHeight / 2 - 200,
        source: selectedMarkerSource,
      },
    ]);
  };

  const deleteMarker = (id) => {
    setMarkers((prev) => prev.filter((m) => m.id !== id));
  };

  const saveImage = async () => {
    try {
      setIsSaving(true);
      const uri = await viewRef.current.capture(); // tmpfile 경로 (e.g., file:///...)
      const currentEdge = allEdge.find((edge) => edge.id === edgeId);

      if (!currentEdge) {
        console.warn('⚠️ edge 정보 없음');
        return;
      }
      
      const nodePart = direction === 1 ? currentEdge.node1 : currentEdge.node2;
      const fileName = `${edgeId}_${nodePart}.jpg`;
  
      console.log('📸 캡처된 이미지:', uri);
  
      const result = await uploadImageToServer(uri, fileName); // 서버로 직접 업로드
  
      if (result?.message) {
        console.log('✅ 업로드 성공:', result.filePath);
      } else {
        console.warn('⚠️ 업로드 응답 이상:', result)
      }
  
      navigation.goBack();
    } catch (err) {
      console.error('❌ 저장 실패:', err);
    } finally {
      setIsSaving(false);
    }
  };
  
  

  const createPanResponder = (marker) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gesture) => {
        setMarkers((prev) =>
          prev.map((m) =>
            m.id === marker.id
              ? { ...m, x: m.x + gesture.dx, y: m.y + gesture.dy }
              : m
          )
        );
      },
    });

  return (
    <View style={styles.container}>
      {/* 마커 선택 UI */}
      <ScrollView horizontal style={styles.markerTypeRow}>
        {markerOptions.map((option) => (
          <TouchableOpacity
            key={option.name}
            onPress={() => setSelectedMarkerSource(option.source)}
            style={[styles.markerOption, selectedMarkerSource === option.source && styles.selectedOption]}
          >
            <Image source={option.source} style={styles.miniIcon} />
            <Text style={styles.optionLabel}>{option.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* 이미지 + 마커 포함 전체 캡처 */}
      <ViewShot
        ref={viewRef}
        style={styles.previewWrapper}
        options={{
          format: 'jpg',
          quality: 1.0,
          result: 'tmpfile',
        }}
      >
        <View style={styles.previewArea}>
          <Image
            source={{ uri: imageUri }}
            style={styles.image}
            resizeMode="cover"
          />
          {markers.map((marker) => (
            <View
              key={marker.id}
              {...createPanResponder(marker).panHandlers}
              style={[styles.markerContainer, { top: marker.y, left: marker.x }]}
            >
              <Image source={marker.source} style={styles.markerImage} />
              {!isSaving && (
                <TouchableOpacity onPress={() => deleteMarker(marker.id)} style={styles.deleteBtn}>
                  <Text style={{ color: 'white', fontSize: 12 }}>❌</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      </ViewShot>

      {/* 하단 버튼 */}
      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.controlBtn} onPress={addMarker}>
          <Text style={styles.controlText}>+ 마커</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlBtn} onPress={saveImage}>
          <Text style={styles.controlText}>💾 저장</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default MarkerEditor;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  previewWrapper: {
    flex: 10,
    backgroundColor: '#000',
  },
  previewArea: {
    flex: 1,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  markerTypeRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: '#111',
  },
  markerOption: {
    alignItems: 'center',
    marginRight: 16,
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#222',
  },
  selectedOption: {
    borderColor: '#00BFFF',
    borderWidth: 2,
  },
  miniIcon: {
    width: 60,
    height: 60,
    marginBottom: 6,
  },
  optionLabel: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  markerContainer: {
    position: 'absolute',
    alignItems: 'center',
  },
  markerImage: {
    width: 40,
    height: 40,
  },
  deleteBtn: {
    marginTop: 4,
    backgroundColor: 'black',
    paddingHorizontal: 4,
    borderRadius: 5,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#111',
    padding: 12,
  },
  controlBtn: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 10,
  },
  controlText: {
    color: 'white',
    fontWeight: 'bold',
  },
});