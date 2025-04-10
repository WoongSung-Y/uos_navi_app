
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
import MapView, { Polyline, Circle, Polygon, Marker} from 'react-native-maps';
import { useRoute } from '@react-navigation/native';
import { fetchBuildingPolygons, fetchFloorPolygons, uploadImageToServer, fetchNodes  } from '../services/api';
import FloorSelector from '../components/FloorSelector';
import { launchCamera } from 'react-native-image-picker';
import IndoorLocateButton from '../components/IndoorLocateButton';
import labelMapping from '../types/label_mapping.json'; // 예: JSON import

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
  const { path, nodeImageIds, realviewNode } = route.params;
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
  const [doortype, setDoortype] = useState<string>('indoor');
  const [PredictedNodeId,setPredictedNodeId] = useState<string | null>(null);
  const [PredictedFloorId,setPredictedFloorId] = useState<string | null>(null);
  const flatListRef = useRef(null);
  const mapRef = useRef(null);
  const [mapZoomLevel, setMapZoomLevel] = useState(0);


  const mapStyle = [
    { elementType: "labels", stylers: [{ visibility: "off" }] },
    { featureType: "poi", stylers: [{ visibility: "on" }] },
    { featureType: "transit", stylers: [{ visibility: "on" }] },
  ];
  const [nodes, setNodes] = useState([]);
  const didInitMap = useRef(false);
  useEffect(() => {
    if (!didInitMap.current && path.length > 0 && path[0]?.coordinates?.length > 0) {
      const { latitude, longitude } = path[0].coordinates[0];
      mapRef.current?.animateToRegion({
        latitude,
        longitude,
        latitudeDelta: 0.0004,
        longitudeDelta: 0.0004,
      });
      didInitMap.current = true;
    }
  }, [path]);

  const extractRoomNumber = (lectNum: string) => {
    const match = lectNum.match(/(\d+호)/);
    return match ? match[1] : lectNum;
  };  

  useEffect(() => {
    const loadNodes = async () => {
      const data = await fetchNodes();
      setNodes(data);
    };
    loadNodes();
  }, []);

  useEffect(() => {
    if (PredictedNodeId === null && PredictedFloorId === null) return;
  
    const labelList = labelMapping[PredictedFloorId]; // 층에 맞는 리스트
    const matchedNodeId = labelList?.[PredictedNodeId]; // pred_class_idx로 노드 ID 조회
  
    if (!matchedNodeId) return;
  
    console.log('✔ 매핑된 노드 ID:', matchedNodeId);
    console.log('✔ 매핑된 층:', PredictedFloorId);
    console.log('✔ 매핑된 노드:', nodes.find(node => node.nodeId === matchedNodeId));
    const matchIndex = realviewNode.findIndex(n => n.nodeId === matchedNodeId);
    console.log('✔ 매칭된 인덱스:', matchIndex);
    if (matchIndex !== -1) {
      setCurrentIndex(matchIndex);
      flatListRef.current?.scrollToIndex({ index: matchIndex, animated: true });
    }
  }, [PredictedNodeId, PredictedFloorId]);

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

  useEffect(() => {
    if (realviewNode.length > 0 && realviewNode[currentIndex].floor) {
      setSelectedFloor(realviewNode[currentIndex].floor.toString());
      setShowFloorSelector(true);
    }
  }, [currentIndex]);

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

  useEffect(() => {
    if (realviewNode.length === 0 || !realviewNode[currentIndex]?.buildname) return;
    const currentBuildName = realviewNode[currentIndex].buildname;
    const match = buildingPolygons.find(b => b.build_name === currentBuildName);
    if (match) setSelectedBuildingId(match.id);
  }, [currentIndex, buildingPolygons, path]);

  // 5m 버퍼 안의 노드로 자동 전환
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
    const currentnode = realviewNode[currentIndex];
    mapRef.current?.animateToRegion({
      latitude: currentnode.nodeLatitude,
      longitude: currentnode.nodeLongitude,
      latitudeDelta: 0.0001,
      longitudeDelta: 0.0001
    });
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
        onRegionChangeComplete={(region) => setMapZoomLevel(region.latitudeDelta)}
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
        mapRef.current?.animateToRegion({
          latitude: node.nodeLatitude,
          longitude: node.nodeLongitude,
          latitudeDelta: 0.0004,
          longitudeDelta: 0.0004,
        });
      }}
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
            fillColor="rgba(0, 255, 0, 0.3)"
            strokeColor="black"
            strokeWidth={2}
          />
        {feature.lect_num && mapZoomLevel < 0.003 && (
          <Marker coordinate={center}>
  <View style={styles.lectNumBadge}>
    <Text style={styles.lectNumText}>
      {extractRoomNumber(feature.lect_num)}
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

      <View style={styles.imageListContainer}>
        
      <FlatList
        ref={flatListRef}
        data={realviewNode}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={true}
        keyExtractor={(item, index) => `${item.nodeLatitude}-${item.nodeLongitude}-${index}`}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
          setCurrentIndex(index);
        }}
        renderItem={({ item }) => (
          <Image
            source={{ uri: `http://15.165.159.29:3000/images/${item.imageName}.jpg` }}
            style={[styles.image, { width: screenWidth - 20 }]}
            resizeMode="contain"
          />
        )}
      />

      </View>
      <View style={styles.buttonWrapper}>
  <Button title="📸" onPress={handleTakePhoto} />
</View>


      <View style={styles.indoorButtonWrapper}>
        <IndoorLocateButton
          doortype={doortype}
          initialFloor={initialFloor}
          onResult={(result) => {
            setPredictedNodeId(result.result.pred_class_idx);
            setPredictedFloorId(result.result.estimated_floor);
          }}
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
    top: 210,
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
    elevation: 4, // Android용 그림자
    alignItems: 'center',
    justifyContent: 'center',
  },
  lectNumText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#333',
  },  
});
