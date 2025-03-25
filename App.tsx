import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import StartScreen from './android/app/src/screens/StartScreen';
import SearchableMap from './android/app/src/screens/SearchableMap'; 
import RouteScreen from './android/app/src/screens/RouteScreen'; 

const Stack = createNativeStackNavigator();

const App = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Start" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Start" component={StartScreen} />
        <Stack.Screen name="SearchableMap" component={SearchableMap} />
        <Stack.Screen name="Route" component={RouteScreen} />

      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default App;
