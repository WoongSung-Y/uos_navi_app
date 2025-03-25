import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  PermissionsAndroid,
  Platform,
  Switch,
} from 'react-native';
import MapView, { Marker, Callout, Polygon } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import { useNavigation } from '@react-navigation/native';
import { fetchBuildingPolygons, fetchPOINodes } from '../services/api';
import type { Building, Node } from '../types';

const categories = ['라운지', '도서관', '카페', '주차장'];

const noticeMarker = {
  coord: { latitude: 37.5848, longitude: 127.0572 },
  title: '공지사항',
  description: '이곳은 공사 중입니다.',
};

const StartScreen = () => {
  const navigation = useNavigation();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isSatellite, setIsSatellite] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [buildingPolygons, setBuildingPolygons] = useState<Building[]>([]);
  const [poiNodes, setPoiNodes] = useState<Node[]>([]);
  const [mode, setMode] = useState<'default' | 'settings' | 'restaurant' | 'notice'>('default');

  const [userSettings, setUserSettings] = useState({
    elderly: false,
    wheelchair: false,
    noSmokingZone: false,
    noCarRoad: false,
    freshman: false,
  });

  const requestLocationPermission = async () => {
    if (Platform.OS === 'android') {
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
    }
    return true;
  };

  useEffect(() => {
    const trackLocation = async () => {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) return;

      Geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setCurrentLocation({ latitude, longitude });
        },
        (err) => {
          console.warn('위치 추적 실패:', err.message);
        },
        { enableHighAccuracy: true, distanceFilter: 5, interval: 5000, fastestInterval: 2000 }
      );
    };
    trackLocation();
  }, []);

  useEffect(() => {
    fetchBuildingPolygons().then(setBuildingPolygons).catch(console.error);
    fetchPOINodes().then(setPoiNodes).catch(console.error);
  }, []);

  const toggleSetting = (key: keyof typeof userSettings) => {
    setUserSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const renderCategoryMarkers = () => {
    if (!selectedCategory) return null;

    return poiNodes
      .filter((node) => node.lect_num?.includes(selectedCategory))
      .map((node) => (
        <Marker
          key={node.node_id}
          coordinate={{
            latitude: parseFloat(node.latitude),
            longitude: parseFloat(node.longitude),
          }}
        >
          <Callout>
            <Text>{node.lect_num}</Text>
          </Callout>
        </Marker>
      ));
  };

  const renderRestaurantMarkers = () => {
    if (mode !== 'restaurant') return null;

    return poiNodes
      .filter((node) => node.lect_num?.includes('식당'))
      .map((node) => (
        <Marker
          key={node.node_id}
          coordinate={{
            latitude: parseFloat(node.latitude),
            longitude: parseFloat(node.longitude),
          }}
          pinColor="orange"
        >
          <Callout>
            <Text>{node.lect_num}</Text>
          </Callout>
        </Marker>
      ));
  };

  const renderNoticeMarker = () => {
    if (mode !== 'notice') return null;

    return (
      <Marker coordinate={noticeMarker.coord} pinColor="red">
        <Callout>
          <View style={styles.callout}>
            <Text style={styles.calloutTitle}>{noticeMarker.title}</Text>
            <Text>{noticeMarker.description}</Text>
          </View>
        </Callout>
      </Marker>
    );
  };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        showsUserLocation
        followsUserLocation
        mapType={isSatellite ? 'satellite' : 'standard'}
        initialRegion={{
          latitude: currentLocation?.latitude ?? 37.583738,
          longitude: currentLocation?.longitude ?? 127.058393,
          latitudeDelta: 0.007,
          longitudeDelta: 0.007,
        }}
      >
        {/* 건물 폴리곤 */}
        {buildingPolygons.map((feature) => {
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
                fillColor="rgba(0, 0, 255, 0.2)"
                strokeColor="transparent"
                strokeWidth={0}
              />
            ));
          } catch (err) {
            console.warn('GeoJSON 파싱 실패:', err);
            return null;
          }
        })}

        {renderCategoryMarkers()}
        {renderRestaurantMarkers()}
        {renderNoticeMarker()}
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

      {mode === 'settings' && (
        <View style={styles.settingPanel}>
          <Text style={styles.settingTitle}>사용자 설정</Text>
          {[
            ['elderly', '노인'],
            ['wheelchair', '휠체어 사용자'],
            ['noSmokingZone', '흡연장 경유 X'],
            ['noCarRoad', '차도 없는 경로'],
            ['freshman', '새내기'],
          ].map(([key, label]) => (
            <View key={key} style={styles.settingRow}>
              <Text style={styles.settingLabel}>{label}</Text>
              <Switch
                value={userSettings[key as keyof typeof userSettings]}
                onValueChange={() => toggleSetting(key as keyof typeof userSettings)}
              />
            </View>
          ))}
        </View>
      )}
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
  settingPanel: {
    position: 'absolute', bottom: 100, left: 20, right: 20,
    backgroundColor: 'white', padding: 15, borderRadius: 15, elevation: 10,
  },
  settingTitle: {
    fontSize: 16, fontWeight: 'bold', marginBottom: 10, alignSelf: 'center',
  },
  settingRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginVertical: 5,
  },
  settingLabel: { fontSize: 14, color: '#333' },
  callout: {
    padding: 6,
    backgroundColor: 'white',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  calloutTitle: {
    fontWeight: 'bold',
    marginBottom: 2,
  },
});
