import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

const FloorSelector = ({ selectedFloor, setSelectedFloor }: any) => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>층 선택</Text>
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.buttons}
        showsVerticalScrollIndicator={false}
      >
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
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {  
    alignSelf: 'flex-end', // 오른쪽 정렬
    marginRight: 10,
    marginTop: 10,
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 15,
    elevation: 5,
    maxHeight: 220,
    top: 0,
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
