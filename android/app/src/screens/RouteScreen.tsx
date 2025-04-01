// 틀릴리가 없다
// 틀리면 기필코 자살할 것
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Image,
  FlatList,
  StyleSheet,
  Dimensions,
  Text,
  ScrollView,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import MapView, { Polyline, Circle, Polygon } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import { useRoute } from '@react-navigation/native';
import { fetchBuildingPolygons, fetchFloorPolygons } from '../services/api';
import FloorSelector from '../components/FloorSelector';

const screenHeight = Dimensions.get('window').height;
const screenWidth = Dimensions.get('window').width;
const FIXED_THRESHOLD = 5; // 고정 버퍼 반경 (5m)

// 사용자 ~ 노드까지 거리
// 하버사인 공식
// 하버사인을 쓰는 이유는 지금 우리가 받는 위치가 위도와 경도로 나타낸 GPS 좌표를 기반으로 했기 때문이다 이 우매한 짐승들아!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
const getDistanceInMeters = (coord1, coord2) => {
  const R = 6371e3;
  const φ1 = coord1.latitude * Math.PI / 180;
  const φ2 = coord2.latitude * Math.PI / 180;
  const Δφ = (coord2.latitude - coord1.latitude) * Math.PI / 180;
  const Δλ = (coord2.longitude - coord1.longitude) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// 위치 권한 요청
const requestLocationPermission = async () => {
  if (Platform.OS === 'android') {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: "위치 권한 요청",
          message: "이 앱은 위치 정보를 필요로 합니다.",
          buttonNeutral: "나중에",
          buttonNegative: "거부",
          buttonPositive: "허용",
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.warn("위치 권한 요청 오류:", err);
      return false;
    }
  } else {
    return true;
  }
};

