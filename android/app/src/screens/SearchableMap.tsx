import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import MapView, { Marker, Polyline, Callout } from 'react-native-maps';
import {
  fetchPOINodes,
  fetchNodes,
  fetchShortestPath,
  fetchEdgeCoordinates,
} from '../services/api';
import { findNearestNode } from '../utils/findNearestNode';
import type { Node, Coordinate } from '../types';

const SearchableMap = () => {
  const [search, setSearch] = useState('');
  const [poiList, setPoiList] = useState<Node[]>([]);
  const [allNodes, setAllNodes] = useState<Node[]>([]);
  const [selected, setSelected] = useState<Node | null>(null);
  const [fromLocation, setFromLocation] = useState<Node | null>(null);
  const [toLocation, setToLocation] = useState<Node | null>(null);
  const [path, setPath] = useState<Coordinate[]>([]);

  useEffect(() => {
    const load = async () => {
      const pois = await fetchPOINodes();
      const nodes = await fetchNodes();
      setPoiList(pois);
      setAllNodes(nodes);
    };
    load();
  }, []);

  const filtered = search
    ? poiList.filter((item) => item.lect_num?.includes(search)).sort((a, b) => a.node_id - b.node_id)
    : [];

  useEffect(() => {
    const drawPath = async () => {
      if (!fromLocation || !toLocation) return;

      const fromNode = findNearestNode(allNodes, fromLocation.latitude, fromLocation.longitude, 'outdoor');
      const toNode = findNearestNode(allNodes, toLocation.latitude, toLocation.longitude, 'outdoor');

      if (!fromNode || !toNode) {
        console.warn('출발지 또는 도착지 주변 노드 찾기 실패');
        return;
      }

      console.log('fromNode:', fromNode);
      console.log('toNode:', toNode);

      const pathNodes = await fetchShortestPath(fromNode.node_id, toNode.node_id, 'outdoor');
      console.log('최단경로 pathNodes 응답:', pathNodes);

      const edgeIds = pathNodes
        .filter(n => typeof n.edge === 'number' && n.edge !== -1)
        .map(n => n.edge);

      console.log('🛣️ 유효한 edgeIds:', edgeIds);

      if (edgeIds.length === 0) {
        console.warn('edgeIds 비어 있음');
        setPath([]); // 경로 초기화
        return;
      }

      const edgeCoords = await fetchEdgeCoordinates(edgeIds);
      console.log(' 응답:', edgeCoords);

      const coordinates: Coordinate[] = edgeCoords.flatMap((edge) =>
        edge.coordinates
          .filter(
            (coord) =>
              coord &&
              typeof coord.latitude === 'number' &&
              typeof coord.longitude === 'number'
          )
          .map(({ latitude, longitude }) => ({ latitude, longitude }))
      );

      console.log('최종 Polyline 좌표:', coordinates);
      setPath(coordinates);
    };

    drawPath();
  }, [fromLocation, toLocation, allNodes]);

  return (
    <View style={{ flex: 1 }}>
      <TextInput
        style={styles.input}
        placeholder="ex) 607호"
        value={search}
        onChangeText={(text) => {
          setSearch(text);
          setSelected(null);
        }}
      />

      <MapView
        style={{ flex: 1 }}
        initialRegion={{
          latitude: 37.583738,
          longitude: 127.058393,
          latitudeDelta: 0.007,
          longitudeDelta: 0.007,
        }}
      >
        {!selected &&
          filtered.map((item) => (
            <Marker
              key={item.node_id}
              coordinate={{ latitude: item.latitude, longitude: item.longitude }}
              pinColor="blue"
            />
          ))}

        {selected && (
          <Marker coordinate={{ latitude: selected.latitude, longitude: selected.longitude }} pinColor="blue" />
        )}

        {fromLocation && (
          <Marker coordinate={{ latitude: fromLocation.latitude, longitude: fromLocation.longitude }} pinColor="green">
            <Callout>
              <Text>출발지</Text>
            </Callout>
          </Marker>
        )}

        {toLocation && (
          <Marker coordinate={{ latitude: toLocation.latitude, longitude: toLocation.longitude }} pinColor="red">
            <Callout>
              <Text>도착지</Text>
            </Callout>
          </Marker>
        )}

        {path.length > 0 && (
          <Polyline coordinates={path} strokeWidth={5} strokeColor="blue" />
        )}
      </MapView>

      {selected && (
        <View style={styles.detailContainer}>
          <Image
            source={require('../../assets/null.png')}
            style={styles.image}
            resizeMode="cover"
          />
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.button}
              onPress={() => setFromLocation(selected)}
            >
              <Text style={styles.buttonText}>From</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.button}
              onPress={() => setToLocation(selected)}
            >
              <Text style={styles.buttonText}>To</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.detailText}>운영시간: 00:00 ~ 23:00</Text>
          <Text style={styles.detailText}>전화번호: 02-0000-0000</Text>
        </View>
      )}

      {!selected && filtered.length > 0 && (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.node_id.toString()}
          style={styles.list}
          ListHeaderComponent={<Text style={styles.header}>검색 결과 (거리순)</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.item}
              onPress={() => setSelected(item)}
            >
              <Text>{item.lect_num}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
};

export default SearchableMap;

const styles = StyleSheet.create({
  input: {
    height: 40,
    margin: 10,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 2,
  },
  list: {
    maxHeight: 200,
    backgroundColor: 'white',
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
  detailContainer: {
    backgroundColor: 'white',
    padding: 10,
    elevation: 5,
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
    fontWeight: 'bold',
  },
  detailText: {
    fontSize: 14,
    marginVertical: 2,
  },
});
