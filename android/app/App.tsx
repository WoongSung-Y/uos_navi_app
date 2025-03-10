import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapComponent from './src/components/MapComponent';
import FloorSelector from './src/components/FloorSelector';
import LocationButton from './src/components/LocationButton';
import { fetchBuildingPolygons } from './src/services/api';

// App 컴포넌트(TypeScript, 함수형 컴포넌트)
// 최상위 컴포넌트
const App: React.FC = () => {
   // buildingPolygon: 건물 데이터를 담는 '배열' state
   // setBuildingPolygon: buildingPolygon의 state를 업데이트하는 함수
   // 초기값은 빈 배열
  const [buildingPolygon, setBuildingPolygon] = useState<any[]>([]);
  // selectedBuilding: 선택된 건물의 id를 저장하는 state
  // setSelectedBuilding: selectedBuilding의 state를 업데이트하는 함수
  // 선택되지 않은 경우 null, 선택된 경우 건물 id (number)
  const [selectedBuilding, setSelectedBuilding] = useState<number | null>(null);
  // selectedFloor: 선택된 층을 저장하는 state
  // setSelectedFloor: selectedFloor의 state를 업데이트하는 함수
  // 기본값:1, 선택된 경우 층 수
  const [selectedFloor, setSelectedFloor] = useState<string>('1');

  // 출발지와 도착지 state
  const [startLocation, setStartLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [endLocation, setEndLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  // 건물 데이터 불러오기
  // useEffect: 컴포넌트가 처음 렌더링 될 때 의존성 배열 한번만 실행
  useEffect(() => {
    // loadBuildings: fetchBuildingPolygons 함수를 호출하여 건물 데이터를 불러옴
    // fetchBuildingPolygons: api.ts 파일에 정의된 fetchBuildingPolygons 함수
    // 가져온 data를 setBuildingPolygons 함수를 통해 buildingPolygon state에 업데이트트
    const loadBuildings = async () => {
      const data = await fetchBuildingPolygons();
      setBuildingPolygon(data);
    };
    loadBuildings();
  }, []);

  // 렌더링
  return (
    <View style={styles.container}>
      <Text style={styles.title}>서울시립대학교 캠퍼스 내비게이션</Text>

      {/* 지도를 표시하는 컴포넌트 */}
      <MapComponent // 여러 개의 props를 전달
        buildingPolygon={buildingPolygon} // 건물 데이터 전달
        selectedBuilding={selectedBuilding} // 현재 선택된 건물 ID
        setSelectedBuilding={setSelectedBuilding} // 선택된 건물을 업데이트하는 함수
        selectedFloor={selectedFloor} // 현재 선택된 층
        startLocation={startLocation} // 사용자가 선택한 출발지 위치
        endLocation={endLocation} // 사용자가 선택한 도착지 위치
        setStartLocation={setStartLocation} // 출발지 변경 함수
        setEndLocation={setEndLocation} // 도착지 변경 함수
      />

      <LocationButton />


      {/* 층 선택 UI */}
      {selectedBuilding !== null && (
        <FloorSelector
          selectedFloor={selectedFloor}
          setSelectedFloor={setSelectedFloor}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 20, fontWeight: 'bold', marginVertical: 20, textAlign: 'center' },
});

export default App;
