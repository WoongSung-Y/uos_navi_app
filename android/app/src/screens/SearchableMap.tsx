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
  FlatList,
  BackHandler
} from 'react-native';
import MapView, { Marker, Callout, Polygon, Polyline, Circle } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import {
  fetchBuildingPolygons,
  fetchPOINodes,
  fetchFloorPolygons,
  fetchNodes,
  fetchShortestPath,
  fetchEdgeCoordinates
} from '../services/api';
import FloorSelector from '../components/FloorSelector';
import { findNearestNode } from '../utils/findNearestNode';
import type { Node, Coordinate, Building, RealViewNode } from '../types/types';

const floorColors = {
  '-1': 'cyan',
  '1': 'blue',
  '2': 'green',
  '3': 'orange',
  '4': 'purple',
  '5': 'red',
  '6': 'yellow',
  '7': 'pink',
  '야외': 'black',
  default: 'black',
};

// Haversine 공식을 이용한 거리 계산 함수
const calculateDistance = (coord1: Coordinate, coord2: Coordinate) => {
  const R = 6371000; // 지구 반지름 (미터)
  const dLat = (coord2.latitude - coord1.latitude) * Math.PI / 180;
  const dLon = (coord2.longitude - coord1.longitude) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(coord1.latitude * Math.PI / 180) * 
    Math.cos(coord2.latitude * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

const StartScreen = () => {

  const [FloorPolygons, setFloorPolygons] = useState([]);
  const [selectedFloor, setSelectedFloor] = useState<string>('1');
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null);
  const [buildingPolygons, setBuildingPolygons] = useState<Building[]>([]);
  const [poiNodes, setPoiNodes] = useState<Node[]>([]);
  const [allNodes, setAllNodes] = useState<Node[]>([]);
  const [fromNode, setFromNode] = useState<Node | null>(null);
  const [toNode, setToNode] = useState<Node | null>(null);
  const [path, setPath] = useState<{ id: string, coordinates: Coordinate[], floor?: string, buildname?: string }[]>([]);
  const [nodeImageIds, setNodeImageIds] = useState<string[]>([]);
  const [totalDistance, setTotalDistance] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [filtered, setFiltered] = useState<Node[]>([]);
  const [selected, setSelected] = useState<Node | null>(null);
  const navigation = useNavigation();
  const route = useRoute();
  const [currentLocation, setCurrentLocation] = useState<any>(route.params?.currentLocation || null);
  const mapRef = useRef<MapView>(null);
  const [longPressCoord, setLongPressCoord] = useState<any>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showPathDetails, setShowPathDetails] = useState(false);
  const [pathSequence, setPathSequence] = useState<Array<{floor: string, buildname: string, distance: number}>>([]);
  const [realviewNode, setRealViewNode] = useState([]);
  const [mapZoomLevel, setMapZoomLevel] = useState(0);


  const mapStyle = [
    { elementType: "labels", stylers: [{ visibility: "off" }] },
    { featureType: "poi", stylers: [{ visibility: "on" }] },
    { featureType: "transit", stylers: [{ visibility: "on" }] }
  ];

  const handleSetFromNode = (node: Node | null) => {
    setFromNode(node);
    setFiltered([]);
    setSelected(null);
  };

  const handleSetToNode = (node: Node | null) => {
    setToNode(node);
    setFiltered([]);
    setSelected(null);
  };

  const extractRoomNumber = (lectNum: string) => {
    const match = lectNum.match(/(\d+호)/);
    return match ? match[1] : lectNum;
  };
  

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

  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        if (selected) {
          setSelected(null);
          return true;
        }
        if (filtered.length > 0) {
          setFiltered([]);
          return true;
        }
        if (showPathDetails) {
          setShowPathDetails(false);
          return true;
        }
        return false;
      };
      BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
    }, [selected, filtered, showPathDetails])
  );

  useEffect(() => {
    setShowPathDetails(false);
  }, [fromNode, toNode]);

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
        (err) => console.warn('위치 추적 실패:', err.message),
        { enableHighAccuracy: true, distanceFilter: 1 }
      );
    };
    trackLocation();
  }, []);

  useEffect(() => {
    const loadData = async () => {
      const [buildings, pois, nodes] = await Promise.all([
        fetchBuildingPolygons(),
        fetchPOINodes(),
        fetchNodes()
      ]);
      setBuildingPolygons(buildings);
      setPoiNodes(pois);
      setAllNodes(nodes);
    };
    loadData();
  }, []);

  const drawPath = async () => {
    if (!fromNode || !toNode || fromNode.node_id === toNode.node_id) {
      setPath([]);
      setTotalDistance(null);
      setPathSequence([]);
      return;
    }
  
    try {
      const pathNodes = await fetchShortestPath(fromNode.node_id, toNode.node_id);
      const edgeIds = pathNodes.map(node => node.edge).filter(e => e !== '-1');
      if (edgeIds.length === 0) {
        setPath([]);
        setTotalDistance(null);
        setPathSequence([]);
        return;
      }
  
      const edgeCoords = await fetchEdgeCoordinates(edgeIds);
      const convertedEdges = edgeCoords.map((edge) => {
        const matchededge = pathNodes.find(p => String(p.edge) === String(edge.id));
        return {
          id: edge.id,
          coordinates: edge.coordinates.map(([lng, lat]) => ({ latitude: lat, longitude: lng })),
          nodeid: matchededge?.node,
          floor: edge.floor?.toString(),
          buildname: edge?.buildname,
          realview: matchededge?.realview,
        };
      });
  
      const realviewNodes = pathNodes
        .filter(p => {
          const node = allNodes.find(n => String(n.node_id) === String(p.node));
          return node && node.realview === true;
        })
        .map(p => {
          const node = allNodes.find(n => String(n.node_id) === String(p.node));
          return {
            realview: true,
            nodeLatitude: node.latitude,
            nodeLongitude: node.longitude,
            floor: node.floor?.toString(),
            buildname: node.bulid_name,
            imageName: `${p.edge}_${p.node}`,
            nodeId: node?.node_id,
          };
        });
      
      console.log('realviewNodes:', realviewNodes);
      setRealViewNode(realviewNodes);
      setPath(convertedEdges);
      setTotalDistance(pathNodes[pathNodes.length - 1]?.agg_cost || 0);
  
      // 경로 순서 계산
      const sequence: Array<{ floor: string, buildname: string, distance: number }> = [];
      let currentFloor = convertedEdges[0]?.floor || '야외';
      let currentBuildname = convertedEdges[0]?.buildname || '';
      let accumulatedDistance = 0;
  
      setNodeImageIds(
        pathNodes
          .filter(p => p.edge !== '-1')
          .filter(p => {
            const node = allNodes.find(n => String(n.node_id) === String(p.node));
            return node?.realview === true;
          })
          .map(p => `${p.edge}_${p.node}`)
      );
  
      convertedEdges.forEach((edge) => {
        const edgeFloor = edge.floor || '야외';
        const edgeBuildname = edge.buildname || '';
        if (edge.coordinates.length >= 2) {
          const start = edge.coordinates[0];
          const end = edge.coordinates[edge.coordinates.length - 1];
          const edgeDistance = calculateDistance(start, end);
  
          if (edgeFloor !== currentFloor || edgeBuildname !== currentBuildname) {
            sequence.push({
              floor: currentFloor,
              buildname: currentBuildname,
              distance: accumulatedDistance
            });
            accumulatedDistance = 0;
            currentFloor = edgeFloor;
            currentBuildname = edgeBuildname;
          }
  
          accumulatedDistance += edgeDistance;
        }
      });
  
      if (accumulatedDistance > 0) {
        sequence.push({
          floor: currentFloor,
          buildname: currentBuildname,
          distance: accumulatedDistance
        });
      }
  
      setPathSequence(sequence);
    } catch (error) {
      console.error('경로 계산 실패:', error);
      setPath([]);
      setTotalDistance(null);
      setPathSequence([]);
    }
  };
    
     

  useEffect(() => {
    drawPath();
  }, [fromNode, toNode]);

  useEffect(() => {
    if (search) {
      const results = poiNodes
        .filter(item => item.lect_num?.includes(search))
        .map(item => ({
          ...item,
          distance: currentLocation
            ? Math.sqrt(
                Math.pow(item.latitude - currentLocation.latitude, 2) +
                Math.pow(item.longitude - currentLocation.longitude, 2)
              )
            : Infinity
        }))
        .sort((a, b) => a.distance - b.distance);
      setFiltered(results);
    } else {
      setFiltered([]);
    }
  }, [search, poiNodes, currentLocation]);

  const handleLongPress = (e: any) => {
    setLongPressCoord(e.nativeEvent.coordinate);
    setShowMenu(true);
  };

  const handleSetPoint = (type: 'from' | 'to') => {
    const nearest = findNearestNode(allNodes, longPressCoord.latitude, longPressCoord.longitude, 'outdoor');
    if (type === 'from') handleSetFromNode(nearest);
    else handleSetToNode(nearest);
    setShowMenu(false);
  };

  const handleSwitchNodes = () => {
    setFromNode(toNode);
    setToNode(fromNode);
  };
  
  /////////////////////////////////////////////////
  /////////////////////////////////////////////////
  // 렌더링
  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder="검색"
        value={search}
        onChangeText={(text) => {
          setSearch(text);
          setSelected(null);
        }}
      />

