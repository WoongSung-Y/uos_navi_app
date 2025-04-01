// 틀릴리가 없다
// 틀리면 기필코 자살할 것
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
} from 'react-native';
import MapView, { Polyline, Circle, Polygon} from 'react-native-maps';
import { useRoute } from '@react-navigation/native';
import { fetchBuildingPolygons, fetchFloorPolygons, uploadImageToServer, fetchNodes  } from '../services/api';
import FloorSelector from '../components/FloorSelector';
// import { launchCamera } from 'react-native-image-picker';

const screenHeight = Dimensions.get('window').height;
const screenWidth = Dimensions.get('window').width;
const FIXED_THRESHOLD = 5;

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

const RouteScreen = () => {
  const route = useRoute();
  const { path, nodeImageIds } = route.params;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [currentAccuracy, setCurrentAccuracy] = useState(null);
  const [isIndoor, setIsIndoor] = useState(true);
  const [selectedFloor, setSelectedFloor] = useState<string>('1');
  const [FloorPolygons, setFloorPolygons] = useState([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState(null);
  const [buildingPolygons, setBuildingPolygons] = useState([]);
  const [showFloorSelector, setShowFloorSelector] = useState(false);

  const flatListRef = useRef(null);
  const mapRef = useRef(null);

  const mapStyle = [
    { elementType: "labels", stylers: [{ visibility: "off" }] },
    { featureType: "poi", stylers: [{ visibility: "on" }] },
    { featureType: "transit", stylers: [{ visibility: "on" }] },
  ];
  const [nodes, setNodes] = useState([]);

  // 맨처음 지도가 초기화 될 때 한번만 실행
  const didInitMap = useRef(false);  // 최초 1회 실행용 플래그
  // 지도 줌인을 처음 경로로
  useEffect(() => {
    if (!didInitMap.current && path.length > 0 && path[0]?.coordinates?.length > 0) {
      const { latitude, longitude } = path[0].coordinates[0];
      mapRef.current?.animateToRegion({
        latitude,
        longitude,
        latitudeDelta: 0.0004,
        longitudeDelta: 0.0004,
      });
      didInitMap.current = true;  // 한 번 실행되면 다시 안 함
    }
  }, [path]);
  

  useEffect(() => {
    const loadNodes = async () => {
      const data = await fetchNodes();
      setNodes(data);
    };
    loadNodes();
  }, []);

  const handleTakePhoto = async () => {
    const granted = await requestCameraPermission();
    if (!granted) return;

    
    // const result = await launchCamera({
    //   mediaType: 'photo',
    //   cameraType: 'back',
    //   quality: 0.8,
    // });
  
    if (result.didCancel || !result.assets || !result.assets[0]?.uri) {
      console.warn('사진 촬영 취소 또는 실패');
      console.log(result);
      return;
    }
  
    const uri = result.assets[0].uri;
    const currentEdge = path[currentIndex];
  
    if (!currentEdge?.id || !currentEdge?.nodeid) {
      console.warn('경로 정보 없음');
      return;
    }
  
    const fileName = `${currentEdge.id}_${currentEdge.nodeid}.jpg`;
  
    const uploaded = await uploadImageToServer(uri, fileName);
    if (uploaded) {
      console.log('업로드 성공:', uploaded);
      // 📌 필요 시 이미지 리스트 갱신
    } else {
      console.error('업로드 실패');
      console.log(uploaded);
    }
  };

  useEffect(() => {
    if (path.length > 0 && path[0].floor) {
      setSelectedFloor(path[0].floor.toString());
      setShowFloorSelector(true);
    }
  }, [path]);

  
  useEffect(() => {
    const currentFloor = path[currentIndex]?.floor;
    if (currentFloor) {
      setSelectedFloor(currentFloor.toString());
      setShowFloorSelector(true);
    } else {
      setSelectedFloor(null);
      setShowFloorSelector(false);
      setSelectedBuildingId(null);
    }
    
  }, [currentIndex]);

  useEffect(() => {
    const loadFloorPolygons = async () => {
      try {
        if (selectedBuildingId && selectedFloor) {
          const allPolygons = await fetchFloorPolygons(selectedFloor, selectedBuildingId);
          setFloorPolygons(allPolygons);
        } else {
          setFloorPolygons([]); // 선택 안됐으면 폴리곤 비움
        }
      } catch (error) {
        console.error('층 폴리곤 불러오기 실패:', error);
      }
    };
    loadFloorPolygons();
  }, [selectedBuildingId, selectedFloor]);
  

// 1. buildingPolygons 먼저 세팅
useEffect(() => {
  const loadData = async () => {
    const buildings = await fetchBuildingPolygons();
    setBuildingPolygons(buildings);

    // ⬇️ 여기서 바로 building id 설정
    if (path.length > 0 && path[0].buildname) {
      const target = buildings.find(b => b.build_name === path[0].buildname);
      if (target) setSelectedBuildingId(target.id);
    }
  };
  loadData();
}, []);

useEffect(() => {
  if (path.length === 0 || !path[currentIndex]?.buildname) return;
  const currentBuildName = path[currentIndex].buildname;

  const match = buildingPolygons.find(
    (b) => b.build_name === currentBuildName
  );

  if (match) {
    setSelectedBuildingId(match.id);
  }
}, [currentIndex, buildingPolygons, path]);



  useEffect(() => {
    if (!currentLocation || path.length === 0) return;
    for (let i = 0; i < path.length; i++) {
      const coord = path[i].coordinates[0];
      const distance = getDistanceInMeters(currentLocation, coord);
      if (distance < FIXED_THRESHOLD) {
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
    if (currentEdge) {
      const node = nodes.find(n => n.node_id === currentEdge.nodeid);
      if (node) {
        mapRef.current?.animateToRegion({
          latitude: node.latitude,
          longitude: node.longitude,
          latitudeDelta: 0.0004,
          longitudeDelta: 0.0004
        });
      }
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
        onPress={() => setSelectedBuildingId(null)}
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

{path.map((edge, i) => {
  const node = nodes.find(n => n.node_id === edge.nodeid);
  if (!selectedFloor || edge.floor?.toString() === selectedFloor) {
    if (!node) return null; // node 없으면 skip
    return (
      <Circle
        key={`circle-${edge.id}`}
        center={{ latitude: node.latitude, longitude: node.longitude }}
        radius={.5}
        strokeColor={i === currentIndex ? 'cyan' : 'gray'}
        fillColor={i === currentIndex ? 'cyan' : 'gray'}
        onPress={() => {
          setCurrentIndex(i);
          mapRef.current?.animateToRegion({
            latitude: node.latitude,
            longitude: node.longitude,
            latitudeDelta: 0.0004,
            longitudeDelta: 0.0004,
          });
        }}      />
    );
  }
  return null;
})}


        {currentLocation && !isIndoor && currentAccuracy && (
          <Circle
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

      {showFloorSelector && (
        <View style={styles.floorSelectorWrapper}>
          <FloorSelector
            selectedFloor={selectedFloor}
            setSelectedFloor={setSelectedFloor}
            selectedBuildingId={selectedBuildingId}
          />
        </View>
      )}

      <View style={styles.imageListContainer}>
        
        <FlatList
          ref={flatListRef}
          data={nodeImageIds}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={true}
          keyExtractor={(item) => item}
          onMomentumScrollEnd={(e) => {
            const index = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
            setCurrentIndex(index);
          }}
          renderItem={({ item }) => (
            <Image
              source={{ uri: `http://15.165.159.29:3000/images/${item}.jpg` }}
              style={[styles.image, { width: screenWidth - 20 }]}
              resizeMode="contain"
            />
          )}
        />
      </View>
      
      <View style={styles.buttonWrapper}>
  <Button title="📸" onPress={handleTakePhoto} />
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
    paddingVertical: 10,
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
    marginHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#ddd',
  },
  floorSelectorWrapper: {
    position: 'absolute',
    top: 130,
    right: 10,
    zIndex: 1000,
    elevation: 10,
  },  
  buttonWrapper: {
    padding: 10,
    backgroundColor: '#f0f0f0',
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderRadius: 10,
  },
  
});