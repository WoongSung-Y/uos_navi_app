import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Image,
  FlatList,
  StyleSheet,
  Dimensions
} from 'react-native';
import MapView, { Polyline, Circle } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import type { Coordinate } from '../types/types';
import { useRoute } from '@react-navigation/native';

const screenHeight = Dimensions.get('window').height;

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

  useEffect(() => {
    Geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setCurrentLocation({ latitude, longitude });
      },
      (err) => console.warn('위치 가져오기 실패:', err.message),
      { enableHighAccuracy: true }
    );
  }, []);

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
        <MapView ref={mapRef} style={StyleSheet.absoluteFillObject}>
          {path.map((edge) => (
            <Polyline
              key={edge.id}
              coordinates={edge.coordinates}
              strokeColor="blue"
              strokeWidth={4}
            />
          ))}

          {/* 노드 원 표시 */}
          {path.map((edge, i) => {
            const first = edge.coordinates[0];
            return (
              <Circle
                key={`circle-${edge.id}`}
                center={first}
                radius={3}
                strokeColor={i === currentIndex ? 'red' : 'gray'}
                fillColor={i === currentIndex ? 'red' : 'gray'}
              />
            );
          })}

          {currentLocation && (
            <Circle
              center={currentLocation}
              radius={5}
              strokeColor={'rgba(0,122,255,1)'}
              fillColor={'rgba(0,122,255,0.3)'}
            />
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