{(fromNode || toNode) && (
  <View style={styles.routeCardBox}>
    <TouchableOpacity onPress={handleSwitchNodes}>
      <Text style={styles.switchIcon}>⇅</Text>
    </TouchableOpacity>

    <View style={styles.routeCardContent}>
      <View style={styles.routeRow}>
        <Text style={styles.dotIcon}>🟢</Text>
        <Text style={styles.routeLabel} numberOfLines={1}>
          {fromNode?.lect_num || '출발지를 선택하세요'}
        </Text>
      </View>
      <View style={styles.routeRow}>
        <Text style={styles.dotIcon}>🔴</Text>
        <Text style={styles.routeLabel} numberOfLines={1}>
          {toNode?.lect_num || '도착지를 선택하세요'}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
        <TouchableOpacity onPress={() => setFromNode(null)}>
          <Text style={{ color: '#007AFF', fontSize: 14 }}>출발지 수정</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setToNode(null)}>
          <Text style={{ color: '#007AFF', fontSize: 14 }}>도착지 수정</Text>
        </TouchableOpacity>
      </View>
    </View>

    <TouchableOpacity
      onPress={() => {
        setFromNode(null);
        setToNode(null);
      }}
    >
      <Text style={styles.clearIcon}>✖</Text>
    </TouchableOpacity>
  </View>
)}

