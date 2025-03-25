import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import StartScreen from './android/app/src/screens/StartScreen';
import MainScreen from './android/app/src/screens/MainScreen';
import SearchableMap from './android/app/src/screens/SearchableMap'; 

const Stack = createNativeStackNavigator();

const App = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Start" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Start" component={StartScreen} />
        <Stack.Screen name="Main" component={MainScreen} />
        <Stack.Screen name="SearchableMap" component={SearchableMap} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default App;
