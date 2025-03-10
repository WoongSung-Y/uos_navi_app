import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import MapView, { Marker, Polygon, Polyline } from 'react-native-maps';
import { Menu, Provider } from 'react-native-paper';
import { fetchFloorPolygons, fetchShortestPath, fetchNodes, fetchEdgeCoordinates } from '../services/api';
import { findNearestNode } from '../utils/findNearestNode';

const MapComponent = ({ 
  buildingPolygon, 
  selectedBuilding, 
  setSelectedBuilding, 
  selectedFloor,
  startLocation, 
  endLocation, 
  setStartLocation, 
  setEndLocation 
}: any) => {
  const [floorPolygons, setFloorPolygons] = useState<any[]>([]);
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [selectedCoords, setSelectedCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [path, setPath] = useState<any[]>([]);
  const [nodes, setNodes] = useState<any[]>([]);
  const mapRef = useRef<MapView>(null);

  // 선택된 건물과 층을 서버 DB에서 불러와서
  // floorPolygons state에 저장
  useEffect(() => {
    const loadFloorPolygons = async () => {
      if (selectedBuilding) {
        const data = await fetchFloorPolygons(selectedFloor, selectedBuilding);
        setFloorPolygons(data);
      }
    };
    loadFloorPolygons();
  }, [selectedBuilding, selectedFloor]);

  // 노드 데이터를 서버 DB에서 불러와서
  // nodes state에 저장
  useEffect(() => {
    const getNodes = async () => {
      const data = await fetchNodes();
      setNodes(data);
    };
    getNodes();
  }, []);


  // 최단 경로 계산
  useEffect(() => {
    const getRoute = async () => {
      if (startLocation && endLocation && nodes.length > 0) {
        console.log("📡 출발지 & 도착지 GPS 좌표:", startLocation, "→", endLocation);
        
        // 시작, 출발 노드 선택
        const startNode = findNearestNode(nodes, startLocation.latitude, startLocation.longitude, 'outdoor');
        const endNode = findNearestNode(nodes, endLocation.latitude, endLocation.longitude, 'outdoor');
        
        if (!startNode || !endNode) {
          console.error("❌ 출발지 또는 도착지의 가장 가까운 노드를 찾을 수 없습니다.");
          return;
        }
    
        console.log(`🚀 출발 노드: ID=${startNode.node_id}, 위도=${startNode.latitude}, 경도=${startNode.longitude}`);
        console.log(`🏁 도착 노드: ID=${endNode.node_id}, 위도=${endNode.latitude}, 경도=${endNode.longitude}`);
    
        // 최단 경로 계산
        // fetchShorttestPath에 출발, 도착, type 요청
        const shortestPath = await fetchShortestPath(startNode.node_id, endNode.node_id, 'outdoor');
        if (shortestPath.length === 0) {
          console.error("⚠️ [ERROR] 최단 경로가 없음!");
          return;
        }
    
        console.log("📍 최단 경로 데이터:", JSON.stringify(shortestPath, null, 2));
    
        // 최단경로에서 EdgeID(링크 ID) 추출
        // EdgeID: 도로 네트워크에서 연결된 길
        const edgeIds = shortestPath.map(node => node.edge);
        console.log("📍 Edge ID 목록:", edgeIds);
    
        // EdgeID에 해당하는 링크 데이터 가져오기
        const edges = await fetchEdgeCoordinates(edgeIds);
        console.log("📡 [DEBUG] edges 데이터 (JSON 전체 출력):", JSON.stringify(edges, null, 2));
        
        // 링크 데이터로 최단경로를 Polyline으로 생성
        const convertedEdges = edges.map((edge, index) => {
          if (!edge.coordinates || edge.coordinates.length === 0) {
            console.error(`⚠️ [ERROR] Edge ID ${edge.id}의 coordinates 데이터가 없음!`);
            return null;
          }
        
          return {
            id: edge.id,
            coordinates: edge.coordinates.map(coord => ({
              latitude: coord[1], // 위도
              longitude: coord[0]  // 경도
            }))
          };
        }).filter(Boolean); // null 제거
        
        //디버깅 로그 추가
        console.log("📡 [DEBUG] 변환된 Polyline 경로:", JSON.stringify(convertedEdges, null, 2));
        
        if (convertedEdges.length === 0) {
          console.error("⚠️ [ERROR] 변환된 Polyline 데이터가 비어 있음!");
        }
        
        // 최종 polyline 데이터를 setPath 함수를 통해 path state에 저장
        setPath(convertedEdges);
      }
    };
    
    getRoute(); // getRoute 함수 실행
  }, [startLocation, endLocation, nodes]); // 의존성 배열: startLocation, endLocation, nodes가 변경될 때마다 실행됨
  // 즉, 새로운 출발지 또는 도착지가 설정되거나, 노드 데이터가 업데이트 될 때마다 getRoute가 다시 실행됨

  // 지도 길게 눌렀을 때의 이벤트 핸들러 함수 handleLongPress (비동기함수)
  // event 객체를 매개변수로 받아, 해당 위치 정보 활용 
  const handleLongPress = async (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate; // 길게 누른 위치의 GPS 좌표 가져옴
    setSelectedCoords({ latitude, longitude }); // 선택된 좌표를 selectedCoords state에 저장

    console.log("📍 길게 눌린 위치 (위경도):", latitude, longitude);

    // 사용자가 길게 누른곳에 '메뉴를 표시하는 UI'를 배치하기 위함
    // 지도 참조 객체(mapRef.Current)가 존재 여부
    // 지도와 상호작용 가능 여부 체크
    if (mapRef.current) {
      try {
        // pointForCoordinate: 지도 상의 GPS 좌표를 화면 좌표(픽셀 좌표)로 변환하는 React 내장 메서드
        // 변환된 화면 좌표를 point에 저장하고, setMenuPosition 함수를 통해 menuPosition state에 저장
        const point = await mapRef.current.pointForCoordinate({ latitude, longitude });
        console.log("📱 변환된 화면 좌표 (pointForCoordinate):", point);
        setMenuPosition({ x: point.x, y: point.y });
        setMenuVisible(true);
      } catch (error) {
        console.error("🚨 좌표 변환 중 오류 발생:", error);
      }
    }
  };

  // 길게 누른 위치 출발지로 설정
  // 메뉴화면 닫기
  const setAsStartLocation = () => {
    if (selectedCoords) {
      setStartLocation(selectedCoords);
      setMenuVisible(false);
    }
  };
 
  // 길게 누른 위치 도착지로 설정
  // 메뉴화면 닫기
  const setAsEndLocation = () => {
    if (selectedCoords) {
      setEndLocation(selectedCoords);
      setMenuVisible(false);
    }
  };

  return (
    <Provider>
      <View style={styles.container}>
        <MapView // 지도(MapView)를 렌더링하는 핵심 컴포넌트
          ref={mapRef} // mapRef를 참조로 지정하여, 외부에서 지도 제어 가능
          style={styles.map}
          initialRegion={{ // 초기 지도 중심 및 줌 레벨 설정
            latitude: 37.583738,
            longitude: 127.058393,
            latitudeDelta: 0.007,
            longitudeDelta: 0.007,
          }}
          onLongPress={handleLongPress} // 길게 눌렀을 때, 이벤트 핸들러 함수 handleLongPress 호출
        >
          {/***  건물 polygon 호출 및 렌더링 ***/}
          {buildingPolygon.map((feature: any, index: number) => { // buildingPolygon 배열을 반복하며, 각 건물 폴리곤을 지도에 표시
            try {
              const geojson = JSON.parse(feature.geom_json); //feature.geom_json을 JSON.parse하여 geojson에 저장
              // Polygon 타입이면, 좌표 배열을 하나의 리스트로 만듦
              // Polygon 타입이 아니면, 여러개의 폴리곤을 렌더링하도록 변환
              const polygons = geojson.type === 'Polygon' ? [geojson.coordinates] : geojson.coordinates;

              // 폴리곤의 lng, lat 갓을 latitude, longitude로 변환하여 coordinates에 저장 
              return polygons.map((polygon: any, i: number) => {
                const coords = polygon[0].map(([lng, lat]: [number, number]) => ({
                  latitude: lat,
                  longitude: lng,
                }));

                // 건물 폴리곤 렌더링 
                return (
                  <Polygon
                    key={`${index}-${i}`}
                    coordinates={coords}
                    // 선택된 건물: 파란색, 선택되지 않은 건물: 빨간색
                    fillColor={selectedBuilding === feature.id ? 'rgba(0, 0, 255, 0.3)' : 'rgba(255, 0, 0, 0.3)'}
                    strokeColor="black"
                    strokeWidth={2}
                    tappable // 사용자가 건물 폴리곤을 클릭할 수 있도록 설정
                    onPress={() => setSelectedBuilding(feature.id)} // 건물 폴리곤을 클릭했을 때, setSelectedBuilding 함수 호출
                  />
                );
              });
            } catch (error) {
              console.error(`🚨 폴리곤 렌더링 오류 (건물 ID: ${feature.id}):`, error);
            }
            return null;
          })}

          {/*** 층 polygon 호출 및 렌더링  ***/}
          {floorPolygons.map((feature: any, index: number) => { //feature: 층, index: 현재 반복되는 층의 인덱스
            try {
              const geojson = JSON.parse(feature.geom_json);
              const polygons = geojson.type === 'Polygon' ? [geojson.coordinates] : geojson.coordinates;
              // 각 폴리곤을 개별 polygon 컴포넌트로 변환
              return polygons.map((polygon: any, i: number) => (
                <Polygon // 층 polygon 생성
                  key={`floor-${index}-${i}`} // React의 리스트 키 값 설정
                  coordinates={polygon[0].map(([lng, lat]: [number, number]) => ({
                    latitude: lat,
                    longitude: lng,
                  }))}
                  fillColor="rgba(0, 255, 0, 0.3)"
                  strokeColor="black"
                  strokeWidth={2}
                />
              ));
            } catch (error) {
              console.error(`🚨 층 폴리곤 렌더링 오류 (층 ID: ${feature.id}):`, error);
            }
            return null;
          })}


          {/*** 출발지 & 도착지 마커 ***/}
          {startLocation && (
            <Marker coordinate={startLocation} title="출발지" pinColor="blue" />
          )}
          {endLocation && (
            <Marker coordinate={endLocation} title="도착지" pinColor="red" />
          )}


          {/***  최단 경로 가시화(polyline) ***/}
          {path.map((edge, index) => (
  <Polyline
    key={edge.id || index}  // ID가 없으면 인덱스 사용
    coordinates={edge.coordinates}
    strokeWidth={5}
    strokeColor="#00BFFF"
  />
))}

        </MapView>

        {/*** 출발, 도착지 선택 메뉴 렌더링 ***/} 
        {menuVisible && menuPosition && ( // handleLongPress 상황에서만 렌더링
          <View style={{ position: 'absolute', left: menuPosition.x, top: menuPosition.y }}>
            {console.log("📱 메뉴 위치 (픽셀):", menuPosition.x, menuPosition.y)}

            <Menu
              visible={menuVisible}
              onDismiss={() => setMenuVisible(false)}
              anchor={<View style={{ width: 1, height: 1 }} />}
            >
              <Menu.Item onPress={setAsStartLocation} title="출발지로 설정" />
              <Menu.Item onPress={setAsEndLocation} title="도착지로 설정" />
            </Menu>
          </View>
        )}
      </View>
    </Provider>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
});

export default MapComponent;