{(fromNode && toNode) && (
  <View style={styles.actionButtonsContainer}>
    <TouchableOpacity
      style={[styles.actionButton, styles.navigateButton]}
      onPress={() => navigation.navigate('Route', { path, nodeImageIds, realviewNode })}
    >
      <Text style={styles.navigateButtonText}>길안내 시작</Text>
    </TouchableOpacity>

    <TouchableOpacity
      style={[styles.actionButton, styles.detailButton]}
      onPress={() => setShowPathDetails(!showPathDetails)}
    >
      <Text style={styles.detailButtonText}>
        {showPathDetails ? '상세정보 off' : '경로 상세정보'}
      </Text>
    </TouchableOpacity>
  </View>
)}


{showPathDetails && path.length > 0 && totalDistance !== null && (
  <View style={styles.summaryWrapper}>
    
    {/* 항상 상단에 고정된 버튼 */}
    <TouchableOpacity
      style={styles.closeSummaryButton}
      onPress={() => setShowPathDetails(false)}
    >
      <Text style={styles.closeSummaryButtonText}>✖</Text>
    </TouchableOpacity>

    {/* 스크롤 가능한 상세 경로 리스트 */}
    <FlatList
      data={pathSequence}
      keyExtractor={(_, index) => `segment-${index}`}
      contentContainerStyle={styles.summaryScrollContainer}
      ListHeaderComponent={
        <Text style={styles.summaryText}>
          총 거리: {totalDistance > 1000
            ? `${(totalDistance / 1000).toFixed(1)} km`
            : `${totalDistance.toFixed(1)} m`}
        </Text>
      }
      renderItem={({ item, index }) => {
        const floorColor = floorColors[item.floor] || floorColors.default;
        return (
          <View style={styles.segmentRow}>
            <Text style={styles.segmentIndex}>{index + 1}.</Text>
            <View style={[styles.colorIndicator, { backgroundColor: floorColor }]} />
            <Text style={styles.segmentLabel}>
              {item.buildname && item.buildname !== '야외' 
                ? `${item.buildname} ${item.floor === '야외' ? '' : item.floor + '층'}`
                : '야외'}
            </Text>
            <Text style={styles.segmentDistance}>
              {item.distance > 1000
                ? `${(item.distance / 1000).toFixed(1)} km`
                : `${item.distance.toFixed(1)} m`}
            </Text>
          </View>
        );
      }}
    />
  </View>
)}


      <MapView
        ref={mapRef}
        customMapStyle={mapStyle}
        style={styles.map}
        followsUserLocation
        showsUserLocation={true}
        showsBuildings={false}
        initialRegion={{
          latitude: currentLocation?.latitude ?? 37.583738,
          longitude: currentLocation?.longitude ?? 127.058393,
          latitudeDelta: 0.007,
          longitudeDelta: 0.007,
        }}
        onLongPress={handleLongPress}
        onPress={() => setSelectedBuildingId(null)}
        onRegionChangeComplete={(region) => setMapZoomLevel(region.latitudeDelta)}
      >
        {currentLocation && (
          <Circle
            center={currentLocation}
            radius={3}
            strokeColor="blue"
            fillColor="rgba(0,0,255,0.5)"
          />
        )}

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


        {filtered.map((item) => (
          <Marker
            key={`marker-${item.node_id}`}
            coordinate={{ latitude: item.latitude, longitude: item.longitude }}
            pinColor="blue"
            onPress={() => {
              setSelected(item);
              mapRef.current?.animateToRegion({
                latitude: item.latitude,
                longitude: item.longitude,
                latitudeDelta: 0.001,
                longitudeDelta: 0.001
              }, 500);
            }}
          />
        ))}

        {selected && (
          <Marker
            coordinate={{ latitude: selected.latitude, longitude: selected.longitude }}
            pinColor="blue"
          />
        )}

        {fromNode && (
          <Marker coordinate={{ latitude: fromNode.latitude, longitude: fromNode.longitude }} pinColor="green">
            <Callout><Text>출발</Text></Callout>
          </Marker>
        )}

        {toNode && (
          <Marker coordinate={{ latitude: toNode.latitude, longitude: toNode.longitude }} pinColor="red">
            <Callout><Text>도착</Text></Callout>
          </Marker>
        )}

        {path.length > 0 && path.map(p => (
          <Polyline
            key={p.id}
            coordinates={p.coordinates}
            strokeColor={floorColors[p.floor?.toString()] || floorColors.default}
            strokeWidth={4}
          />
        ))}
      </MapView>

      {selectedBuildingId !== null && (
        <View style={styles.floorSelectorWrapper}>
          <FloorSelector
            selectedFloor={selectedFloor}
            setSelectedFloor={setSelectedFloor}
            selectedBuildingId={selectedBuildingId}
          />
        </View>
      )}

      {filtered.length > 0 && (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.node_id.toString()}
          style={styles.list}
          ListHeaderComponent={<Text style={styles.header}>검색 결과 (거리순)</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.item}
              onPress={() => {
                setSelected(item);
                setFiltered([]);
                mapRef.current?.animateToRegion({
                  latitude: item.latitude,
                  longitude: item.longitude,
                  latitudeDelta: 0.001,
                  longitudeDelta: 0.001
                }, 500);
              }}
            >
              <Text>{item.lect_num} ({(item.distance * 111000).toFixed(1)} m)</Text>
            </TouchableOpacity>
          )}
        />
      )}

      {selected && (
        <View style={styles.detailContainer}>
          <Image source={require('../../assets/null.png')} style={styles.image} resizeMode="cover" />
          <View style={styles.buttonRow}>
            <TouchableOpacity 
              style={styles.button} 
              onPress={() => handleSetFromNode(selected)}
            >
              <Text style={styles.buttonText}>From</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.button} 
              onPress={() => handleSetToNode(selected)}
            >
              <Text style={styles.buttonText}>To</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.detailText}>장소명: {selected.lect_num}</Text>
          <Text style={styles.detailText}>운영시간: 00:00 ~ 23:00</Text>
        </View>
      )}

      {showMenu && longPressCoord && (
        <View style={styles.menuContainer}>
          <TouchableOpacity style={styles.menuButton} onPress={() => handleSetPoint('from')}>
            <Text style={styles.menuText}>출발지 설정</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuButton} onPress={() => handleSetPoint('to')}>
            <Text style={styles.menuText}>목적지 설정</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuButton} onPress={() => setShowMenu(false)}>
            <Text style={styles.menuText}>취소</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

