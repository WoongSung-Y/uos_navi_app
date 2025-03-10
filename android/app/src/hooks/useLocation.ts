import { useState } from 'react';
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

// 위도, 경도 저장 객체체
const useLocation = () => {
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);

// 사용자 위치 권한 요청
  const requestLocationPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (error) {
        console.error('권한 요청 오류:', error);
        return false;
      }
    }
    return true;
  };

// 사용자 현재 위치 불러오기
  const getLocation = async () => {
    const hasPermission = await requestLocationPermission(); // 위치 권한 있는지 확인
    if (!hasPermission) {
      Alert.alert('권한 없음', '위치 권한을 활성화하세요.'); //권한 없으면 함수 종료
      return;
    }

    Geolocation.getCurrentPosition( // 현재 위치 정보 가져오기
      (position) => {
        const { latitude, longitude } = position.coords; //position 객체로부터 위, 경도 정보 저장후
        setLocation({ latitude, longitude }); // location state에 저장
      },
      (error) => {
        console.error('위치 가져오기 오류:', error);
        Alert.alert('오류', '위치를 가져올 수 없습니다.');
      },
      {
        enableHighAccuracy: true, // GPS 사용하여 가장 정확한 위치 가져옴
        timeout: 5000, // 위치 정보 가져오는데 최대 대기 시간: 5초초
        maximumAge: 10000, //10초 이내에 가져온 위치 정보 사용
      },
    );
  };

  return { location, getLocation }; // 현재 위치, geoLocation 함수 반환
};

export default useLocation;
