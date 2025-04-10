// 응냐냐냐 위플래쉬 ~
// 응 냐 응 냐 위플래쉬 ~
import React, { useEffect } from 'react';
import { View, Image, StyleSheet, Dimensions, StatusBar } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const SplashScreen = () => {
  const navigation = useNavigation();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.replace('Start');
    }, 1300);

    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#ffffff" barStyle="dark-content" />
      <Image
        source={require('../../assets/FORUS_(7).png')} 
        style={styles.logo}
        resizeMode="contain"
      />
    </View>
  );
};

export default SplashScreen;
// 위플래쉬 ㅋㅋ
const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: width * 0.4,
    height: height * 0.15,
  },
});