const RouteScreen = () => {
  const route = useRoute();
  const { path, nodeImageIds } = route.params;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentLocation, setCurrentLocation] = useState(null); // 현재 GPS 좌표
  const [currentAccuracy, setCurrentAccuracy] = useState(null); // 현재 GPS 정밀도
  const [accuracyHistory, setAccuracyHistory] = useState([]);
  const [isIndoor, setIsIndoor] = useState(true); //실내외 여부
  const [logMessages, setLogMessages] = useState<string[]>([]);

  const flatListRef = useRef(null);
  const mapRef = useRef(null);
  const [selectedFloor, setSelectedFloor] = useState<string>('1');

  const [FloorPolygons, setFloorPolygons] = useState([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState(null);
  const [buildingPolygons, setBuildingPolygons] = useState([]);

  const mapStyle = [
    { elementType: "labels", stylers: [{ visibility: "off" }] },
    { featureType: "poi", stylers: [{ visibility: "on" }] },
    { featureType: "transit", stylers: [{ visibility: "on" }] },
  ];


    useEffect(() => {
      const loadFloorPolygons = async () => {
        if (selectedBuildingId) {
          try {
            const data = await fetchFloorPolygons(selectedFloor, selectedBuildingId);
            setFloorPolygons(data);
          } catch (error) {
            console.error('층 폴리곤 불러오기 실패:', error);
          }
        }
      };
      loadFloorPolygons();
    }, [selectedBuildingId, selectedFloor]);  

  useEffect(() => {
    const loadData = async () => {
      const [buildings] = await Promise.all([
        fetchBuildingPolygons(),
      ]);
      setBuildingPolygons(buildings);
    };
    loadData();
  }, []);  

  // 위치 권한 확인 후, 0.5초마다 위치 수신 요청
  // 성공시: 현재 좌표 & 정밀도 상태 갱신, 실내/실외 여부 업데이트
  // 실패시: 정밀도 null로 설정
  useEffect(() => {
    const init = async () => {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) return;

      const intervalId = setInterval(() => {
        Geolocation.getCurrentPosition(
          (pos) => {
            const { latitude, longitude, accuracy } = pos.coords;
            const accText = typeof accuracy === 'number' && !isNaN(accuracy)
              ? `${accuracy.toFixed(1)}m`
              : 'N/A';

            const log = `✅ 위치 수신됨: lat=${latitude.toFixed(6)}, lng=${longitude.toFixed(6)}, accuracy=${accText}`;
            console.log(log);
            setLogMessages((prev) => [log, ...prev.slice(0, 2)]);
            setCurrentLocation({ latitude, longitude });
            setCurrentAccuracy(accuracy);

            setAccuracyHistory((prev) => {
              const updated = [...prev.slice(-9), accuracy];
              const accurateCount = updated.filter(a => a < 10).length;
              setIsIndoor(accurateCount < 10);
              return updated;
            });
          },
          (err) => {
            const errMessage = typeof err?.message === 'string' ? err.message : 'Unknown error';
            const log = `❌ 위치 수신 실패 - ${errMessage}`;
            console.log(log);
            setLogMessages((prev) => [log, ...prev.slice(0, 2)]);
            setCurrentAccuracy(null);
          },
          { enableHighAccuracy: true, timeout: 1000, maximumAge: 0 }
        );
      }, 500); //0.5초마다 GPS 요청 (500ms)

      return () => clearInterval(intervalId);
    };

    init();
  }, []);

  // 노드 자동 전환 로직
  // 고정 버퍼 반경 5m 안에 노드가 들어오면 해당 노드의 사진으로 전환
  useEffect(() => {
    if (!currentLocation || path.length === 0) return;

    for (let i = 0; i < path.length; i++) {
      const coord = path[i].coordinates[0];
      const distance = getDistanceInMeters(currentLocation, coord);
      
      // 고정 버퍼 반경 안에 노드가 들어오면 사진 전환
      if (distance < FIXED_THRESHOLD) {
        if (nodeImageIds[i] !== nodeImageIds[currentIndex]) {
          setCurrentIndex(i);
          flatListRef.current?.scrollToIndex({ index: i, animated: true });
        }
        break;
      }
    }
  }, [currentLocation]);

  // 지도 중심 이동 로직
  // 사진이 전환될 때, 현재 노드의 위치로 지도 중심 이동 (지도 화면이 자연스럽게)
  useEffect(() => {
    const currentEdge = path[currentIndex];
    if (currentEdge?.coordinates?.length > 0) {
      const { latitude, longitude } = currentEdge.coordinates[0];
      mapRef.current?.animateToRegion({
        latitude,
        longitude,
        latitudeDelta: 0.001,
        longitudeDelta: 0.001
      });
    }
  }, [currentIndex]);

  ////////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////

  return (
    <View style={styles.container}>
      
      <MapView
      
        ref={mapRef}
        style={styles.map}
        customMapStyle={mapStyle}
        showsUserLocation={false}
        showsBuildings={false}
        onPress={() => setSelectedBuildingId(null)}
      >
        {path.map((edge) => (
          <Polyline // 최단 경로 시각화
            key={edge.id}
            coordinates={edge.coordinates} 
            strokeColor="blue"
            strokeWidth={4}
          />
        ))}

        {buildingPolygons.map((feature) => {
          try {
            const geojson = JSON.parse(feature.geom_json);
            const polygons = geojson.type === 'Polygon' ? [geojson.coordinates] : geojson.coordinates;
            return polygons.map((polygon, i) => (
              <Polygon
                key={`polygon-${feature.id}-${i}`}
                coordinates={polygon[0].map(([lng, lat]) => ({ latitude: lat, longitude: lng }))}
                fillColor={selectedBuildingId === feature.id ? 'rgba(0,0,255,0.6)' : 'rgba(100,100,100,0.4)'}
                strokeColor="transparent"
                strokeWidth={0}
                tappable
                onPress={() => setSelectedBuildingId(feature.id)}
              />
            ));
          } catch {
            return null;
          }
        })}

        {path.map((edge, i) => (
          <Circle // 경로에 존재하는 노드 표시
            key={`circle-${edge.id}`}
            center={edge.coordinates[1]}
            radius={1}
            strokeColor={i === currentIndex ? 'cyan' : 'gray'} // 현재노드:cyan , 다른노드:gray
            fillColor={i === currentIndex ? 'cyan' : 'gray'}
          />
        ))}

        {currentLocation && !isIndoor && currentAccuracy && ( // 실외일 때만
          <Circle // 정밀도 버퍼 -> 지도 상에서 표시되는 버퍼
            center={currentLocation}
            radius={currentAccuracy}
            strokeColor="rgba(0,200,0,0.6)"
            fillColor="rgba(0,200,0,0.15)"
          />
        )}
 {/* 층 폴리곤 */}
        {FloorPolygons.map((feature, index) => {
          try {
            const geojson = JSON.parse(feature.geom_json);
            const polygons = geojson.type === 'Polygon' ? [geojson.coordinates] : geojson.coordinates;
            return polygons.map((polygon, i) => (
              <Polygon
                key={`floor-${index}-${i}`}
                coordinates={polygon[0].map(([lng, lat]) => ({ latitude: lat, longitude: lng }))}
                fillColor="rgba(0, 255, 0, 0.3)"
                strokeColor="black"
                strokeWidth={2}
              />
            ));
          } catch {
            return null;
          }
        })}   

      </MapView>
      {selectedBuildingId !== null && (
  <View style={styles.floorSelectorWrapper}>
    <FloorSelector
      selectedFloor={selectedFloor}
      setSelectedFloor={setSelectedFloor}
    />
  </View>
)}


      {/* 실외/실내 상태 및 정확도 텍스트 */}
      <View style={styles.statusBox}>
        <Text style={{ fontSize: 14, color: isIndoor ? 'red' : 'green' }}>
          {isIndoor ? '🔴 실내로 추정됨' : '🟢 실외로 추정됨'}
        </Text>
        <Text style={{ fontSize: 12, marginTop: 2 }}>
           정밀도: {
            currentAccuracy !== null && !isNaN(currentAccuracy)
              ? `${currentAccuracy.toFixed(1)} m`
              : 'N/A'
          }
        </Text>
      </View>

          
      {/* GPS 수신 로그 출력 */}
      <View style={styles.logBox}>
        <ScrollView>
          {logMessages.map((msg, idx) => (
            <Text key={idx} style={styles.logText}>{msg}</Text>
          ))}
        </ScrollView>
      </View>

      {/* 스트리트뷰 이미지 리스트 */}
      <View style={styles.imageListContainer}>
        <FlatList
          ref={flatListRef}
          data={nodeImageIds}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item}
          onMomentumScrollEnd={(e) => {
            const index = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
            setCurrentIndex(index);
          }}
          renderItem={({ item }) => (
            <Image
              source={{ uri: `http://15.165.159.29:3000/images/${item}.jpg` }}
              style={[styles.image, { width: screenWidth - 40 }]}
              resizeMode="contain"
            />
          )}
        />      
      </View>
    </View>
  );
};

export default RouteScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { height: screenHeight * 0.6 },
  imageListContainer: {
    height: screenHeight * 0.4,
    backgroundColor: '#f5f5f5',
    paddingVertical: 10,
  },
  image: {
    width: '100%',
    aspectRatio: 1.5,
    marginHorizontal: 20,
    borderRadius: 10,
    backgroundColor: '#ddd',
  },
  statusBox: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'white',
    padding: 6,
    borderRadius: 6,
    elevation: 3,
  },
  logBox: {
    position: 'absolute',
    top: 60,
    left: 10,
    right: 10,
    maxHeight: 60,
    backgroundColor: 'rgba(255,255,255,0.9)',
    padding: 6,
    borderRadius: 6,
  },
  logText: {
    fontSize: 11,
    color: '#333',
    marginBottom: 2,
  },
  floorSelectorWrapper: {
    position: 'absolute',
    top: 130, // 상황 맞게 조정
    right: 10,
    zIndex: 1000,  // 무조건 맨 위에!
    elevation: 10, // Android에서도 위에 보이게
  },  
});
