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

const screenHeight = Dimensions.get('window').height;
const screenWidth = Dimensions.get('window').width;

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
  const [currentLocation, setCurrentLocation] = useState(null);
  const [currentAccuracy, setCurrentAccuracy] = useState(null);
  const [accuracyHistory, setAccuracyHistory] = useState([]);
  const [isIndoor, setIsIndoor] = useState(true);
  const [logMessages, setLogMessages] = useState<string[]>([]);

  const flatListRef = useRef(null);
  const mapRef = useRef(null);

  const [FloorPolygons, setFloorPolygons] = useState([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState(null);
  const [buildingPolygons, setBuildingPolygons] = useState([]);

  const mapStyle = [
    { elementType: "labels", stylers: [{ visibility: "off" }] },
    { featureType: "poi", stylers: [{ visibility: "on" }] },
    { featureType: "transit", stylers: [{ visibility: "on" }] },
  ];

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
              : 'NaN';

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
            const log = `❌ 위치 수신 실패 (NaN) - ${errMessage}`;
            console.log(log);
            setLogMessages((prev) => [log, ...prev.slice(0, 2)]);
            setCurrentAccuracy(null);

            // 🔥 수신 실패 시에도 accuracyHistory 갱신
            setAccuracyHistory((prev) => {
              const updated = [...prev.slice(-9), NaN];
              const accurateCount = updated.filter(a => a < 10).length;
              setIsIndoor(accurateCount < 10);
              return updated;
            });
          },
          { enableHighAccuracy: true, timeout: 1000, maximumAge: 0 }
        );
      }, 500);

      return () => clearInterval(intervalId);
    };

    init();

    const loadPolygons = async () => {
      const buildings = await fetchBuildingPolygons();
      setBuildingPolygons(buildings);
      const allFloors = [];
      for (const b of buildings) {
        if (typeof b.id !== 'number') continue;
        try {
          const floor = await fetchFloorPolygons('1', b.id);
          allFloors.push(...floor);
        } catch {}
      }
      setFloorPolygons(allFloors);
    };

    loadPolygons();
  }, []);
  useEffect(() => {
    if (!currentLocation || path.length === 0 || !currentAccuracy || isNaN(currentAccuracy)) return;

    for (let i = 0; i < path.length; i++) {
      const coord = path[i].coordinates[0];
      const distance = getDistanceInMeters(currentLocation, coord);
      if (distance < currentAccuracy) {
        if (nodeImageIds[i] !== nodeImageIds[currentIndex]) {
          setCurrentIndex(i);
          flatListRef.current?.scrollToIndex({ index: i, animated: true });
        }
        break;
      }
    }
  }, [currentLocation]);

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

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        customMapStyle={mapStyle}
        showsUserLocation={false}
        showsBuildings={false}
      >
        {path.map((edge) => (
          <Polyline
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

        {path.map((edge, i) => (
          <Circle
            key={`circle-${edge.id}`}
            center={edge.coordinates[0]}
            radius={1}
            strokeColor={i === currentIndex ? 'cyan' : 'gray'}
            fillColor={i === currentIndex ? 'cyan' : 'gray'}
          />
        ))}

        {currentLocation && !isIndoor && currentAccuracy && (
          <Circle
            center={currentLocation}
            radius={currentAccuracy}
            strokeColor="rgba(0,200,0,0.6)"
            fillColor="rgba(0,200,0,0.15)"
          />
        )}
      </MapView>

      {/* 실외/실내 상태 및 정확도 텍스트 */}
      <View style={styles.statusBox}>
        <Text style={{ fontSize: 14, color: isIndoor ? 'red' : 'green' }}>
          {isIndoor ? '🔴 실내로 추정됨' : '🟢 실외로 추정됨'}
        </Text>
        <Text style={{ fontSize: 12, marginTop: 2 }}>
          📏 정밀도: {
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
              resizeMode="cover"
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
  map: { height: screenHeight * 0.4 },
  imageListContainer: {
    height: screenHeight * 0.4,
    backgroundColor: '#f5f5f5',
    paddingVertical: 10,
  },
  image: {
    height: '100%',
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
});
