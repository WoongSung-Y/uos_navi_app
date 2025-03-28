import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Image,
  FlatList,
  StyleSheet,
  Dimensions,
  Text,
} from 'react-native';
import MapView, { Polyline, Circle, Polygon } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import { useRoute } from '@react-navigation/native';
import { fetchBuildingPolygons, fetchFloorPolygons } from '../services/api';

const screenHeight = Dimensions.get('window').height;
const screenWidth = Dimensions.get('window').width;

const getDistanceInMeters = (coord1: Coordinate, coord2: Coordinate) => {
  const R = 6371e3;
  const φ1 = coord1.latitude * Math.PI / 180;
  const φ2 = coord2.latitude * Math.PI / 180;
  const Δφ = (coord2.latitude - coord1.latitude) * Math.PI / 180;
  const Δλ = (coord2.longitude - coord1.longitude) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

const RouteScreen = () => {
  const route = useRoute();
  const { path, nodeImageIds } = route.params as {
    path: { id: string; coordinates: Coordinate[] }[];
    nodeImageIds: string[];
  };

  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentLocation, setCurrentLocation] = useState<Coordinate | null>(null);
  const [accuracyDisplay, setAccuracyDisplay] = useState<number | null>(null);
  const [pingCountDisplay, setPingCountDisplay] = useState<number>(0);
  const flatListRef = useRef<FlatList>(null);
  const mapRef = useRef<MapView>(null);

  const [FloorPolygons, setFloorPolygons] = useState<FloorPolygon[]>([]);
  const [selectedFloor, setSelectedFloor] = useState<string>('1');
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null);
  const [buildingPolygons, setBuildingPolygons] = useState<Building[]>([]);

  const [isIndoor, setIsIndoor] = useState<boolean>(false);
  const lastLocationUpdateTime = useRef<number>(Date.now());
  const gpsPingCountInWindow = useRef<number>(0);

  const THRESHOLD = 3;

  const mapStyle = [
    { elementType: "labels", stylers: [{ visibility: "off" }] },
    { featureType: "poi", stylers: [{ visibility: "on" }] },
    { featureType: "transit", stylers: [{ visibility: "on" }] },
  ];

  useEffect(() => {
    const watchId = Geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setAccuracyDisplay(accuracy);

        if (accuracy && accuracy < 15) {
          setCurrentLocation({ latitude, longitude });
          lastLocationUpdateTime.current = Date.now();
          gpsPingCountInWindow.current += 1;

          console.log(
            `📍 정확한 위치 수신 (accuracy: ${accuracy.toFixed(1)}m) - ${new Date().toLocaleTimeString()}`
          );
        } else {
          console.log(`⚠️ 낮은 정확도 무시됨 (accuracy: ${accuracy?.toFixed(1)}m)`);
        }
      },
      (err) => console.warn('위치 가져오기 실패:', err.message),
      {
        enableHighAccuracy: true,
        distanceFilter: 0,
        interval: 500,
        fastestInterval: 500,
      }
    );

    const gpsPingStatsInterval = setInterval(() => {
      const pingCount = gpsPingCountInWindow.current;
      gpsPingCountInWindow.current = 0;
      setPingCountDisplay(pingCount);

      if (pingCount <= 2) {
        setIsIndoor(true);
      } else if (pingCount <= 6) {
        setIsIndoor(true);
      } else {
        setIsIndoor(false);
      }
    }, 5000);

    const loadPolygons = async () => {
      try {
        const buildings = await fetchBuildingPolygons();
        setBuildingPolygons(buildings);

        const allFloors: FloorPolygon[] = [];
        for (const b of buildings) {
          if (typeof b.id !== 'number') continue;
          try {
            const floor = await fetchFloorPolygons('1', b.id);
            allFloors.push(...floor);
          } catch (err) {
            console.warn(`${b.id}번 건물 층 폴리곤 로딩 실패`, err);
          }
        }
        setFloorPolygons(allFloors);
      } catch (err) {
        console.error('폴리곤 로딩 오류:', err);
      }
    };

    loadPolygons();

    return () => {
      Geolocation.clearWatch(watchId);
      clearInterval(gpsPingStatsInterval);
    };
  }, []);

  useEffect(() => {
    if (!currentLocation || path.length === 0) return;

    let nearestNodeImage: string | null = null;

    for (let i = 0; i < path.length; i++) {
      const coord = path[i].coordinates[0];
      const distance = getDistanceInMeters(currentLocation, coord);
      if (distance < THRESHOLD) {
        nearestNodeImage = nodeImageIds[i];
        break;
      }
    }

    if (nearestNodeImage && nearestNodeImage !== nodeImageIds[currentIndex]) {
      const newIndex = nodeImageIds.indexOf(nearestNodeImage);
      setCurrentIndex(newIndex);
      flatListRef.current?.scrollToIndex({ index: newIndex, animated: true });
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
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          customMapStyle={mapStyle}
          showsUserLocation={true}
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
                  fillColor={selectedBuildingId === feature.id ? 'rgba(0, 0, 255, 0.6)' : 'rgba(100, 100, 100, 0.4)'}
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

          {path.map((edge, i) => {
            const first = edge.coordinates[0];
            return (
              <Circle
                key={`circle-${edge.id}`}
                center={first}
                radius={1}
                strokeColor={i === currentIndex ? 'cyan' : 'gray'}
                fillColor={i === currentIndex ? 'cyan' : 'gray'}
              />
            );
          })}

          {currentLocation && (
            <>
              <Circle
                center={currentLocation}
                radius={1}
                strokeColor={'rgba(0,122,255,1)'}
                fillColor={'rgba(0,122,255,0.3)'}
              />
              <Circle
                center={currentLocation}
                radius={THRESHOLD}
                strokeColor="rgba(0,200,0,0.6)"
                fillColor="rgba(0,200,0,0.15)"
              />
            </>
          )}
        </MapView>

        <View style={styles.statusBox}>
          <Text style={{ fontSize: 14, color: isIndoor ? 'red' : 'green' }}>
            {isIndoor ? '🔴 실내로 추정됨' : '🟢 실외로 추정됨'}
          </Text>
          <Text style={{ fontSize: 12, marginTop: 2 }}>
            ⏱ 최근 5초간 수신 횟수: {pingCountDisplay}회
          </Text>
          <Text style={{ fontSize: 12, marginTop: 2 }}>
            📏 GPS 정확도: {accuracyDisplay ? `${accuracyDisplay.toFixed(1)} m` : 'N/A'}
          </Text>
        </View>
      </View>

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
  container: {
    flex: 1,
  },
  mapContainer: {
    height: screenHeight * 0.4,
  },
  imageListContainer: {
    height: screenHeight * 0.6,
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
});
