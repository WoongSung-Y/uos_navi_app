import React, { useState } from 'react';
import {
  View,
  TextInput,
  FlatList,
  TouchableOpacity,
  Text,
  StyleSheet,
  Image,
} from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import { useRoute } from '@react-navigation/native';

const dummyData = [
  {
    id: '1',
    name: '정보기술관 607호',
    coord: { latitude: 37.5842, longitude: 127.058 },
    distance: 250,
    image: require('../../assets/info_tech.png'),
    hours: '00:00 ~ 23:00',
    phone: '02-6490-1111',
  },
  {
    id: '2',
    name: '자연과학관 607호',
    coord: { latitude: 37.5825, longitude: 127.057 },
    distance: 300,
    image: require('../../assets/naturalscience.png'),
    hours: '08:00 ~ 20:00',
    phone: '02-6490-2222',
  },
  {
    id: '3',
    name: '21세기관 607호',
    coord: { latitude: 37.5830, longitude: 127.056 },
    distance: 400,
    image: require('../../assets/21th.png'),
    hours: '07:00 ~ 22:00',
    phone: '02-6490-3333',
  },
  {
    id: '4',
    name: '제2공학관 607호',
    coord: { latitude: 37.5850, longitude: 127.059 },
    distance: 700,
    image: require('../../assets/null.png'),
    hours: '09:00 ~ 18:00',
    phone: '02-6490-4444',
  },
];

const SearchableMap = () => {
  const route = useRoute();
  const currentLocation = route.params?.currentLocation;

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [fromLocation, setFromLocation] = useState<any>(null);
  const [toLocation, setToLocation] = useState<any>(null);

  const filtered = search
    ? dummyData.filter((item) => item.name.includes(search)).sort((a, b) => a.distance - b.distance)
    : [];

  return (
    <View style={{ flex: 1 }}>
      <TextInput
        style={styles.input}
        placeholder="ex) 607호"
        value={search}
        onChangeText={(text) => {
          setSearch(text);
          setSelected(null); // 검색 중엔 선택 해제
        }}
      />

      <MapView
        style={{ flex: 1 }}
        initialRegion={{
          latitude: currentLocation?.latitude ?? 37.583738,
          longitude: currentLocation?.longitude ?? 127.058393,
          latitudeDelta: 0.007,
          longitudeDelta: 0.007,
        }}
      >
        {/* 검색 결과 마커 */}
        {!selected &&
          filtered.map((item) => (
            <Marker key={item.id} coordinate={item.coord} pinColor="blue" />
          ))}

        {/* 선택된 장소 마커 */}
        {selected && (
          <Marker coordinate={selected.coord} pinColor="blue" />
        )}

        {/* 출발지 마커 */}
        {fromLocation && (
          <Marker coordinate={fromLocation.coord} pinColor="green">
            <Callout tooltip>
              <View style={styles.callout}>
                <Text style={styles.calloutText}>출발지</Text>
              </View>
            </Callout>
          </Marker>
        )}

        {/* 도착지 마커 */}
        {toLocation && (
          <Marker coordinate={toLocation.coord} pinColor="red">
            <Callout tooltip>
              <View style={styles.callout}>
                <Text style={styles.calloutText}>도착지</Text>
              </View>
            </Callout>
          </Marker>
        )}
      </MapView>

      {/* 상세 정보 및 버튼 */}
      {selected && (
        <View style={styles.detailContainer}>
          <Image
            source={selected.image || require('../../assets/null.png')}
            style={styles.image}
            resizeMode="cover"
          />
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.button}
              onPress={() => setFromLocation({ ...selected })}
            >
              <Text style={styles.buttonText}>From</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.button}
              onPress={() => setToLocation({ ...selected })}
            >
              <Text style={styles.buttonText}>To</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.detailText}>운영시간: {selected.hours}</Text>
          <Text style={styles.detailText}>전화번호: {selected.phone}</Text>
        </View>
      )}

      {/* 검색 리스트 */}
      {!selected && filtered.length > 0 && (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          style={styles.list}
          ListHeaderComponent={<Text style={styles.header}>검색 결과 (거리순)</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.item}
              onPress={() => setSelected(item)}
            >
              <Text>{item.name} ({item.distance}m)</Text>
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
  callout: {
    backgroundColor: 'white',
    padding: 6,
    borderRadius: 6,
    borderColor: '#ccc',
    borderWidth: 1,
  },
  calloutText: {
    fontWeight: 'bold',
    color: 'black',
  },
});
