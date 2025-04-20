import React, { useEffect, useState, useRef } from 'react';
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
  Modal,
  ScrollView,
} from 'react-native';
import MapView, { Marker, Callout, Polygon } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import { useNavigation } from '@react-navigation/native';
import { fetchBuildingPolygons, fetchPOINodes, fetchFloorPolygons } from '../services/api';
import FloorSelector from '../components/FloorSelector';
import type { Node, Building } from '../types/types';
import axios from 'axios';


const categories = ['라운지', '도서관', '카페', '주차장'];

const noticeMarker = {
  coord: { latitude: 37.5848, longitude: 127.0572 },
  title: '공지사항',
  description: '이곳은 공사 중입니다.',
};

const StartScreen = () => {
  const mapRef = useRef<MapView>(null);
  const [FloorPolygons, setFloorPolygons] = useState([]);
  const [selectedFloor, setSelectedFloor] = useState<string>('1');
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null);
  const navigation = useNavigation();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isSatellite, setIsSatellite] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [buildingPolygons, setBuildingPolygons] = useState<Building[]>([]);
  const [poiNodes, setPoiNodes] = useState<Node[]>([]);
  const [mode, setMode] = useState<'default' | 'settings' | 'restaurant' | 'notice'>('default');
  const [mapZoomLevel, setMapZoomLevel] = useState<number>(0); // 줌 상태 추적
  const [restaurantMenus, setRestaurantMenus] = useState<{ [key: string]: string }>({});

  const [menuModalVisible, setMenuModalVisible] = useState(false);
  const [selectedRestaurantName, setSelectedRestaurantName] = useState('');
  const [selectedRestaurantMenu, setSelectedRestaurantMenu] = useState('');
  const [selectedMealTime, setSelectedMealTime] = useState<'조식' | '중식' | '석식'>('중식');

  const [userSettings, setUserSettings] = useState({
    elderly: false,
    wheelchair: false,
    noSmokingZone: false,
    noCarRoad: false,
    freshman: false,
  });

  const mapStyle = [
    { elementType: "labels", stylers: [{ visibility: "off" }] },
    { featureType: "poi", stylers: [{ visibility: "on" }] },
    { featureType: "transit", stylers: [{ visibility: "on" }] },
  ];

  const extractRoomNumber = (lectNum: string) => {
    const match = lectNum.match(/(\d+호)/);
    return match ? match[1] : lectNum;
  };
  
  const requestCameraPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: '카메라 권한 요청',
            message: '실내 위치 분석을 위해 카메라 권한이 필요합니다.',
            buttonPositive: '허용',
            buttonNegative: '거부',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn('카메라 권한 요청 중 오류:', err);
        return false;
      }
    }
    return true;
  };

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

  
  const fetchRestaurantMenus = async () => {
    try {
      const res = await axios.get('http://3.39.165.203:3000/api/menu');
      setRestaurantMenus(res.data); // 전체 식당 메뉴를 state에 저장
    } catch (e) {
      console.error('메뉴 불러오기 실패:', e);
    }
  };
  
  

  // 식당 이름 → cafeIdx 매핑표
  const cafeMapping: { [key: string]: number } = {
    "100주년기념관 이룸라운지": 10,
    "학생회관 식당": 20,
    "양식당": 30,
    "자연과학관 식당":40,
  };

