import React, { useEffect, useRef, useState} from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { fetchBuildingPolygons  } from '../services/api';

const FloorSelector = ({ selectedFloor, setSelectedFloor, selectedBuildingId }: any) => {
  const [floors, setFloors] = useState<string[]>([]);

  useEffect(() => {
    const loadFloors = async () => {
      const buildings = await fetchBuildingPolygons();
      const target = buildings.find((b: any) => b.id === selectedBuildingId);
      if (target) {
        const range = Array.from(
          { length: target.max_floor - target.min_floor + 1 },
          (_, i) => (target.min_floor + i).toString()
        );
        setFloors(range);
      }
    };

    if (selectedBuildingId) {
      loadFloors();
    }
  }, [selectedBuildingId]);
    const listRef = useRef(null);

    useEffect(() => {
      const index = floors.findIndex(f => f === selectedFloor);
      if (index !== -1 && listRef.current) {
        listRef.current.scrollToIndex({
          index: Math.max(index - 1, 0),
          animated: true,
          viewPosition: 0.5,
        });
      }
    }, [selectedFloor, floors]);

  return (
    <View style={styles.container}>
      <FlatList
  ref={listRef}
  data={floors}
  keyExtractor={(item) => item}
  showsVerticalScrollIndicator={false}
  style={styles.scrollContainer}
  contentContainerStyle={styles.buttons}
  getItemLayout={(data, index) => ({
    length: 56,
    offset: 56 * index,
    index,
  })}
  renderItem={({ item }) => (
    <TouchableOpacity
      style={[
        styles.button,
        selectedFloor === item && styles.selectedButton,
      ]}
      onPress={() => setSelectedFloor(item)}
    >
      <Text
        style={[
          styles.buttonText,
          selectedFloor === item && styles.selectedButtonText,
        ]}
      >
        {item}층
      </Text>
    </TouchableOpacity>
  )}
/>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-end',
    marginRight: 10,
    right: -10,
    marginTop: 10,
    backgroundColor: 'white',
    padding: 8,
    borderRadius: 15,
    elevation: 5,
    maxHeight: 220,
    top: '40%',
  },
  text: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    alignSelf: 'center',
  },
  scrollContainer: {
    maxHeight: 100,
  },
  buttons: {
    alignItems: 'center',
  },
  button: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
    marginBottom: 6,
    width: 50,
    alignItems: 'center',
  },
  selectedButton: {
    backgroundColor: '#007bff',
  },
  buttonText: {
    fontWeight: 'bold',
    color: '#000',
  },
  selectedButtonText: {
    color: '#fff',
  },
});


export default FloorSelector;
