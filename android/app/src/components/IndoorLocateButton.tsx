import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import { uploadIndoorPhoto } from '../services/api';
import { barometer, setUpdateIntervalForType, SensorTypes } from 'react-native-sensors';
import RNFS from 'react-native-fs';
import NetInfo from '@react-native-community/netinfo';

type Props = {
  doortype: 'indoor' | 'outdoor';
  initialFloor: number;
  autoEnd?: boolean;
  onResult?: (result: any) => void;
  buildingName: string;
};

const IndoorLocateButton = ({autoEnd, doortype, initialFloor, onResult ,buildingName}: Props) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const cameraRef = useRef<Camera>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const device = useCameraDevice('back');
  const [cameraReady, setCameraReady] = useState(false);
  const [pressure, setPressure] = useState<number | null>(null);
  const [uploadResult, setUploadResult] = useState<any | null>(null);
  const pressureRef = useRef<number | null>(null);
  const recentResults = useRef<string[]>([]);
  const [isConnected, setIsConnected] = useState(true);
  const [baselineCaptured, setBaselineCaptured] = useState(false);
  // console.log(autoStart, 'autoStart');
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected ?? false);
    });
    return () => unsubscribe();
  }, []);


    
  useEffect(() => {
    setUpdateIntervalForType(SensorTypes.barometer, 500);
    const sub = barometer.subscribe(({ pressure }) => {
      setPressure(pressure);
    });
    return () => sub.unsubscribe();
  }, []);

  useEffect(() => {
    pressureRef.current = pressure;
  }, [pressure]);

const updateWithMajorityVote = (newClass: string, rawResult: any) => {
  const similarity = rawResult?.result?.similarity;
  
  // 유사도 조건 추가
  if (similarity == null || similarity > 1.1) {
    console.log(`⚠️ 유사도 기준 미달: similarity=${similarity}`);
    return; // 유사도 조건 미달 시 다수결 패스
  }

  recentResults.current.push(newClass);
  if (recentResults.current.length > 3) {
    recentResults.current.shift();
  }

  const counts: Record<string, number> = {};
  for (const cls of recentResults.current) {
    counts[cls] = (counts[cls] || 0) + 1;
  }

  const [majorityClass, count] = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])[0];

  if (count >= 2) {
    console.log('✅ 다수결 통과:', majorityClass);
    const majorityResult = {
      ...rawResult,
      result: {
        ...rawResult.result,
        predicted_class: majorityClass,
      }
    };
    setUploadResult(majorityResult);
    onResult?.(majorityResult);
  } else {
    console.log('⚠️ 다수결 미충족:', counts);
  }
};
useEffect(() => {
  if (autoEnd === false) {
    console.log('🚀 autoEnd 감지 - 촬영 자동 종료');
    setIsCapturing(false);
    recentResults.current = [];
    setUploadResult(null);
    setBaselineCaptured(false);
  } else if (autoEnd === true && cameraReady && !isCapturing) {
    console.log('🚀 autoStart 감지 - 촬영 자동 시작 (카메라 준비됨)');
    setIsCapturing(true);
    setCameraReady(false);
    setBaselineCaptured(false);
  }
}, [autoEnd, cameraReady]);



useEffect(() => {
  let isCancelled = false;

  if (!isCapturing || !device) return;

  const waitUntilReady = async () => {
    while (!cameraReady && !isCancelled) {
      console.log('⏳ 카메라 준비 대기 중...');
      await new Promise(res => setTimeout(res, 200));
    }
  };

  const startLoop = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(async () => {
      
      if (isCancelled || !cameraRef.current) return;

      try {
        console.log('📸 반복 촬영...');
        const fileName = `indoorlocate_${Date.now()}.jpg`;
        const tempPath = `${RNFS.TemporaryDirectoryPath}/${fileName}`;
        const photo = await cameraRef.current.takePhoto({ flash: 'off' });

        if (photo?.path) {
          await RNFS.copyFile(photo.path, tempPath);
          await new Promise(resolve => setTimeout(resolve, 100)); // 파일 안정화 대기
        }

        if (!isConnected) {
          console.log('📴 인터넷 없음. 업로드 스킵');
          return;
        }

        const result = await uploadIndoorPhoto(
          `file://${tempPath}`,
          fileName,
          pressureRef.current,
          false,
          initialFloor,
          buildingName
        );

        if (result) {
          updateWithMajorityVote(result.result.predicted_class, result);
        }
      } catch (e) {
        console.warn('❌ 업로드 실패:', e);
      }
    }, 1500);
  };

  const initializeAndStart = async () => {
    try {
      await waitUntilReady();
      if (isCancelled || !cameraRef.current) return;

      if (!baselineCaptured) {
        console.log('📡 기준 설정 시작');
        const fileName = `indoorlocate_reset_${Date.now()}.jpg`;
        const tempPath = `${RNFS.TemporaryDirectoryPath}/${fileName}`;
        const photo = await cameraRef.current.takePhoto({ flash: 'off' });
        if (photo?.path) await RNFS.copyFile(photo.path, tempPath);

        const result = await uploadIndoorPhoto(
          `file://${tempPath}`,
          fileName,
          pressureRef.current,
          true, // 기준 설정
          initialFloor,
          buildingName
        );

        if (!result || !result.result || result.result.estimated_floor == null) {
          throw new Error('기준 설정 실패');
        }

        setBaselineCaptured(true);
      }

      startLoop();
    } catch (e) {
      console.warn('❌ 기준 설정 실패:', e);
    }
  };

  initializeAndStart();

  return () => {
    isCancelled = true;
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    console.log('[📡 반복 중지]');
  };
}, [isCapturing, cameraReady, device]);

// console.log('autoStart', autoStart);




  if (doortype !== 'indoor' || !device) {
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
  style={[styles.captureButton, isCapturing ? styles.stop : styles.start]}
  onPress={() => {
    setCameraReady(false);
    setIsCapturing(prev => {
      const newCapturing = !prev;
      if (!newCapturing) {
        // 촬영 종료 시 uploadResult 초기화
        setUploadResult(null);
      }
      return newCapturing;
    });
  }}
>
  <Text style={styles.buttonText}>
    {isCapturing ? 'STOP' : 'START'}
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
    bottom: 1,
    left: -55,
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    fontWeight: 'bold',
    bottom: 65,
    left: -15,
    
  },
  captureButton: {
  width: 80,
  height: 80,
  borderRadius: 40,
  justifyContent: 'center',
  alignItems: 'center',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.3,
  shadowRadius: 3,
  elevation: 5,
  bottom: "95%",
  left: "-60%",
  zIndex: 9999,
},
start: {
  backgroundColor: '#4CAF50',
},
stop: {
  backgroundColor: '#F44336',
},
buttonText: {
  color: '#fff',
  fontWeight: 'bold',
  fontSize: 16,
},

  pressureText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 4,
    fontWeight: 'bold',
    bottom: 70,
    left:4,
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
