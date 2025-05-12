import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Image,
  FlatList,
  StyleSheet,
  Dimensions,
  Button,
  PermissionsAndroid,
  Platform,
  Text,
} from 'react-native';
import MapView, { Polyline, Circle, Callout, Polygon, Marker } from 'react-native-maps';
import { useRoute } from '@react-navigation/native';
import {
  fetchBuildingPolygons,
  fetchFloorPolygons,
  uploadImageToServer,
  fetchNodes,
  fetchRoadGeometries,
  fetchPlantGeometries,
  fetchSidewalkGeometries,
  fetchStadiumGeometries,  
} from '../services/api';
import FloorSelector from '../components/FloorSelector';
import { launchCamera } from 'react-native-image-picker';
import IndoorLocateButton from '../components/IndoorLocateButton';
import Geolocation from '@react-native-community/geolocation';

const screenHeight = Dimensions.get('window').height;
const screenWidth = Dimensions.get('window').width;
const FIXED_THRESHOLD = 8; // 절대버퍼 최대 반경


// 현재 위치와 다음 위치 간의 방위각 (Heading) 계산
const calculateBearing = (from, to) => {
  const lat1 = from.latitude * Math.PI / 180;
  const lon1 = from.longitude * Math.PI / 180;
  const lat2 = to.latitude * Math.PI / 180;
  const lon2 = to.longitude * Math.PI / 180;
  const dLon = lon2 - lon1;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  let brng = Math.atan2(y, x);
  brng = (brng * 180) / Math.PI;
  return (brng + 360) % 360;
};

const getTurnDirection = (prev, current, next) => {
  const vectorA = {
    x: current.nodeLongitude - prev.nodeLongitude,
    y: current.nodeLatitude - prev.nodeLatitude,
  };
  const vectorB = {
    x: next.nodeLongitude - current.nodeLongitude,
    y: next.nodeLatitude - current.nodeLatitude,
  };

  // 벡터 내적 (cosθ 계산용)
  const dot = vectorA.x * vectorB.x + vectorA.y * vectorB.y;
  const magA = Math.sqrt(vectorA.x ** 2 + vectorA.y ** 2);
  const magB = Math.sqrt(vectorB.x ** 2 + vectorB.y ** 2);
  const cosTheta = dot / (magA * magB);

  // 각도 구하기
  const angle = Math.acos(cosTheta) * (180 / Math.PI);
  console.log('✔️계산 각도:', angle);
  if (angle < 15) return 'straight'; // 15도 이하 차이면 직진으로 간주

  // 외적: 좌/우 판단
  const cross = vectorA.x * vectorB.y - vectorA.y * vectorB.x;
  return cross > 0 ? 'left' : 'right';
};



// 카메라 권한 요청
const requestCameraPermission = async () => {
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.CAMERA,
      {
        title: '카메라 권한 요청',
        message: '사진을 찍기 위해 카메라 접근 권한이 필요합니다.',
        buttonPositive: '확인',
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }
  return true;
};

