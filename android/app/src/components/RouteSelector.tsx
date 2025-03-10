import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const RouteSelector = ({ startLocation, endLocation, setStartLocation, setEndLocation }: any) => {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>출발지/도착지 설정</Text>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.button, startLocation && styles.selected]}
          onPress={() => setStartLocation(null)}
        >
          <Text style={styles.buttonText}>{startLocation ? '출발지 삭제' : '출발지 선택'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, endLocation && styles.selected]}
          onPress={() => setEndLocation(null)}
        >
          <Text style={styles.buttonText}>{endLocation ? '도착지 삭제' : '도착지 선택'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    backgroundColor: 'white',
    padding: 0.5,
    borderRadius: 10,
    elevation: 5,
  },
  label: { fontSize: 16, fontWeight: 'bold', marginBottom: -15, textAlign: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  button: { flex: 1, padding: 10, margin: 5, backgroundColor: '#ddd', borderRadius: 5 },
  selected: { backgroundColor: '#007bff' },
  buttonText: { textAlign: 'center', color: '#000' },
});

export default RouteSelector;
