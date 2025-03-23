import React, { useRef, useState, useCallback, memo } from 'react';
import MapView, { Marker, Polygon, Polyline } from 'react-native-maps';
import { View, StyleSheet } from 'react-native';
import { Provider, Menu } from 'react-native-paper';
import type { Building, FloorPolygon, Coordinate, Path } from '../types/types'; // 경로 수정

// Props 타입 인터페이스 (추가)
interface MapComponentProps {
  buildingPolygon: Building[];
  floorPolygons: FloorPolygon[];
  selectedBuilding: number | null;
  setSelectedBuilding: (id: number | null) => void;
  startLocation: Coordinate | null;
  endLocation: Coordinate | null;
  setStartLocation: (coord: Coordinate | null) => void; // 추가된 prop
  setEndLocation: (coord: Coordinate | null) => void;    // 추가된 prop
  path: Path;
}

const PolygonRenderer = memo(({ 
  features, 
  fillColor,
  onPress 
}: {
  features: Building[] | FloorPolygon[];
  fillColor: string;
  onPress?: (id: number) => void;
}) => (
  <>
    {features.map((feature) => {
      try {
        const geojson = JSON.parse(feature.geom_json);
        const polygons = geojson.type === "Polygon" ? [geojson.coordinates] : geojson.coordinates;

        return polygons.map((polygon, i) => (
          <Polygon
            key={`polygon-${feature.id}-${i}`}
            coordinates={polygon[0].map(([lng, lat]) => ({
              latitude: lat,
              longitude: lng,
            }))}
            fillColor={fillColor}
            strokeColor="black"
            strokeWidth={2}
            tappable={!!onPress}
            onPress={() => onPress?.(feature.id)}
          />
        ));
      } catch (error) {
        return null;
      }
    })}
  </>
));

const MapComponent = memo(({
  buildingPolygon,
  floorPolygons,
  selectedBuilding,
  setSelectedBuilding,
  startLocation,
  endLocation,
  setStartLocation, // 추가된 prop
  setEndLocation,   // 추가된 prop
  path
}: MapComponentProps) => {
  const mapRef = useRef<MapView>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [selectedCoords, setSelectedCoords] = useState<Coordinate | null>(null);

  const handleLongPress = useCallback(async (event) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setSelectedCoords({ latitude, longitude });

    if (mapRef.current) {
      try {
        const point = await mapRef.current.pointForCoordinate({ latitude, longitude });
        setMenuPosition({ x: point.x, y: point.y });
        setMenuVisible(true);
      } catch (error) {
        console.error("Coordinate conversion error:", error);
      }
    }
  }, []);

  // 수정된 부분: 의존성 배열 추가
  const setAsStartLocation = useCallback(() => {
    if (selectedCoords) {
      setStartLocation(selectedCoords);
      setMenuVisible(false);
    }
  }, [selectedCoords, setStartLocation]);

  // 수정된 부분: 의존성 배열 추가
  const setAsEndLocation = useCallback(() => {
    if (selectedCoords) {
      setEndLocation(selectedCoords);
      setMenuVisible(false);
    }
  }, [selectedCoords, setEndLocation]);

  return (
    <Provider>
      <View style={styles.container}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={{
            latitude: 37.583738,
            longitude: 127.058393,
            latitudeDelta: 0.007,
            longitudeDelta: 0.007,
          }}
          onLongPress={handleLongPress}
          accessibilityLabel="Campus map"
          accessibilityHint="Interactive map for campus navigation"
        >
          <PolygonRenderer
            features={buildingPolygon}
            fillColor={selectedBuilding ? "rgba(0, 0, 255, 0.3)" : "rgba(255, 0, 0, 0.3)"}
            onPress={setSelectedBuilding}
          />

          <PolygonRenderer
            features={floorPolygons}
            fillColor="rgba(0, 255, 0, 0.3)"
          />

          {startLocation && (
            <Marker
              coordinate={startLocation}
              title="Start"
              pinColor="blue"
              accessibilityLabel="Start location"
            />
          )}

          {endLocation && (
            <Marker
              coordinate={endLocation}
              title="End"
              pinColor="red"
              accessibilityLabel="Destination"
            />
          )}

          {path.length > 0 && (
            <Polyline
              coordinates={path.flatMap(edge => edge.coordinates)}
              strokeWidth={5}
              strokeColor="blue"
              accessibilityLabel="Navigation path"
            />
          )}
        </MapView>

        {menuVisible && menuPosition && (
          <View style={{ position: 'absolute', left: menuPosition.x, top: menuPosition.y }}>
            <Menu
              visible={menuVisible}
              onDismiss={() => setMenuVisible(false)}
              anchor={<View style={styles.menuAnchor} />}
            >
              <Menu.Item 
                onPress={setAsStartLocation} 
                title="Set as Start"
                accessibilityLabel="Set location as start point"
              />
              <Menu.Item 
                onPress={setAsEndLocation} 
                title="Set as Destination"
                accessibilityLabel="Set location as destination"
              />
            </Menu>
          </View>
        )}
      </View>
    </Provider>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  menuAnchor: { width: 1, height: 1 }
});

export default MapComponent;