// 사용자 ~ 이미지 노드 사이의 거리 계산
// Haversine 공식을 사용하여 두 좌표 간의 거리 계산 (GPS 신호로 받기 때문)
const getDistanceInMeters = (coord1, coord2) => {
  const R = 6371e3;
  const φ1 = coord1.latitude * Math.PI / 180;
  const φ2 = coord2.latitude * Math.PI / 180;
  const Δφ = (coord2.latitude - coord1.latitude) * Math.PI / 180;
  const Δλ = (coord2.longitude - coord1.longitude) * Math.PI / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

////////////////////////////////////////
////////////////////////////////////////
const RouteScreen = () => {
  const route = useRoute();
  const { path, nodeImageIds, realviewNode, fromNode, toNode } = route.params;
  const [lastIndoorResult, setLastIndoorResult] = useState(null);
  const initialFloor = Number(realviewNode[0]?.floor ?? 1);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [currentAccuracy, setCurrentAccuracy] = useState(null);
  const [isIndoor, setIsIndoor] = useState(true);
  const [selectedFloor, setSelectedFloor] = useState<string>('1');
  const [FloorPolygons, setFloorPolygons] = useState([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState(null);
  const [buildingPolygons, setBuildingPolygons] = useState([]);
  const [showFloorSelector, setShowFloorSelector] = useState(false);
  const [PredictedNodeId, setPredictedNodeId] = useState<string | null>(null);
  const [PredictedFloorId, setPredictedFloorId] = useState<string | null>(null);
  const [justTransitionedToIndoor, setJustTransitionedToIndoor] = useState(false);
  const flatListRef = useRef(null);
  const mapRef = useRef(null);
  const [mapZoomLevel, setMapZoomLevel] = useState(0);
  const [transitionMessage, setTransitionMessage] = useState<string | null>(null);
  const [bearing, setBearing] = useState(0); // 현재 회전 각도
  const [prevHeading, setPrevHeading] = useState(0);
  const [smoothedLocation, setSmoothedLocation] = useState(null);
  const currentFloorFromImageNode = Number(realviewNode[currentIndex]?.floor ?? 1);
  const lastPredictedFloorRef = useRef<number | null>(null);
  
  const [roadPolygons, setRoadPolygons] = useState<any[]>([]);
  const [plantPolygons, setPlantPolygons] = useState<any[]>([]);
  const [sidewalkPolygons, setSidewalkPolygons] = useState<any[]>([]);
  const [stadiumPolygons, setStadiumPolygons] = useState<any[]>([]);
  
  const HEADING_THRESHOLD = 10; // 최소 회전 변화 각도 (10도 이상일 때만 회전)
  const ALPHA = 0.1; // 부드러운 회전을 위한 EMA 계수
  const SMOOTHING_ALPHA = 0.2; // 위치 필터링 (EMA 필터) 부드러움 정도
  
  const mapStyle = [
    { elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi', stylers: [{ visibility: 'on' }] },
    { featureType: 'transit', stylers: [{ visibility: 'on' }] },
  ];
  const [nodes, setNodes] = useState([]);


  useEffect(() => {
    const loadOutdoorData = async () => {
      try {
        const [roads, plants, sidewalks, stadiums] = await Promise.all([
          fetchRoadGeometries(),
          fetchPlantGeometries(),
          fetchSidewalkGeometries(),
          fetchStadiumGeometries()
        ]);
        setRoadPolygons(roads);
        setPlantPolygons(plants);
        setSidewalkPolygons(sidewalks);
        setStadiumPolygons(stadiums);
      } catch (e) {
        console.error('공간 데이터 로딩 실패:', e);
      }
    };
    loadOutdoorData();
  }, []);
  
  // 현재 노드와 다음 노드를 기반으로 회전(heading) 계산 및 부드러운 전환 적용 (MapView 외부에서 animateCamera에 사용할 값 업데이트)
  // 실내 /실외 전환 감지 및 메시지 설정
  useEffect(() => {
    const currentNode = realviewNode[currentIndex];
    const nextNode = realviewNode[currentIndex + 1];

    if (!currentNode) return;

    // 실내/실외 전환 감지
    if (currentIndex === 0) {
      setIsIndoor(currentNode.type === 'indoor');
    }

    if (nextNode && currentNode.transit === true) {
      if (isIndoor && nextNode.type === 'outdoor') {
        setIsIndoor(false);
        setTransitionMessage('실외에요~ 카메라 자유롭게 해도 돼요~');
      } else if (!isIndoor && nextNode.type === 'indoor') {
        setIsIndoor(true);
        setTransitionMessage('실내에요~ 카메라 정면으로 들어주세요!');
        setJustTransitionedToIndoor(true); // 실내로 들어온 순간!
      }
    }
    
    // 회전 방향 계산
    if (nextNode) {
      const from = {
        latitude: currentNode.nodeLatitude,
        longitude: currentNode.nodeLongitude,
      };
      const rawBearing = calculateBearing(from, {
        latitude: nextNode.nodeLatitude,
        longitude: nextNode.nodeLongitude,
      });
      console.log('✔️ 회전각:', rawBearing);
      let diff = Math.abs(prevHeading - rawBearing);
      if (diff > 180) {
        diff = 360 - diff;
      }

      if (diff >= HEADING_THRESHOLD) {
        let adjustedBearing = rawBearing;
        if (Math.abs(prevHeading - rawBearing) > 180) {
          if (rawBearing < prevHeading) {
            adjustedBearing = rawBearing + 360;
          } else {
            adjustedBearing = rawBearing - 360;
          }
        }
        const smoothHeading = prevHeading * (1 - ALPHA) + adjustedBearing * ALPHA;
        console.log('✔️ 부드러운 회전각:', smoothHeading);
        const normalizedHeading = (smoothHeading + 360) % 360;
        setBearing(rawBearing);
        setPrevHeading(normalizedHeading);
      }
    }
  }, [currentIndex]);

  
    // 실내로 들어온 후, autoStart flag를 한번만 true로 만들고 꺼줍니다
    useEffect(() => {
      if (justTransitionedToIndoor) {
        const timer = setTimeout(() => {
          setJustTransitionedToIndoor(false); // autoStart는 1회만 사용
        }, 8000);
        return () => clearTimeout(timer);
      }
    }, [justTransitionedToIndoor]);

  // transition 메시지 3초 후 삭제
  useEffect(() => {
    if (!transitionMessage) return;
    const timer = setTimeout(() => {
      setTransitionMessage(null);
    }, 3000); //3000ms
    return () => clearTimeout(timer);
  }, [transitionMessage]);

  // 실외인 경우 위치 업데이트
  useEffect(() => {
    let watchId = null;
  
    const fetchInitialLocation = async () => {
      try {
        Geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude, accuracy } = position.coords;
            setCurrentLocation({ latitude, longitude });
            setCurrentAccuracy(accuracy);
          },
          (error) => {
            console.warn('초기 위치 가져오기 실패:', error);
          },
          {
            enableHighAccuracy: true,
            timeout: 5000, // 5초 안에 못 잡으면 실패
            maximumAge: 0, // 캐시 없이 최신 GPS
          }
        );
      } catch (error) {
        console.warn('초기 위치 오류:', error);
      }
    };
  
    if (!isIndoor) { // 실내 -> 실외로 바뀌자마자 getCurrentPosition 호출
      fetchInitialLocation(); // 실외로 나가자마자 한 번만 현재 위치 잡기
      watchId = Geolocation.watchPosition( // EMA 필터링 후 currentLocation 갱신
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          const newLocation = { latitude, longitude };
      
          if (smoothedLocation) {
            // 이전 위치가 있다면 부드럽게 업데이트
            const filteredLatitude = SMOOTHING_ALPHA * newLocation.latitude + (1 - SMOOTHING_ALPHA) * smoothedLocation.latitude;
            const filteredLongitude = SMOOTHING_ALPHA * newLocation.longitude + (1 - SMOOTHING_ALPHA) * smoothedLocation.longitude;
      
            const filteredLocation = { latitude: filteredLatitude, longitude: filteredLongitude };
            setSmoothedLocation(filteredLocation);
            setCurrentLocation(filteredLocation);
          } else {
            // 첫 위치라면 바로 사용
            setSmoothedLocation(newLocation);
            setCurrentLocation(newLocation);
          }
      
          setCurrentAccuracy(accuracy);
        },
        (error) => {
          console.warn('GPS 오류:', error);
        },
        {
          enableHighAccuracy: true,
          distanceFilter: 1,
          interval: 3000,
          fastestInterval: 1000,
        }
      );
    }
  
    return () => {
      if (watchId !== null) {
        Geolocation.clearWatch(watchId);
      }
    };
  }, [isIndoor]);
  
 
  // 전체 노드 리스트 불러옴
  useEffect(() => {
    const loadNodes = async () => {
      const data = await fetchNodes();
      setNodes(data);
    };
    loadNodes();
  }, []);


  // 사진 촬영 및 서버 업로드
  const handleTakePhoto = async () => {
    const granted = await requestCameraPermission();
    if (!granted) return;
    const result = await launchCamera({ mediaType: 'photo', cameraType: 'back', quality: 0.8 });
    if (result.didCancel || !result.assets || !result.assets[0]?.uri) return;
    const uri = result.assets[0].uri;
    const currentEdge = realviewNode[currentIndex];
    const fileName = `${currentEdge.imageName}.jpg`;
    console.log('촬영된 사진 URI:', uri);
    console.log('촬영된 사진 파일명:', fileName);
    await uploadImageToServer(uri, fileName);
  };

  // 층 정보 동기화 및 선택 처리
  useEffect(() => {
    if (realviewNode.length > 0 && realviewNode[currentIndex].floor) {
      setSelectedFloor(realviewNode[currentIndex].floor.toString());
      setShowFloorSelector(true);
    }
  }, [currentIndex]);

  // 층 정보 동기화 및 선택
  useEffect(() => {
    const currentFloor = realviewNode[currentIndex]?.floor;
    if (currentFloor) {
      setSelectedFloor(currentFloor.toString());
      setShowFloorSelector(true);
    } else {
      setSelectedFloor(null);
      setShowFloorSelector(false);
      setSelectedBuildingId(null);
    }
  }, [currentIndex]);

  // 층별 폴리곤 정보 가져오기
  useEffect(() => {
    const loadFloorPolygons = async () => {
      if (selectedBuildingId && selectedFloor) {
        const allPolygons = await fetchFloorPolygons(selectedFloor, selectedBuildingId);
        setFloorPolygons(allPolygons);
      } else {
        setFloorPolygons([]);
      }
    };
    loadFloorPolygons();
  }, [selectedBuildingId, selectedFloor]);

  // 건물 폴리곤 불러오기
  useEffect(() => {
    const loadData = async () => {
      const buildings = await fetchBuildingPolygons();
      setBuildingPolygons(buildings);
      if (realviewNode.length > 0 && realviewNode[currentIndex].buildname) {
        const target = buildings.find(b => b.build_name === realviewNode[currentIndex].buildname);
        if (target) setSelectedBuildingId(target.id);
      }
    };
    loadData();
  }, [currentIndex]);

  // 건물 이름 -> ID 매핑
  useEffect(() => {
    if (realviewNode.length === 0 || !realviewNode[currentIndex]?.buildname) return;
    const currentBuildName = realviewNode[currentIndex].buildname;
    const match = buildingPolygons.find(b => b.build_name === currentBuildName);
    if (match) setSelectedBuildingId(match.id);
  }, [currentIndex, buildingPolygons, path]);

// 수정된 코드 (realviewNode 기준으로 정확하게 전환)
useEffect(() => {
  if (!currentLocation || realviewNode.length === 0) return;


  if (currentAccuracy > FIXED_THRESHOLD) {
    console.log('⛔️ GPS 정밀도 너무 낮아서 위치 반영 안함:', currentAccuracy);
    return;
  }

  for (let i = 0; i < realviewNode.length; i++) {
    const imageNode = realviewNode[i];
    const nodeCoord = {
      latitude: imageNode.nodeLatitude,
      longitude: imageNode.nodeLongitude,
    };

    
    const distance = getDistanceInMeters(currentLocation, nodeCoord);
    if (imageNode.type !== 'outdoor') continue; // ✅ 실외 노드만 검사


    
    if (distance < currentAccuracy) {
      if (i !== currentIndex) {
        setCurrentIndex(i);
        flatListRef.current?.scrollToIndex({ index: i, animated: true });
      }
      break;
    }
  }
}, [currentLocation]);


useEffect(() => {
  const current = realviewNode[currentIndex];
  const next = realviewNode[currentIndex + 1];
  if (!mapRef.current || !current || !next) return;

  const from = {
    latitude: current.nodeLatitude,
    longitude: current.nodeLongitude,
  };
  const to = {
    latitude: next.nodeLatitude,
    longitude: next.nodeLongitude,
  };

  const rawBearing = calculateBearing(from, to);

  // 중간 지점 계산
  const midLat = (from.latitude + to.latitude) / 2;
  const midLng = (from.longitude + to.longitude) / 2;

  // heading 보정
  let shortestTurn = rawBearing - prevHeading;
  if (shortestTurn > 180) shortestTurn -= 360;
  if (shortestTurn < -180) shortestTurn += 360;
  const correctedHeading = (prevHeading + shortestTurn + 360) % 360;

  // 회전 + 중심 이동 동시에!
  mapRef.current.animateCamera(
    {
      center: { latitude: midLat, longitude: midLng },
      heading: correctedHeading,
      pitch: 0,
      zoom: 19.5,
    },
    { duration: 600 }
  );

  setPrevHeading(correctedHeading);
}, [currentIndex]);

  
  
  
  /////////////////////////////////////////
  /////////////////////////////////////////
  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider="google"
        style={styles.map}
        customMapStyle={mapStyle}
        showsUserLocation={false}
        showsBuildings={false}
        onPress={() => setSelectedBuildingId(null)}
        // onRegionChangeComplete에서는 zoom 관련 상태만 업데이트 (회전 로직은 위 useEffect에서 처리)
        onRegionChangeComplete={(region) => {
          setMapZoomLevel(region.latitudeDelta);
        }}
      >
        {path.map((edge) => (
          (!selectedFloor || edge.floor?.toString() === selectedFloor) && (
            <Polyline
              key={edge.id}
              coordinates={edge.coordinates}
              strokeColor="blue"
              strokeWidth={4}
            />
          )
        ))}

 {/* 🛣️ 도로 */}
{roadPolygons.map((feature, i) => {
  try {
    const geo = JSON.parse(feature.geom_json);
    const polygons = geo.type === 'Polygon' ? [geo.coordinates] : geo.coordinates;
    return polygons.map((polygon, j) => (
      <Polygon
        key={`road-${i}-${j}`}
        coordinates={polygon[0].map(([lng, lat]) => ({ latitude: lat, longitude: lng }))}
        fillColor="rgba(128, 128, 128, 0.5)" // 투명도 조절
        strokeColor="#444"
        strokeWidth={1}
        zIndex={1000} // 도로보다 위에 표시

      />
    ));
  } catch (e) {
    console.warn('도로 폴리곤 파싱 실패:', e);
    return null;
  }
})}

{/* 🌳 식생 */}
{plantPolygons.map((feature, i) => {
  try {
    const geo = JSON.parse(feature.geom_json);
    const polygons = geo.type === 'Polygon' ? [geo.coordinates] : geo.coordinates;
    return polygons.map((polygon, j) => (
      <Polygon
        key={`plant-${i}-${j}`}
        coordinates={polygon[0].map(([lng, lat]) => ({ latitude: lat, longitude: lng }))}
        fillColor="rgba(148, 216, 148, 0.77)" // 녹색
        strokeColor="#0a0"
        strokeWidth={1}
        zIndex={1000} // 도로보다 위에 표시

      />
    ));
  } catch (e) {
    console.warn('식생 폴리곤 파싱 실패:', e);
    return null;
  }
})}

{/* 🚶 도보 */}
{sidewalkPolygons.map((feature, i) => {
  try {
    const geo = JSON.parse(feature.geom_json);
    const polygons = geo.type === 'Polygon' ? [geo.coordinates] : geo.coordinates;
    return polygons.map((polygon, j) => (
      <Polygon
        key={`sidewalk-${i}-${j}`}
        coordinates={polygon[0].map(([lng, lat]) => ({ latitude: lat, longitude: lng }))}
        fillColor="rgba(240, 240, 240, 0.7)" // 연회색 + 약간 투명
        strokeColor="#aaa"
        strokeWidth={1}
        zIndex={1} // 도로보다 위에 표시
      />
    ));
  } catch (e) {
    console.warn('도보 폴리곤 파싱 실패:', e);
    return null;
  }
})}

{/* 🏟️ 운동장 */}
{stadiumPolygons.map((feature, i) => {
  try {
    const geo = JSON.parse(feature.geom_json);
    const polygons = geo.type === 'Polygon' ? [geo.coordinates] : geo.coordinates;
    return polygons.map((polygon, j) => (
      <Polygon
        key={`stadium-${i}-${j}`}
        coordinates={polygon[0].map(([lng, lat]) => ({ latitude: lat, longitude: lng }))}
        fillColor="rgba(54, 150, 51, 0.86)" // 파랑
        strokeColor="#4682b4"
        strokeWidth={1}
        zIndex={1000} // 도로보다 위에 표시

      />
    ));
  } catch (e) {
    console.warn('운동장 폴리곤 파싱 실패:', e);
    return null;
  }
})}

        {buildingPolygons.map((feature) => {
          try {
            const geojson = JSON.parse(feature.geom_json);
            const polygons = geojson.type === 'Polygon' ? [geojson.coordinates] : geojson.coordinates;
            return polygons.map((polygon, i) => (
              <Polygon
                key={`polygon-${feature.id}-${i}`}
                coordinates={polygon[0].map(([lng, lat]) => ({ latitude: lat, longitude: lng }))}
                fillColor={
                  selectedBuildingId === feature.id
                  ? "rgba(70, 130, 180, 0.7)" // Steel Blue
                  : "rgba(200, 200, 200, 0.5)" // Light Gray
                }
                zIndex={90} // 도로보다 위에 표시
                strokeColor="transparent"
                strokeWidth={0}
                tappable={true}
                onPress={() => setSelectedBuildingId(feature.id)}
              />
            ));
          } catch (err) {
            console.warn('GeoJSON 파싱 실패:', err);
            return null;
          }
        })}



        {realviewNode
          .filter(node => (node.floor ?? null) === (selectedFloor ?? null))
          .map((node, i) => (
            <Circle
              key={`realview-node-${i}`}
              center={{ latitude: node.nodeLatitude, longitude: node.nodeLongitude }}
              radius={0.5}
              strokeColor={node.imageName === realviewNode[currentIndex]?.imageName ? 'cyan' : 'gray'}
              fillColor={node.imageName === realviewNode[currentIndex]?.imageName ? 'cyan' : 'gray'}
              onPress={() => {
                setCurrentIndex(i);
              }}
            />
          ))
        }

        {currentLocation && !isIndoor && currentAccuracy && (
          <Circle
            center={currentLocation}
            radius={currentAccuracy}
            strokeColor="rgba(0,200,0,0.6)"
            fillColor="rgba(0,200,0,0.15)"
          />
        )}

{fromNode && (
  <Marker
    coordinate={{ latitude: fromNode.latitude, longitude: fromNode.longitude }}
    pinColor="green"
  >
    <Callout><Text>출발</Text></Callout>
  </Marker>
)}

{toNode && (
  <Marker
    coordinate={{ latitude: toNode.latitude, longitude: toNode.longitude }}
    pinColor="red"
  >
    <Callout><Text>도착</Text></Callout>
  </Marker>
)}


        {/* 층 폴리곤 */}
        {FloorPolygons.map((feature, index) => {
          try {
            const geojson = JSON.parse(feature.geom_json);
            const polygons = geojson.type === 'Polygon' ? [geojson.coordinates] : geojson.coordinates;
            return polygons.map((polygon, i) => {
              const coords = polygon[0].map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
              const latSum = coords.reduce((sum, c) => sum + c.latitude, 0);
              const lngSum = coords.reduce((sum, c) => sum + c.longitude, 0);
              const center = {
                latitude: latSum / coords.length,
                longitude: lngSum / coords.length,
              };

              return (
                <React.Fragment key={`floor-${index}-${i}`}>
                  <Polygon
                    coordinates={coords}
                    fillColor="rgba(0, 153, 255, 0.3)"
                    strokeColor="black"
                    strokeWidth={2}
                  />
                  {feature.lect_num && mapZoomLevel < 0.003 && (
                    <Marker coordinate={center}>
                      <View style={styles.lectNumBadge}>
                        <Text style={styles.lectNumText}>
                          {(() => {
                            const match = feature.lect_num.match(/(\d+호)/);
                            return match ? match[1] : feature.lect_num;
                          })()}
                        </Text>
                      </View>
                    </Marker>
                  )}
                </React.Fragment>
              );
            });
          } catch {
            return null;
          }
        })}
      </MapView>

      {showFloorSelector && (
        <View style={styles.floorSelectorWrapper}>
          <FloorSelector
            selectedFloor={selectedFloor}
            setSelectedFloor={setSelectedFloor}
            selectedBuildingId={selectedBuildingId}
          />
        </View>
      )}

      {transitionMessage && (
        <View style={styles.resultBox}>
          <Text style={styles.resultText}>{transitionMessage}</Text>
        </View>
      )}

      <View style={styles.imageListContainer}>
        <FlatList
          ref={flatListRef}
          data={realviewNode}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={true}
          keyExtractor={(item, index) =>
            `${item.nodeLatitude}-${item.nodeLongitude}-${index}`
          }
          onMomentumScrollEnd={(e) => {
            const index = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
            setCurrentIndex(index);
          }}
          renderItem={({ item }) => (
            <Image
              source={{
                uri: `http://3.39.165.203:3000/images/${item.imageName}.jpg`,
              }}
              style={[styles.image, { width: screenWidth, height: '100%' }]}
              resizeMode="cover"
            />
          )}
        />
      </View>
      {(() => {
        const direction =
          currentIndex > 0 && currentIndex < realviewNode.length -2
            ? getTurnDirection(
                realviewNode[currentIndex],
                realviewNode[currentIndex +1],
                realviewNode[currentIndex + 2]
              )
            : null;

        return direction && (
          <View style={styles.directionBox}>
          <Image
            source={
              direction === 'left'
                ? require('../../assets/arrow_left.png')
                : direction === 'right'
                ? require('../../assets/arrow_right.png')
                : require('../../assets/arrow_straight.png')
            }
            style={styles.directionIcon}
          />
        </View>
      );
      })()}
      
      <View style={styles.buttonWrapper}>
        <Button title="📸(피드백)" onPress={handleTakePhoto} />
      </View>

      <View style={styles.indoorButtonWrapper}>
        <IndoorLocateButton
          doortype={isIndoor ? 'indoor' : 'outdoor'}
          initialFloor={currentFloorFromImageNode}
          autoStart={justTransitionedToIndoor}
          buildingName = {realviewNode[currentIndex].buildname}
          onResult={(result) => {
const predNodeId = result.result.predicted_class;
const predFloor = result.result.estimated_floor;

// 1. 예측된 노드 ID로 먼저 찾는다.
let matchIndex = realviewNode.findIndex(n => n.nodeId === predNodeId);

if (matchIndex !== -1) {
  // ✅ 예측 노드로 바로 이동
  setCurrentIndex(matchIndex);
  flatListRef.current?.scrollToIndex({ index: matchIndex, animated: true });

  // 예측된 층수가 이전과 다르면 업데이트
  if (predFloor !== lastPredictedFloorRef.current) {
    lastPredictedFloorRef.current = predFloor;
  }
} else if (predFloor !== lastPredictedFloorRef.current) {
  // ✅ 층 전환이 "처음 감지"됐을 때만 첫 노드로 이동
  const fallbackIndex = realviewNode.findIndex(
    (n) => Number(n.floor) === Number(predFloor)
  );
  if (fallbackIndex !== -1) {
    setCurrentIndex(fallbackIndex);
    flatListRef.current?.scrollToIndex({ index: fallbackIndex, animated: true });
  }
  lastPredictedFloorRef.current = predFloor;
}


          }
        }
          
        />
      </View>
    </View>
  );
};

