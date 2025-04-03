import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, PermissionsAndroid, Platform, Alert } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { uploadIndoorPhoto } from '../services/api';
import { SensorTypes, setUpdateIntervalForType, barometer } from 'react-native-sensors';

type Props = {
  doortype: 'indoor' | 'outdoor';
};

const IndoorLocateButton = ({ doortype }: Props) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const cameraRef = useRef<Camera>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const isCameraReady = useRef(false);
  const [pressure, setPressure] = useState<number | null>(null);

  useEffect(() => {
    const sub = barometer.subscribe(({ pressure }) => {
      setPressure(pressure);
    });
  
    return () => sub.unsubscribe();
  }, []);
  
  
  useEffect(() => {
    const requestAllPermissions = async () => {
      if (!hasPermission) await requestPermission();
      if (Platform.OS === 'android') {
        await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
      }
    };
    requestAllPermissions();
  }, []);

  useEffect(() => {
    if (isCapturing && isCameraReady.current) {
      intervalRef.current = setInterval(async () => {
        try {
          const photo = await cameraRef.current?.takePhoto({ flash: 'off' });
          if (photo?.path) {
            const uri = `file://${photo.path}`;
            const fileName = `indoorlocate_${Date.now()}.jpg`;
            await uploadIndoorPhoto(uri, fileName, pressure);
            console.log('[📡 업로드 성공]:', fileName);
          }
        } catch (err) {
          console.warn('[❌ 촬영 실패]:', err);
        }
      }, 2000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        console.log('[📡 중지됨]');
      }
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isCapturing]);

  if (doortype !== 'indoor' || !device) return null;

  return (
    <>
      <Camera
        ref={cameraRef}
        style={styles.hiddenCamera}
        device={device}
        isActive={true}
        photo={true}
        onInitialized={() => {
          isCameraReady.current = true;
          console.log('✅ 카메라 준비 완료');
        }}
        onError={(e) => console.error('❌ 카메라 에러:', e)}
      />
      <TouchableOpacity
        style={[styles.button, isCapturing && styles.active]}
        onPress={() => setIsCapturing((prev) => !prev)}
      >
        <Text style={styles.text}>{isCapturing ? '🛑' : '🟢'}</Text>
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
    right: 20,    
  },
  text: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
