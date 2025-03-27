import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Image,
  FlatList,
  StyleSheet,
  Dimensions
} from 'react-native';
import MapView, { Polyline, Circle, Polygon } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import type { Coordinate, Building, FloorPolygon } from '../types/types';
import { useRoute } from '@react-navigation/native';
import { fetchBuildingPolygons, fetchFloorPolygons } from '../services/api';

const screenHeight = Dimensions.get('window').height;

// 버퍼 거리 계산 - 하버사인 거리
const getDistanceInMeters = (coord1: Coordinate, coord2: Coordinate) => {
  const R = 6371e3; // metres
  const φ1 = coord1.latitude * Math.PI / 180;
  const φ2 = coord2.latitude * Math.PI / 180;
  const Δφ = (coord2.latitude - coord1.latitude) * Math.PI / 180;
  const Δλ = (coord2.longitude - coord1.longitude) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in metres
};

const RouteScreen = () => {
  const route = useRoute();
  const { path, nodeImageIds } = route.params as {
    path: { id: string; coordinates: Coordinate[] }[];
    nodeImageIds: string[];
  };

  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentLocation, setCurrentLocation] = useState<Coordinate | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const mapRef = useRef<MapView>(null);

  const [FloorPolygons, setFloorPolygons] = useState<FloorPolygon[]>([]);
  const [selectedFloor, setSelectedFloor] = useState<string>('1');
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null);
  const [buildingPolygons, setBuildingPolygons] = useState<Building[]>([]);

  const THRESHOLD = 3; // Buffer //meters

  const mapStyle = [
    {
      elementType: "labels",
      stylers: [{ visibility: "off" }]
    },
    {
      featureType: "poi",
      stylers: [{ visibility: "on" }]
    },
    {
      featureType: "transit",
      stylers: [{ visibility: "on" }]
    }
  ];

  useEffect(() => {
    Geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setCurrentLocation({ latitude, longitude });
      },
      (err) => console.warn('위치 가져오기 실패:', err.message),
      { enableHighAccuracy: true, distanceFilter: 1, interval: 1000, fastestInterval: 500 }
    );

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
  }, []);

  // GPS 위치 기반 자동 노드 감지 및 인덱스 이동
  useEffect(() => {
    if (!currentLocation || path.length === 0) return;

    for (let i = 0; i < path.length; i++) {
      const coord = path[i].coordinates[0]; // 각 edge의 대표 좌표
      const distance = getDistanceInMeters(currentLocation, coord);
      if (distance < THRESHOLD && i !== currentIndex) {
        setCurrentIndex(i);
        flatListRef.current?.scrollToIndex({ index: i, animated: true });
        break;
      }
    }
  }, [currentLocation]);

  // currentIndex 변경 시 지도 이동
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
      {/* 지도 영역 */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          customMapStyle={mapStyle}
          showsUserLocation={true}
          showsBuildings={false}
        >
          {/* 최단 경로 표시 */}
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

          {/* 노드 위치 원 표시 */}
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

          {/* 현재 GPS 위치와 주변 버퍼 원 표시 */}
          {currentLocation && (
            <>
              {/* 실제 GPS 위치 */}
              <Circle
                center={currentLocation}
                radius={1}
                strokeColor={'rgba(0,122,255,1)'}
                fillColor={'rgba(0,122,255,0.3)'}
              />
              {/* GPS 주변 버퍼 반경 */}
              <Circle
                center={currentLocation}
                radius={THRESHOLD}
                strokeColor="rgba(0,200,0,0.6)"
                fillColor="rgba(0,200,0,0.15)"
              />
            </>
          )}
        </MapView>
      </View>

      {/* 이미지 리스트 */}
      <View style={styles.imageListContainer}>
        <FlatList
          ref={flatListRef}
          data={nodeImageIds}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item}
          onMomentumScrollEnd={(e) => {
            const index = Math.round(e.nativeEvent.contentOffset.x / 250);
            setCurrentIndex(index);
          }}
          renderItem={({ item }) => (
            <Image
              source={{ uri: `http://15.165.159.29:3000/images/${item}.jpg` }}
              style={styles.image}
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
    width: 340,
    height: '100%',
    marginHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#ddd',
  },
});