export default RouteScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { height: screenHeight * 0.5 },
  imageListContainer: {
    height: screenHeight * 0.5,
    backgroundColor: '#f5f5f5',
    paddingVertical: 0.5,
  },
  directionBox: {
    position: 'absolute',
    bottom: '40%',
    left: '1%',
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.5)', // 반투명 배경
    borderRadius: 12,
    zIndex: 9999,
  },
  
  directionIcon: {
    width: 48,
    height: 48,
    opacity: 0.95,
  },  
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover', // 또는 stretch
    marginHorizontal: 0,
    borderRadius: 0,
    backgroundColor: '#ddd',
  },
  floorSelectorWrapper: {
    position: 'absolute',
    top: 210,
    right: 10,
    zIndex: 1000,
    elevation: 10,
  },
  buttonWrapper: {
    padding: 0,
    backgroundColor: '#f0f0f0',
    position: 'absolute',
    bottom: 1,
    right: 1,
    borderRadius: 10,
  },
  indoorButtonWrapper: {
    position: 'absolute',
    bottom: -70,
    left: 50,
    zIndex: 1999,
  },
  resultBox: {
    position: 'absolute',
    top: 40,
    left: 20,
    right: 20,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    zIndex: 9999,
    elevation: 10,
    pointerEvents: 'box-none',
  },
  resultText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    lineHeight: 22,
  },
  lectNumBadge: {
    backgroundColor: '#9BCBEB',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lectNumText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#333',
  },
});