export default StartScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { ...StyleSheet.absoluteFillObject },
  floorSummaryContainer: {
    width: '100%',
    marginTop: 10,
    marginBottom: 5,
  },
  colorIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 5,
  },
  segmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  segmentIndex: {
    width: 20,
    fontSize: 14,
    color: '#333',
  },
  segmentLabel: {
    flex: 2,
    fontSize: 14,
    color: '#333',
    marginLeft: 5,
  },
  segmentDistance: {
    width: 70,
    fontSize: 14,
    color: '#333',
    marginLeft: 10,
    textAlign: 'right',
  },
  searchInput: {
    position: 'absolute',
    top: 20,
    left: 10,
    right: 10,
    height: 40,
    backgroundColor: 'white',
    borderRadius: 15,
    paddingHorizontal: 15,
    zIndex: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
  },
  floorSelectorWrapper: {
    position: 'absolute',
    top: 170,
    right: 10,
    zIndex: 100,
  },
  list: {
    position: 'absolute',
    bottom: 0,
    left: 10,
    right: 10,
    maxHeight: 200,
    backgroundColor: 'white',
    zIndex: 9,
    borderRadius: 8,
  },
  header: {
    padding: 10,
    fontWeight: 'bold',
    borderBottomWidth: 1,
    borderColor: '#ccc',
  },
  item: {
    padding: 12,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  menuContainer: {
    position: 'absolute',
    bottom: 80,
    left: 20,
    right: 20,
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 10,
    elevation: 10,
  },
  menuButton: {
    padding: 10,
    borderBottomWidth: 1,
    borderColor: '#ccc',
  },
  menuText: {
    fontSize: 16,
    textAlign: 'center',
  },
  summaryContainer: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    elevation: 10,
    zIndex: 100,
  },
  summaryText: {
    fontSize: 16,
    marginBottom: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  actionButtonsContainer: {
    position: 'absolute',
    top: 185,
    left: 30,
    right: 30,
    flexDirection: 'row',
    justifyContent: 'space-around',
    zIndex: 10,
  },
  actionButton: {
    paddingVertical: 5,
    paddingHorizontal: 15,
    borderRadius: 15,
    elevation: 5,
  },
  navigateButton: {
    backgroundColor: '#9BCBEB',
  },
  detailButton: {
    left: 13,
    backgroundColor: '#9BCBEB',
  },
  navigateButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  detailButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  detailContainer: {
    position: 'absolute',
    bottom: 13,
    left: 20,
    right: 20,
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 10,
    elevation: 6,
  },
  image: {
    height: 150,
    width: '100%',
    marginBottom: 10,
    borderRadius: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  button: {
    backgroundColor: '#2ab',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
    textAlign: 'center',
  },
  detailText: {
    fontSize: 14,
    marginVertical: 2,
  },
  switchButton: {
    backgroundColor: '#9BCBEB',
  },
  switchButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },  
  routeCardBox: {
    position: 'absolute',
    top: 70,
    left: 10,
    right: 10,
    backgroundColor: 'white',
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    elevation: 6,
    zIndex: 10,
  },
  routeCardContent: {
    flex: 1,
    marginHorizontal: 12,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  dotIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  routeLabel: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  switchIcon: {
    fontSize: 20,
    color: 'black',
  },
  clearIcon: {
    fontSize: 18,
    color: '#999',
  },  
  summaryWrapper: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    maxHeight: 300, 
    backgroundColor: 'white',
    borderRadius: 10,
    elevation: 10,
    zIndex: 100,
  },
  closeSummaryButton: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderColor: '#eee',
    alignItems: 'center',
  },
  
  closeSummaryButtonText: {
    fontWeight: 'bold',
    fontSize: 16,
    color: 'red',
  },
  
  summaryScrollContainer: {
    paddingHorizontal: 15,
    paddingBottom: 10,
  },
  
});