import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import MapView, { Marker, Polygon, Callout } from 'react-native-maps';
import { useNavigation } from '@react-navigation/native';
import Geolocation from '@react-native-community/geolocation';

import { fetchBuildingPolygons } from '../services/api';
import type { Building } from '../types';

const categories = ['라운지', '도서관', '카페', '주차장'];

const markerData = {
  라운지: [{ name: '21관 라운지', coord: { latitude: 37.5836, longitude: 127.059 } }],
  도서관: [{ name: '중앙도서관', coord: { latitude: 37.5842, longitude: 127.058 } }],
  카페: [{ name: '학생회관 카페', coord: { latitude: 37.5829, longitude: 127.0575 } }],
  주차장: [{ name: '건공관 주차장', coord: { latitude: 37.5833, longitude: 127.0565 } }],
};

const noticeMarker = {
  coord: { latitude: 37.5848, longitude: 127.0572 },
  title: '공지사항',
  description: '이곳은 공사 중입니다.',
};

const restaurantMarker = {
  coord: { latitude: 37.5827, longitude: 127.0582 },
  title: '점심 메뉴',
  description: '제육덮밥 / 김치찌개 / 계란찜',
};

const StartScreen = () => {
  const navigation = useNavigation();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isSatellite, setIsSatellite] = useState(false);
  const [mode, setMode] = useState<'default' | 'notice' | 'restaurant' | 'settings'>('default');
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [buildingPolygon, setBuildingPolygon] = useState<Building[]>([]);

  const noticeRef = useRef<any>(null);
  const restaurantRef = useRef<any>(null);

  const requestLocationPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: '위치 권한 요청',
            message: '현재 위치를 사용하려면 권한이 필요합니다.',
            buttonPositive: '허용',
            buttonNegative: '거부',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  };

  useEffect(() => {
    const trackLocation = async () => {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        console.warn('위치 권한 거부됨');
        return;
      }

      Geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCurrentLocation({ latitude, longitude });
        },
        (error) => {
          console.log('위치 추적 실패:', error.message);
        },
        {
          enableHighAccuracy: true,
          distanceFilter: 5,
          interval: 5000,
          fastestInterval: 2000,
        }
      );
    };

    trackLocation();
  }, []);

  useEffect(() => {
    const loadPolygons = async () => {
      try {
        const data = await fetchBuildingPolygons();
        setBuildingPolygon(data);
      } catch (err) {
        console.error('건물 폴리곤 로딩 실패:', err);
      }
    };

    loadPolygons();
  }, []);

  useEffect(() => {
    if (mode === 'notice' && noticeRef.current) {
      setTimeout(() => noticeRef.current.showCallout(), 300);
    }
    if (mode === 'restaurant' && restaurantRef.current) {
      setTimeout(() => restaurantRef.current.showCallout(), 300);
    }
  }, [mode]);

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        showsUserLocation={true}
        followsUserLocation={true}
        mapType={isSatellite ? 'satellite' : 'standard'}
        initialRegion={{
          latitude: currentLocation?.latitude ?? 37.583738,
          longitude: currentLocation?.longitude ?? 127.058393,
          latitudeDelta: 0.007,
          longitudeDelta: 0.007,
        }}
        minZoomLevel={16}
        maxZoomLevel={20}
      >
        {/* ✅ 건물 폴리곤 */}
        {buildingPolygon.map((feature) => {
          try {
            const geojson = JSON.parse(feature.geom_json);
            const polygons = geojson.type === 'Polygon' ? [geojson.coordinates] : geojson.coordinates;

            return polygons.map((polygon, i) => (
              <Polygon
                key={`polygon-${feature.id}-${i}`}
                coordinates={polygon[0].map(([lng, lat]) => ({
                  latitude: lat,
                  longitude: lng,
                }))}
                fillColor="rgba(0, 60, 180, 0.4)"
                strokeColor="transparent"
                strokeWidth={0}
              />
            ));
          } catch (err) {
            console.warn('GeoJSON 파싱 실패:', err);
            return null;
          }
        })}

        {/* ✅ 카테고리 마커 */}
        {selectedCategory &&
          markerData[selectedCategory]?.map((item, idx) => (
            <Marker key={idx} coordinate={item.coord} title={item.name} />
          ))}

        {/* ✅ 공지사항 마커 */}
        {mode === 'notice' && (
          <Marker coordinate={noticeMarker.coord} pinColor="orange" ref={noticeRef}>
            <Callout>
              <View style={styles.calloutContainer}>
                <Text style={styles.calloutTitle}>{noticeMarker.title}</Text>
                <Text>{noticeMarker.description}</Text>
              </View>
            </Callout>
          </Marker>
        )}

        {/* ✅ 학교식당 마커 */}
        {mode === 'restaurant' && (
          <Marker coordinate={restaurantMarker.coord} pinColor="green" ref={restaurantRef}>
            <Callout>
              <View style={styles.calloutContainer}>
                <Text style={styles.calloutTitle}>{restaurantMarker.title}</Text>
                <Text>{restaurantMarker.description}</Text>
              </View>
            </Callout>
          </Marker>
        )}
      </MapView>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="search"
          onFocus={() => navigation.navigate('SearchableMap', { currentLocation })}
        />
        <View style={styles.categoryContainer}>
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryButton, isSelected && styles.selectedButton]}
                onPress={() => {
                  setSelectedCategory(prev => (prev === cat ? null : cat));
                  setMode('default');
                }}
              >
                <Text style={[styles.categoryText, isSelected && { color: 'white' }]}>{cat}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.bottomButtons}>
        <TouchableOpacity style={styles.iconButton} onPress={() => {
          setIsSatellite(prev => !prev);
          setMode('default');
          setSelectedCategory(null);
        }}>
          <Image source={require('../../assets/map.png')} style={styles.icon} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.iconButton} onPress={() => {
          setMode(prev => (prev === 'notice' ? 'default' : 'notice'));
          setSelectedCategory(null);
        }}>
          <Image source={require('../../assets/announcement.png')} style={styles.icon} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.iconButton} onPress={() => {
          setMode(prev => (prev === 'restaurant' ? 'default' : 'restaurant'));
          setSelectedCategory(null);
        }}>
          <Image source={require('../../assets/meal.png')} style={styles.icon} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.iconButton} onPress={() => {
          setMode(prev => (prev === 'settings' ? 'default' : 'settings'));
          setSelectedCategory(null);
        }}>
          <Image source={require('../../assets/settings.png')} style={styles.icon} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default StartScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { ...StyleSheet.absoluteFillObject },
  searchContainer: {
    position: 'absolute', top: 50, left: 10, right: 10,
  },
  searchInput: {
    height: 40, backgroundColor: 'white', borderRadius: 10,
    paddingHorizontal: 10, marginBottom: 10, elevation: 3,
  },
  categoryContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  categoryButton: {
    backgroundColor: '#eee', paddingVertical: 6,
    paddingHorizontal: 12, borderRadius: 20,
  },
  selectedButton: { backgroundColor: '#007bff' },
  categoryText: { fontWeight: 'bold', color: 'black' },
  bottomButtons: {
    position: 'absolute', bottom: 30, left: 20, right: 20,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  iconButton: {
    backgroundColor: 'white', padding: 10,
    borderRadius: 30, elevation: 5,
  },
  icon: { width: 24, height: 24 },
  calloutContainer: { padding: 6 },
  calloutTitle: { fontWeight: 'bold', marginBottom: 4 },
});
