// App.tsx - Navigation 포함, 화면 분리 없이 구성
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MapComponent from './src/components/MapComponent';
import FloorSelector from './src/components/FloorSelector';
import CameraButton from './src/components/CameraButton';
import MarkerEditor from './src/components/MarkerEditor';
import { fetchBuildingPolygons, fetchFloorPolygons, fetchalledge, fetchNodes } from './src/services/api';
import useLocation from './src/hooks/useLocation';

import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Map: undefined;
  MarkerEditor: {
    imageUri: string;
    edgeId: number;
    direction: number;
  };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const MapScreen = ({ navigation }) => {
  const [floorPolygons, setFloorPolygons] = useState([]);
  const [buildingPolygon, setBuildingPolygon] = useState([]);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [selectedFloor, setSelectedFloor] = useState('1');
  const [selectedEdgeId, setSelectedEdgeId] = useState<number | null>(null);
  const [allEdge, setallEdge] = useState([]);
  const { location } = useLocation();
  const [selectedType, setSelectedType] = useState<'indoor' | 'outdoor'>('indoor');
  const [nodes, setNodes] = useState([]);

  useEffect(() => {
    const loadNodes = async () => {
      try {
        const data = await fetchNodes(); // 이미 만들어둔 fetchNodes 사용
        setNodes(data);
      } catch (error) {
        console.error('노드 데이터 로딩 실패:', error);
      }
    };
    loadNodes();
  }, []);


  useEffect(() => {
    const loadedge = async () => {
      try {
        const data = await fetchalledge(
          selectedType === 'indoor' ? selectedFloor : null,
          selectedType
        );
        setallEdge(data);
      } catch (error) {
        console.error('노드 데이터 불러오기 실패:', error);
      }
    };
    loadedge();
  }, [selectedFloor, selectedType]);
  
  useEffect(() => {
    const loadBuildings = async () => {
      try {
        const data = await fetchBuildingPolygons();
        setBuildingPolygon(data);
      } catch (error) {
        console.error('건물 폴리곤 불러오기 실패:', error);
      }
    };
    loadBuildings();
  }, []);

  useEffect(() => {
    const loadFloorPolygons = async () => {
      if (selectedBuilding) {
        try {
          const data = await fetchFloorPolygons(selectedFloor, selectedBuilding);
          setFloorPolygons(data);
        } catch (error) {
          console.error('층 폴리곤 불러오기 실패:', error);
        }
      }
    };
    loadFloorPolygons();
  }, [selectedBuilding, selectedFloor]);

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <Text style={styles.title}>데이터 취득용 어플리케이션</Text>
      </View>

      <View style={styles.typeSelector}>
  <TouchableOpacity
    style={[
      styles.typeButton,
      selectedType === 'indoor' && styles.selectedTypeButton,
    ]}
    onPress={() => setSelectedType('indoor')}
  >
    <Text style={styles.typeButtonText}>실내</Text>
  </TouchableOpacity>

  <TouchableOpacity
    style={[
      styles.typeButton,
      selectedType === 'outdoor' && styles.selectedTypeButton,
    ]}
    onPress={() => setSelectedType('outdoor')}
  >
    <Text style={styles.typeButtonText}>실외</Text>
  </TouchableOpacity>
</View>


      <MapComponent
        buildingPolygon={buildingPolygon}
        floorPolygons={floorPolygons}
        selectedBuilding={selectedBuilding}
        setSelectedBuilding={setSelectedBuilding}
        selectedFloor={selectedFloor}
        currentLocation={location}
        allEdge={allEdge}
        setSelectedEdgeId={setSelectedEdgeId}
        nodes={nodes}
      />

<CameraButton
  selectedEdgeId={selectedEdgeId}
  allEdge={allEdge}
  onCapture={({ uri, direction }) => {
    navigation.navigate('MarkerEditor', {
      imageUri: uri,
      edgeId: selectedEdgeId ?? 0,
      direction,
      allEdge,
    });
  }}
/>



      {selectedBuilding !== null && (
        <FloorSelector selectedFloor={selectedFloor} setSelectedFloor={setSelectedFloor} />
      )}
    </View>
  );
};

const App = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Map" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Map" component={MapScreen} />
        <Stack.Screen name="MarkerEditor" component={MarkerEditor} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  inputContainer: {
    padding: 10,
    backgroundColor: 'white',
    elevation: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  typeSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 10,
  },
  typeButton: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    backgroundColor: '#ddd',
    borderRadius: 8,
    marginHorizontal: 5,
  },
  selectedTypeButton: {
    backgroundColor: '#4287f5',
  },
  typeButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  
});

export default App;