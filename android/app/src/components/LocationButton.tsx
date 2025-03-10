import React from 'react';
import { TouchableOpacity, Image, StyleSheet } from 'react-native';
import useLocation from '../hooks/useLocation';

// useLocation 훅에서 geolocation 함수 가져옴
// 버튼 클릭시 getLocation 함수 -> 현재 위치 가져옴(by 리액트 내장함수)
const LocationButton = () => {
  const { getLocation } = useLocation();

  return (
    <TouchableOpacity style={styles.button} onPress={getLocation}>
      <Image source={require('../../assets/location-icon.png')} style={styles.icon} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    bottom: 80,
    right: 10,
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 50,
    elevation: 5,
  },
  icon: { width: 30, height: 30 },
});

export default LocationButton;
