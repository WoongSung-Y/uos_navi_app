import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';


// 원하는 층 선택 UI 제공
const FloorSelector = ({ selectedFloor, setSelectedFloor }: any) => {
  return (
    <View style={styles.container}>
      <View style={styles.buttons}>
        {['1', '2', '3', '4', '5', '6'].map((floor) => (
          <TouchableOpacity
            key={floor}
            style={[
              styles.button,
              selectedFloor === floor && styles.selectedButton,
            ]}
            onPress={() => setSelectedFloor(floor)}
          >
            <Text
              style={[
                styles.buttonText,
                selectedFloor === floor && styles.selectedButtonText,
              ]}
            >
              {floor}층
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 15,
  },
  text: { fontSize: 16, fontWeight: 'bold', marginBottom: -20 },
  buttons: { flexDirection: 'row', justifyContent: 'space-around' },
  button: { padding: 10, backgroundColor: '#f0f0f0', borderRadius: 5 },
  selectedButton: { backgroundColor: '#007bff' },
  buttonText: { fontWeight: 'bold', color: '#000' },
  selectedButtonText: { color: '#fff' },
});

export default FloorSelector;