useEffect(() => {
  requestCameraPermission();
}, []);

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
    fetchRestaurantMenus(); // 앱 시작 시 메뉴 가져오기
  }, []);

  const toggleSetting = (key: keyof typeof userSettings) => {
    setUserSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };
  
  const handleRestaurantMarkerPress = (lect_num: string) => {
    const matchedKey = Object.keys(cafeMapping).find(key => lect_num.includes(key));
    if (!matchedKey) {
      console.warn('매칭되는 식당 없음:', lect_num);
      return;
    }
    const locationId = cafeMapping[matchedKey]; // 10, 20, 30 등
    
    const cafeMenu = restaurantMenus[locationId]?.menus;
  
    if (cafeMenu) {
      const menuText = Object.entries(cafeMenu)
        .map(([type, items]) => `${type}\n${items}`)
        .join('\n\n'); // 🍴 조식/중식/석식 이쁘게 구분
  
      setSelectedRestaurantName(matchedKey);
      setSelectedRestaurantMenu(menuText);
      setMenuModalVisible(true);
    } else {
      setSelectedRestaurantName(matchedKey);
      setSelectedRestaurantMenu('메뉴 정보가 없습니다.');
      setMenuModalVisible(true);
    }
  };
  
  
  
  const renderCategoryMarkers = () => {
    if (!selectedCategory) return null;
    return poiNodes
      .filter((node) => node.lect_num?.includes(selectedCategory))
      .map((node) => (
        <Marker
          key={node.node_id}
          coordinate={{ latitude: parseFloat(node.latitude), longitude: parseFloat(node.longitude) }}
          pinColor="#9BCBEB"
        >
          <Callout><Text>{node.lect_num}</Text></Callout>
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
          coordinate={{ latitude: parseFloat(node.latitude), longitude: parseFloat(node.longitude) }}
          pinColor="#9BCBEB"
          onPress={() => handleRestaurantMarkerPress(node.lect_num)}
        >
          <Callout>
            <View style={{ maxWidth: 200 }}>
              <Text style={{ fontWeight: 'bold' }}>{node.lect_num}</Text>
            </View>
          </Callout>
        </Marker>
      ));
  };
  
  

  const renderNoticeMarker = () => {
    if (mode !== 'notice') return null;
    return (
      <Marker coordinate={noticeMarker.coord} pinColor="#9BCBEB">
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
        ref={mapRef}
        customMapStyle={mapStyle}
        provider="google"
        style={styles.map}
        showsUserLocation={true}
        showsMyLocationButton={false}
        followsUserLocation
        showsBuildings={false}
        mapType={isSatellite ? 'satellite' : 'standard'}
        initialRegion={{
          latitude: currentLocation?.latitude ?? 37.583738,
          longitude: currentLocation?.longitude ?? 127.058393,
          latitudeDelta: 0.007,
          longitudeDelta: 0.007,
        }}
        onPress={() => setSelectedBuildingId(null)}
        onRegionChangeComplete={(region) => {
          setMapZoomLevel(region.latitudeDelta);
        }}
      >
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
                    ? "rgba(0, 0, 255, 0.6)"
                    : "rgba(100, 100, 100, 0.4)"
                }
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
                    fillColor="rgba(0, 255, 0, 0.3)"
                    strokeColor="black"
                    strokeWidth={2}
                  />
                {feature.lect_num && mapZoomLevel < 0.003 && (
                  <Marker coordinate={center}>
                    <Text style={{ fontSize: 6, fontWeight: 'bold' }}>
                      {extractRoomNumber(feature.lect_num)}
                    </Text>
                  </Marker>
                )}
                </React.Fragment>
              );
            });
          } catch {
            return null;
          }
        })}

        {renderCategoryMarkers()}
        {renderRestaurantMarkers()}
        {renderNoticeMarker()}
      </MapView>

      {selectedBuildingId !== null && (
        <FloorSelector
          selectedFloor={selectedFloor}
          setSelectedFloor={setSelectedFloor}
          selectedBuildingId={selectedBuildingId}
        />
      )}

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="검색"
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

      <TouchableOpacity
        style={styles.myLocationButton}
        onPress={() => {
          Geolocation.getCurrentPosition(
            pos => {
              const { latitude, longitude } = pos.coords;
              mapRef.current?.animateToRegion({
                latitude,
                longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              }, 500);
            },
            err => console.warn(err.message),
            { enableHighAccuracy: true }
          );
        }}
      >
        <Image source={require('../../assets/location-icon.png')} style={{ width: 30, height: 30 }} />
      </TouchableOpacity>

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
          setMode(prev => {
            const newMode = prev === 'restaurant' ? 'default' : 'restaurant';
            if (newMode === 'restaurant') {
              fetchRestaurantMenus();  // 식당 모드 들어갈 때 메뉴 가져오기
            }
            return newMode;
          });
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

  <Modal
      animationType="slide"
      transparent={true}
      visible={menuModalVisible}
      onRequestClose={() => setMenuModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{selectedRestaurantName}</Text>
  
          <View style={styles.menuContainer}>
  <ScrollView>
    <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 10 }}>
      {['조식', '중식', '석식'].map((meal) => (
        <TouchableOpacity
          key={meal}
          onPress={() => setSelectedMealTime(meal as '조식' | '중식' | '석식')}
          style={{
            paddingVertical: 6,
            paddingHorizontal: 16,
            borderRadius: 20,
            backgroundColor: selectedMealTime === meal ? '#9BCBEB' : '#eee',
          }}
        >
          <Text style={{ fontWeight: 'bold', color: selectedMealTime === meal ? 'white' : 'black' }}>
            {meal}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
    <Text style={styles.modalMenu}>
      {restaurantMenus[cafeMapping[selectedRestaurantName]]?.menus?.[selectedMealTime] || '메뉴 정보가 없습니다.'}
    </Text>
  </ScrollView>
</View>
d
          <TouchableOpacity style={styles.closeButton} onPress={() => setMenuModalVisible(false)}>
            <Text style={styles.closeButtonText}>닫기</Text>
          </TouchableOpacity>
      </View>

      </View>
    </Modal>

    </View>
  );
};

export default StartScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { ...StyleSheet.absoluteFillObject },
  searchContainer: { position: 'absolute', top: 20, left: 10, right: 10 },
  searchInput: {
    height: 40, backgroundColor: 'white', borderRadius: 10,
    paddingHorizontal: 10, marginBottom: 10, elevation: 3,
  },
  categoryContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  categoryButton: {
    backgroundColor: '#eee', paddingVertical: 6,
    paddingHorizontal: 12, borderRadius: 20,
  },
  selectedButton: { backgroundColor: '#9BCBEB' },
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
  settingTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 10, alignSelf: 'center' },
  settingRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginVertical: 5,
  },
  settingLabel: { fontSize: 14, color: '#333' },
  callout: {
    padding: 6, backgroundColor: 'white', borderRadius: 6,
    borderWidth: 1, borderColor: '#ccc',
  },
  calloutTitle: { fontWeight: 'bold', marginBottom: 2 },
  myLocationButton: {
    position: 'absolute',
    top: 550,
    right: 15,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  modalMenu: {
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
  },
  closeButton: {
    backgroundColor: '#9BCBEB',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  closeButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  menuContainer: {
    maxHeight: 300, // 모달 안에서 스크롤 허용할 최대 높이
    marginBottom: 20,
  },
  
  
});
