//검색화면 -> POI 데이터 기반
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
import type { Node, Coordinate, Building } from '../types/types';

const StartScreen = () => {
  const [FloorPolygons, setFloorPolygons] = useState([]);
  const [selectedFloor, setSelectedFloor] = useState<string>('1');
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null);
  const [buildingPolygons, setBuildingPolygons] = useState<Building[]>([]);
  const [poiNodes, setPoiNodes] = useState<Node[]>([]);
  const [allNodes, setAllNodes] = useState<Node[]>([]);
  const [fromNode, setFromNode] = useState<Node | null>(null);
  const [toNode, setToNode] = useState<Node | null>(null);
  const [path, setPath] = useState<{ id: string, coordinates: Coordinate[] }[]>([]);
  const [nodeImageIds, setNodeImageIds] = useState<string[]>([]);
  const [totalDistance, setTotalDistance] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [filtered, setFiltered] = useState<Node[]>([]);
  const [selected, setSelected] = useState<Node | null>(null);
  const navigation = useNavigation();
  const route = useRoute();
  const [isSatellite, setIsSatellite] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<any>(route.params?.currentLocation || null);
  const mapRef = useRef<MapView>(null);
  const [longPressCoord, setLongPressCoord] = useState<any>(null);
  const [showMenu, setShowMenu] = useState(false);

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
        return false;
      };

      BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
    }, [selected, filtered])
  );

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

  useEffect(() => {
    const drawPath = async () => {
      if (!fromNode || !toNode || fromNode.node_id === toNode.node_id) return;
      const pathNodes = await fetchShortestPath(fromNode.node_id, toNode.node_id);
      const edgeIds = pathNodes.map(node => node.edge).filter(e => e !== '-1');
      if (edgeIds.length === 0) {
        setPath([]);
        return;
      }
      const edgeCoords = await fetchEdgeCoordinates(edgeIds);
      const convertedEdges = edgeCoords.map((edge) => ({
        id: edge.id,
        coordinates: edge.coordinates.map(([lng, lat]) => ({ latitude: lat, longitude: lng }))
      }));
      setPath(convertedEdges);
      setTotalDistance(pathNodes[pathNodes.length - 1]?.agg_cost || 0);
      const nodeImageIds = pathNodes
        .filter(p => p.edge !== '-1')
        .map(p => `${p.edge}_${p.node}`);
      setNodeImageIds(nodeImageIds);
    };
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
    if (type === 'from') setFromNode(nearest);
    else setToNode(nearest);
    setShowMenu(false);
  };

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
        <View style={styles.fixedRouteBox}>
          <Text>출발지: {fromNode?.lect_num || '미지정'} | 도착지: {toNode?.lect_num || '미지정'}</Text>
        </View>
      )}

      <MapView
        ref={mapRef}
        customMapStyle={mapStyle}
        style={styles.map}
        followsUserLocation
        showsUserLocation = {true}
        showsBuildings={false} 
        mapType={isSatellite ? 'satellite' : 'standard'}
        initialRegion={{
          latitude: currentLocation?.latitude ?? 37.583738,
          longitude: currentLocation?.longitude ?? 127.058393,
          latitudeDelta: 0.007,
          longitudeDelta: 0.007,
        }}
        onLongPress={handleLongPress}
        onPress={() => setSelectedBuildingId(null)}>
        {/* 현재 위치를 파란색 원으로 표시 */}
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
            <Callout><Text>출발지</Text></Callout>
          </Marker>
        )}
        {toNode && (
          <Marker coordinate={{ latitude: toNode.latitude, longitude: toNode.longitude }} pinColor="red">
            <Callout><Text>도착지</Text></Callout>
          </Marker>
        )}
        {path.length > 0 && path.map(p => (
          <Polyline key={p.id} coordinates={p.coordinates} strokeColor="blue" strokeWidth={4} />
        ))}
      </MapView>
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
              }}>
              <Text>{item.lect_num} ({(item.distance * 111000).toFixed(1)} m)</Text>
            </TouchableOpacity>
          )}
        />
      )}
      {selected && (
        <View style={styles.detailContainer}>
          <Image source={require('../../assets/null.png')} style={styles.image} resizeMode="cover" />
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.button} onPress={() => setFromNode(selected)}>
              <Text style={styles.buttonText}>From</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={() => setToNode(selected)}>
              <Text style={styles.buttonText}>To</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.detailText}>장소명: {selected.lect_num}</Text>
          <Text style={styles.detailText}>운영시간: 00:00 ~ 23:00</Text>
        </View>
      )}
      {path.length > 0 && totalDistance !== null && (
        <View style={styles.summaryContainer}>
          <Text style={styles.summaryText}>총 거리: {totalDistance.toFixed(1)} m</Text>
          <TouchableOpacity
            style={styles.navigateButton}
            onPress={() => navigation.navigate('Route', { path, nodeImageIds })}>
            <Text style={styles.navigateButtonText}>길찾기 시작</Text>
          </TouchableOpacity>
        </View>
      )}
      {showMenu && longPressCoord && (
        <View style={styles.menuContainer}>
          <TouchableOpacity style={styles.menuButton} onPress={() => handleSetPoint('from')}>
            <Text style={styles.menuText}>출발지 설정</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuButton} onPress={() => handleSetPoint('to')}>
            <Text style={styles.menuText}>도착지 설정</Text>
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
  searchInput: {
    position: 'absolute', top: 20, left: 10, right: 10,
    height: 40, backgroundColor: 'white', borderRadius: 10,
    paddingHorizontal: 10, zIndex: 10, elevation: 5,
  },
  fixedRouteBox: {
    position: 'absolute', top: 70, left: 10, right: 10,
    height: 40, backgroundColor: 'white', borderRadius: 10,
    paddingHorizontal: 10, justifyContent: 'center', zIndex: 10, elevation: 5,
  },
  list: {
    position: 'absolute', bottom: 0, left: 10, right: 10, maxHeight: 200,
    backgroundColor: 'white', zIndex: 9, borderRadius: 8,
  },
  header: { padding: 10, fontWeight: 'bold', borderBottomWidth: 1, borderColor: '#ccc' },
  item: { padding: 12, borderBottomWidth: 1, borderColor: '#eee' },
  menuContainer: {
    position: 'absolute', bottom: 80, left: 20, right: 20,
    backgroundColor: 'white', borderRadius: 10, padding: 10, elevation: 10,
  },
  menuButton: { padding: 10, borderBottomWidth: 1, borderColor: '#ccc' },
  menuText: { fontSize: 16, textAlign: 'center' },
  summaryContainer: {
    position: 'absolute', bottom: 40, left: 20, right: 20,
    backgroundColor: 'white', padding: 15, borderRadius: 10,
    elevation: 5, alignItems: 'center',
  },
  summaryText: { fontSize: 16, marginBottom: 10 },
  navigateButton: {
    backgroundColor: '#2196F3', paddingVertical: 10,
    paddingHorizontal: 30, borderRadius: 20,
  },
  navigateButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  detailContainer: {
    position: 'absolute', bottom: 13, left: 20, right: 20,
    backgroundColor: 'white', padding: 10, borderRadius: 10, elevation: 6,
  },
  image: { height: 150, width: '100%', marginBottom: 10, borderRadius: 8 },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 10 },
  button: { backgroundColor: '#2ab', paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20 },
  buttonText: { color: 'white', fontWeight: 'bold' },
  detailText: { fontSize: 14, marginVertical: 2 }
});