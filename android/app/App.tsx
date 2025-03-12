import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, StyleSheet,Image } from 'react-native';
import MapComponent from './src/components/MapComponent';
import FloorSelector from './src/components/FloorSelector';
import LocationButton from './src/components/LocationButton';
import CameraButton from "./src/components/CameraButton";
import { fetchBuildingPolygons, fetchShortestPath, fetchNodes, fetchFloorPolygons, fetchEdgeCoordinates} from './src/services/api';
import { findNearestNode } from './src/utils/findNearestNode';

// App 컴포넌트(TypeScript, 함수형 컴포넌트)
// 최상위 컴포넌트
const App = () => {
  const [floorPolygons, setFloorPolygons] = useState([]);
   // buildingPolygon: 건물 데이터를 담는 '배열' state
   // setBuildingPolygon: buildingPolygon의 state를 업데이트하는 함수
   // 초기값은 빈 배열
  const [buildingPolygon, setBuildingPolygon] = useState([]);
  // selectedBuilding: 선택된 건물의 id를 저장하는 state
  // setSelectedBuilding: selectedBuilding의 state를 업데이트하는 함수
  // 선택되지 않은 경우 null, 선택된 경우 건물 id (number)
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  // selectedFloor: 선택된 층을 저장하는 state
  // setSelectedFloor: selectedFloor의 state를 업데이트하는 함수
  // 기본값:1, 선택된 경우 층 수
  const [selectedFloor, setSelectedFloor] = useState("1");
  // 출발지와 도착지 state
  // 출발지와 도착지 사용자가 입력할 수 있도록
  const [startLocation, setStartLocation] = useState(null);
  const [endLocation, setEndLocation] = useState(null);
  const [startText, setStartText] = useState("");
  const [endText, setEndText] = useState("");
  // 최단 경로
  const [path, setPath] = useState([]);
  const [nodes, setNodes] = useState([]);

  // 출발지 도착지 입력할 때 강제 focus변수 설정
  const startInputRef = useRef(null);
  const endInputRef = useRef(null);  

  // 사진 찍힌 이미지 및 관리 state
  // capturedImage: 찍힌 사진의 URI를 저장하는 state
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  // 폴리곤 불러오기
  useEffect(() => {
    const loadBuildings = async () => {
      try {
        const data = await fetchBuildingPolygons(); // API 호출
        setBuildingPolygon(data); // 상태 업데이트
      } catch (error) {
        console.error("건물 폴리곤 불러오기 실패:", error);
      }
    };
    loadBuildings();
  }, []);

  // 노드 데이터 불러오기
    useEffect(() => {
      const loadNodes = async () => {
        try {
          const data = await fetchNodes();
          setNodes(data);
        } catch (error) {
          console.error("노드 데이터 불러오기 실패:", error);
        }
      };
      loadNodes();
    }, []);

  // 건물을 클릭하면 해당 건물의 층별 폴리곤 불러오기
  useEffect(() => {
    const loadFloorPolygons = async () => {
      if (selectedBuilding) {
        try {
          console.log(`선택된 건물 ID: ${selectedBuilding}, 층: ${selectedFloor}`);
          const data = await fetchFloorPolygons(selectedFloor, selectedBuilding);
          console.log(" 층별 폴리곤 데이터:", data);
          setFloorPolygons(data);
        } catch (error) {
          console.error("층 폴리곤 불러오기 실패:", error);
        }
      }
    };
    loadFloorPolygons();
  }, [selectedBuilding, selectedFloor]);
    
  // 주소를 입력하면 위도와 경도를 반환 // 추후 POI 데이터랑 API 필요
  const geocodeAddress = async (address, setLocation) => {
    if (!address) return;
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${address}`);
      const data = await response.json();
      if (data.length > 0){
        setLocation({latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon)});
       }        
    } catch (error) {
      console.error("Geocoding error: ", error);
    }
  }; 

  // 출발지/도착지가 설정될 때마다 최단 경로 업데이트
  useEffect(() => {
    const getRoute = async () => {
      if (startLocation && endLocation && nodes.length > 0) {

        const startNode = findNearestNode(nodes, startLocation.latitude, startLocation.longitude, "outdoor");
        const endNode = findNearestNode(nodes, endLocation.latitude, endLocation.longitude, "outdoor");

        if (!startNode || !endNode) {
          console.error("출발지 또는 도착지의 가장 가까운 노드를 찾을 수 없습니다.");
          return;
        }

        try {
          const shortestPath = await fetchShortestPath(startNode.node_id, endNode.node_id, "outdoor");

          if (shortestPath.length > 0) {
            // Edge ID 가져오기
            const edgeIds = shortestPath.map(node => node.edge);

            // Edge ID 기반으로 도로 좌표 가져오기
            const edges = await fetchEdgeCoordinates(edgeIds);
            console.log("Edge 좌표 데이터:", edges);

            const convertedEdges = edges.map(edge => ({
              id: edge.id,
              coordinates: edge.coordinates.map(([lng, lat]) => ({
                latitude: lat,
                longitude: lng,
              })),
            }));
            setPath(convertedEdges);
          } else {
            console.error("[ERROR] 최단 경로 없음!");
            setPath([]);
          }
        } catch (error) {
          console.error("최단 경로 요청 오류:", error);
        }
      }
    };
    getRoute();
  }, [startLocation, endLocation, nodes]);


  // 렌더링
  return (
    <View style={styles.container}>
      {/* 출발지 & 도착지 입력 UI */}
      <View style={styles.inputContainer}>
        <Text style={styles.title}>서울시립대학교 캠퍼스 내비게이션</Text>
        <TextInput
          ref={startInputRef}
          style={styles.input}
          placeholder="출발지를 입력하세요"
          value={startText}
          onChangeText={setStartText}
          onFocus={() => startInputRef.current?.focus()} // 터치하면 자동 포커스
          onSubmitEditing={() => {
            geocodeAddress(startText, setStartLocation);
            Keyboard.dismiss();
          }}
          keyboardType="default"
          returnKeyType="done"
        />

        <TextInput
          ref={endInputRef}
          style={styles.input}
          placeholder="도착지를 입력하세요"
          value={endText}
          onChangeText={setEndText}
          onFocus={() => endInputRef.current?.focus()} // 터치하면 자동 포커스
          onSubmitEditing={() => {
            geocodeAddress(endText, setEndLocation);
            Keyboard.dismiss();
          }}
          keyboardType="default"
          returnKeyType="done"
        />
      </View>

      {/* 지도 컴포넌트 */}
      <MapComponent 
        buildingPolygon={buildingPolygon} 
        floorPolygons={floorPolygons}
        selectedBuilding={selectedBuilding} 
        setSelectedBuilding={setSelectedBuilding} 
        selectedFloor={selectedFloor} 
        startLocation={startLocation} 
        endLocation={endLocation} 
        setStartLocation={setStartLocation} 
        setEndLocation={setEndLocation} 
        path = {path}
      />

      
      {/* 촬영된 이미지 표시 */}
      {capturedImage && <Image source={{ uri: capturedImage }} style={styles.image} />}

      {/* 카메라에서 찍은 사진 state에 저장 */}    
      <CameraButton onCapture={setCapturedImage} /> 

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

// 스타일 설정
const styles = StyleSheet.create({
  container: { flex: 1 },
  inputContainer: {
    padding: 10,
    backgroundColor: "white",
    elevation: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
  },
  input: {
    height: 40,
    borderColor: "#ddd",
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 10,
    marginVertical: 5,
  },
});

export default App;