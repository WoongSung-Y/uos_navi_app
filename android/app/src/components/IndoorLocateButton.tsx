import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  PermissionsAndroid,
  Platform,
  View,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import { uploadIndoorPhoto } from '../services/api';
import { barometer, setUpdateIntervalForType,SensorTypes   } from 'react-native-sensors';
import RNFS from 'react-native-fs';

type Props = {
  doortype: 'indoor' | 'outdoor';
  initialFloor: number;
  onResult?: (result: any) => void; // ← 이거 props에 추가!
};

const IndoorLocateButton = ({ doortype, initialFloor, onResult }: Props) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const cameraRef = useRef<Camera>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const [cameraReady, setCameraReady] = useState(false);
  const [pressure, setPressure] = useState<number | null>(null);
  const [uploadResult, setUploadResult] = useState<any | null>(null);
  const isFirstShot = useRef(true);
  const pressureRef = useRef<number | null>(null);

  // 🌡️ 기압 수신
useEffect(() => {
  setUpdateIntervalForType(SensorTypes.barometer, 500);
  const sub = barometer.subscribe(({ pressure }) => {
    setPressure(pressure); // 여기까지는 잘 되어 있음
  });
  return () => sub.unsubscribe();
}, []);

  useEffect(() => {
    pressureRef.current = pressure;
  }, [pressure]);
  
  useEffect(() => {
    if (!isCapturing || !cameraReady || !device) return;
  
    if (pressureRef.current === null) {
      console.log('🌀 압력값 없음, 대기 중...');
      return;
    }
  
    const startLoop = () => {
      intervalRef.current = setInterval(async () => {
        try {
          console.log('📸 반복 촬영...');
          const fileName = `indoorlocate_${Date.now()}.jpg`;
          const tempPath = `${RNFS.TemporaryDirectoryPath}/${fileName}`;
          const photo = await cameraRef.current?.takePhoto({ flash: 'off' });
          if (photo?.path) await RNFS.copyFile(photo.path, tempPath);
  
          const result = await uploadIndoorPhoto(
            `file://${tempPath}`,
            fileName,
            pressureRef.current,
            false,
            initialFloor
          );
  
          if (result) {
            setUploadResult(result);
            console.log('[📡 분석결과]', result);
            onResult?.(result);
          }
        } catch (e) {
          console.warn('❌ 업로드 실패:', e);
        }
      }, 2000); // ✅ 너무 빠르지 않게 5초 간격 추천
    };
  
    const initializeAndStart = async () => {
      try {
        console.log('📡 기준 설정 시작');
        const fileName = `indoorlocate_reset_${Date.now()}.jpg`;
        const tempPath = `${RNFS.TemporaryDirectoryPath}/${fileName}`;
        const photo = await cameraRef.current?.takePhoto({ flash: 'off' });
        if (photo?.path) await RNFS.copyFile(photo.path, tempPath);
  
        const result = await uploadIndoorPhoto(
          `file://${tempPath}`,
          fileName,
          pressureRef.current,
          true, // ✅ reset
          initialFloor
        );
  
        if (!result || !result.result || result.result.estimated_floor == null) {
          throw new Error('기준 설정 실패 또는 서버 응답 이상');
        }
  
        console.log('✅ 기준 설정 완료. 반복 촬영 시작');
        isFirstShot.current = false;
        startLoop();
      } catch (e) {
        console.warn('❌ 기준 설정 실패:', e);
      }
    };
  
    initializeAndStart(); // ✅ 최초에 reset 호출 후 시작
  
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      isFirstShot.current = true;
      console.log('[📡 반복 중지]');
    };
  }, [isCapturing, cameraReady]);
  
  

  if (doortype !== 'indoor' || !device) {
    console.log('⛔ 렌더 차단 - indoor 아님 혹은 device 없음');
    return null;
  }

  return (
    <>
{isCapturing && device && (
  <Camera
    ref={cameraRef}
    style={styles.hiddenCamera}
    device={device}
    isActive={true}
    photo={true}
    onInitialized={() => {
      setCameraReady(true);
      console.log('✅ 카메라 준비 완료');
    }}
    onError={(e) => console.error('❌ 카메라 에러:', e)}
  />
)}

      <TouchableOpacity
        style={[styles.button, isCapturing && styles.active]}
        onPress={() => setIsCapturing((prev) => !prev)}
      >
        {uploadResult && (
          <View style={styles.resultDisplay}>
            <Text style={styles.resultText}>
              ✅ 분석결과
              {'\n'}예측 노드: {uploadResult?.result?.predicted_class}
              {'\n'}거리: {uploadResult?.result?.distance}
              {'\n'}층수: {uploadResult?.result?.estimated_floor}
            </Text>
          </View>
        )}
        <Text style={styles.text}>{isCapturing ? '🛑' : '🟢'}</Text>
        <Text style={styles.pressureText}>
          {isCapturing ? `${pressureRef.current?.toFixed(2) ?? '?'} hPa` : '측정중...'}
        </Text>
      </TouchableOpacity>
    </>
  );
};

export default IndoorLocateButton;

const styles = StyleSheet.create({
  hiddenCamera: {
    width: 1,
    height: 1,
    position: 'absolute',
    top: -1000,
    left: -1000,
    opacity: 0,
  },
  button: {
    position: 'absolute',
    bottom: 85,
    left: 10,
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    fontWeight: 'bold',
  },
  pressureText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 4,
  },
  resultDisplay: {
    position: 'absolute',
    bottom: 160,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 15,
    borderRadius: 8,
    zIndex: 9999,
    width: '200%',
  },
  resultText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    lineHeight: 22,
  },
});
