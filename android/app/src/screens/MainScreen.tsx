// src/screens/MainScreen.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, Image, Keyboard, Modal, TouchableOpacity } from 'react-native';
import MapComponent from '../components/MapComponent';
import FloorSelector from '../components/FloorSelector';
import LocationButton from '../components/LocationButton';
import CameraButton from "../components/CameraButton";
import { fetchBuildingPolygons, fetchShortestPath, fetchNodes, fetchFloorPolygons, fetchEdgeCoordinates } from '../services/api';
import { findNearestNode } from '../utils/findNearestNode';
import type { Building, FloorPolygon, Node, Path } from '../types';
import Toast from 'react-native-toast-message';

type Coordinate = {
  latitude: number;
  longitude: number;
};

const MainScreen = () => {
  const [floorPolygons, setFloorPolygons] = useState<FloorPolygon[]>([]);
  const [buildingPolygon, setBuildingPolygon] = useState<Building[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<number | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<string>("1");
  const [startLocation, setStartLocation] = useState<Coordinate | null>(null);
  const [endLocation, setEndLocation] = useState<Coordinate | null>(null);
  const [startText, setStartText] = useState("");
  const [endText, setEndText] = useState("");
  const [path, setPath] = useState<Path>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isImageVisible, setIsImageVisible] = useState(false);

  const startInputRef = useRef<TextInput>(null);
  const endInputRef = useRef<TextInput>(null);

  const showErrorToast = (message: string) => {
    Toast.show({
      type: 'error',
      text1: 'Error',
      text2: message,
      visibilityTime: 3000,
    });
  };

  const loadBuildings = useCallback(async () => {
    try {
      const data = await fetchBuildingPolygons();
      setBuildingPolygon(data);
    } catch (error) {
      showErrorToast('Failed to load buildings');
    }
  }, []);

  const loadNodes = useCallback(async () => {
    try {
      const data = await fetchNodes();
      setNodes(data);
    } catch (error) {
      showErrorToast('Failed to load nodes');
    }
  }, []);

  const loadFloorPolygons = useCallback(async () => {
    if (!selectedBuilding) return;

    try {
      const data = await fetchFloorPolygons(selectedFloor, selectedBuilding);
      setFloorPolygons(data);
    } catch (error) {
      showErrorToast('Failed to load floor data');
    }
  }, [selectedBuilding, selectedFloor]);

  useEffect(() => { loadBuildings(); }, [loadBuildings]);
  useEffect(() => { loadNodes(); }, [loadNodes]);
  useEffect(() => { loadFloorPolygons(); }, [loadFloorPolygons]);

  const handleSetStartLocation = useCallback((coord: Coordinate | null) => {
    setStartLocation(coord);
  }, []);

  const handleSetEndLocation = useCallback((coord: Coordinate | null) => {
    setEndLocation(coord);
  }, []);

  const handleImageCapture = useCallback((uri: string | null) => {
    setCapturedImage(uri);
    if (uri) {
      Toast.show({
        type: 'success',
        text1: '촬영 완료',
        text2: '이미지가 저장되었습니다.',
      });
    }
  }, []);

  const closeImageModal = useCallback(() => {
    setIsImageVisible(false);
  }, []);

  const geocodeAddress = async (address: string, setLocation: (coord: Coordinate | null) => void) => {
    if (!address.trim()) return;

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`
      );
      const data = await response.json();

      if (data.length > 0) {
        setLocation({
          latitude: parseFloat(data[0].lat),
          longitude: parseFloat(data[0].lon),
        });
      }
    } catch (error) {
      showErrorToast('Address lookup failed');
    }
  };

  const calculatePath = useCallback(async () => {
    if (!startLocation || !endLocation || nodes.length === 0) return;

    const startNode = findNearestNode(nodes, startLocation.latitude, startLocation.longitude, "outdoor");
    const endNode = findNearestNode(nodes, endLocation.latitude, endLocation.longitude, "outdoor");

    if (!startNode || !endNode) {
      showErrorToast('Cannot find nearest node');
      return;
    }

    try {
      const shortestPath = await fetchShortestPath(startNode.node_id, endNode.node_id, "outdoor");
      const edgeIds = shortestPath.map(node => node.edge);
      const edges = await fetchEdgeCoordinates(edgeIds);

      setPath(edges.map(edge => ({
        id: edge.id,
        coordinates: edge.coordinates.map(([lng, lat]) => ({
          latitude: lat,
          longitude: lng,
        })),
      })));
    } catch (error) {
      showErrorToast('Path calculation failed');
    }
  }, [startLocation, endLocation, nodes]);

  useEffect(() => { calculatePath(); }, [calculatePath]);

  return (
    <View style={styles.container}>
      <Toast />

      <View style={styles.inputContainer}>
        <Text style={styles.title}>서울시립대학교 캠퍼스 내비게이션</Text>
        <TextInput
          ref={startInputRef}
          style={styles.input}
          placeholder="출발지를 입력하세요"
          value={startText}
          onChangeText={setStartText}
          onSubmitEditing={() => {
            geocodeAddress(startText, setStartLocation);
            Keyboard.dismiss();
          }}
          returnKeyType="done"
        />
        <TextInput
          ref={endInputRef}
          style={styles.input}
          placeholder="도착지를 입력하세요"
          value={endText}
          onChangeText={setEndText}
          onSubmitEditing={() => {
            geocodeAddress(endText, setEndLocation);
            Keyboard.dismiss();
          }}
          returnKeyType="done"
        />
      </View>

      <MapComponent
        buildingPolygon={buildingPolygon}
        floorPolygons={floorPolygons}
        selectedBuilding={selectedBuilding}
        setSelectedBuilding={setSelectedBuilding}
        selectedFloor={selectedFloor}
        startLocation={startLocation}
        endLocation={endLocation}
        setStartLocation={handleSetStartLocation}
        setEndLocation={handleSetEndLocation}
        path={path}
      />

      <Modal
        visible={isImageVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={closeImageModal}
      >
        <View style={styles.modalContainer}>
          <Image
            source={{ uri: capturedImage }}
            style={styles.fullSizeImage}
            resizeMode="contain"
          />
          <TouchableOpacity style={styles.closeButton} onPress={closeImageModal}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <CameraButton onCapture={handleImageCapture} />
      <LocationButton />

      {selectedBuilding !== null && (
        <FloorSelector
          selectedFloor={selectedFloor}
          setSelectedFloor={setSelectedFloor}
        />
      )}
    </View>
  );
};

export default MainScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  inputContainer: {
    padding: 10,
    backgroundColor: "white",
    elevation: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
  },
  input: {
    height: 40,
    borderColor: "#ddd",
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 10,
    marginVertical: 5,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  fullSizeImage: {
    width: '90%',
    height: '80%'
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1
  },
  closeText: {
    fontSize: 24,
    color: 'black'
  }
});
