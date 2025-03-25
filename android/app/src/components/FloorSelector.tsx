import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';


// 원하는 층 선택 UI 제공
const FloorSelector = ({ selectedFloor, setSelectedFloor }: any) => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>층 선택</Text>
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
    right: 10,
    top: 300, // 필요에 따라 조절 가능
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 15,
    alignItems: 'center', // 텍스트/버튼 중앙 정렬
    elevation: 5,
  },
  text: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
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
