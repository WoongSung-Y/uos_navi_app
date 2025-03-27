import React from 'react';
import { TouchableOpacity, Image, StyleSheet } from 'react-native';
import useLocation from '../hooks/useLocation';

const LocationButton = ({ setLocation }) => {
  const { getLocation } = useLocation();

  const handlePress = async () => {
    const location = await getLocation(); // ✅ 위치 가져오기
    if (location) {
      setLocation(location); // ✅ 부모(App)로 위치 전달
    }
  };

  return (
    <TouchableOpacity style={styles.button} onPress={handlePress}>
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
