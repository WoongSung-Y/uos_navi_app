import React, { useRef, useState } from "react";
import MapView, { Marker, Polygon, Polyline } from "react-native-maps";
import { View, StyleSheet } from "react-native";
import { Provider, Menu } from "react-native-paper";

const MapComponent = ({ 
  buildingPolygon, 
  floorPolygons,
  selectedBuilding, 
  setSelectedBuilding, 
  startLocation, 
  endLocation, 
  setStartLocation, 
  setEndLocation, 
  path 
}) => {
  const mapRef = useRef<MapView>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [selectedCoords, setSelectedCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  // 지도 길게 누를 때 출발지/도착지 설정
  const handleLongPress = async (event) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    console.log("길게 누른 위치:", latitude, longitude);

    setSelectedCoords({ latitude, longitude }); // 좌표 저장

    if (mapRef.current) {
      try {
        const point = await mapRef.current.pointForCoordinate({ latitude, longitude });
        console.log("변환된 화면 좌표:", point);
        setMenuPosition({ x: point.x, y: point.y });
        setMenuVisible(true);
      } catch (error) {
        console.error("좌표 변환 오류:", error);
      }
    }
  };

  // 출발지 설정
  const setAsStartLocation = () => {
    if (selectedCoords) {
      setStartLocation(selectedCoords);
      setMenuVisible(false);
    }
  };

  // 도착지 설정
  const setAsEndLocation = () => {
    if (selectedCoords) {
      setEndLocation(selectedCoords);
      setMenuVisible(false);
    }
  };

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
        >
          {/*** 건물 폴리곤 렌더링 ***/}
          {buildingPolygon.map((feature, index) => {
            try {
              const geojson = JSON.parse(feature.geom_json);
              const polygons = geojson.type === "Polygon" ? [geojson.coordinates] : geojson.coordinates;

              return polygons.map((polygon, i) => {
                const coords = polygon[0].map(([lng, lat]) => ({
                  latitude: lat,
                  longitude: lng,
                }));

                return (
                  <Polygon
                    key={`${index}-${i}`}
                    coordinates={coords}
                    fillColor={selectedBuilding === feature.id ? "rgba(0, 0, 255, 0.3)" : "rgba(255, 0, 0, 0.3)"}
                    strokeColor="black"
                    strokeWidth={2}
                    tappable
                    onPress={() => setSelectedBuilding(feature.id)}
                  />
                );
              });
            } catch (error) {
              console.error(`건물 폴리곤 오류 (건물 ID: ${feature.id}):`, error);
              return null;
            }
          })}

          {/*** 층별 폴리곤 렌더링 ***/}
          {floorPolygons.map((feature, index) => {
            try {
              const geojson = JSON.parse(feature.geom_json);
              const polygons = geojson.type === "Polygon" ? [geojson.coordinates] : geojson.coordinates;

              return polygons.map((polygon, i) => {
                const coords = polygon[0].map(([lng, lat]) => ({
                  latitude: lat,
                  longitude: lng,
                }));

                return (
                  <Polygon
                    key={`floor-${index}-${i}`}
                    coordinates={coords}
                    fillColor="rgba(0, 255, 0, 0.3)"
                    strokeColor="black"
                    strokeWidth={2}
                  />
                );
              });
            } catch (error) {
              console.error(`층 폴리곤 오류 (층 ID: ${feature.id}):`, error);
              return null;
            }
          })}

          {/*** 출발지 & 도착지 마커 ***/}
          {startLocation && <Marker coordinate={startLocation} title="출발지" pinColor="blue" />}
          {endLocation && <Marker coordinate={endLocation} title="도착지" pinColor="red" />}

          {/*** 최단 경로 표시 ***/}
          {path.length > 0 && (
            <Polyline 
              coordinates={path.flatMap(edge => edge.coordinates)} 
              strokeWidth={5} 
              strokeColor="blue" 
            />
          )}
        </MapView>

        {/*** 출발지/도착지 선택 메뉴 ***/}
        {menuVisible && menuPosition && (
          <View style={{ position: 'absolute', left: menuPosition.x, top: menuPosition.y }}>
            <Menu
              visible={menuVisible}
              onDismiss={() => setMenuVisible(false)}
              anchor={<View style={{ width: 1, height: 1 }} />}
            >
              <Menu.Item onPress={setAsStartLocation} title="출발지로 설정" />
              <Menu.Item onPress={setAsEndLocation} title="도착지로 설정" />
            </Menu>
          </View>
        )}
      </View>
    </Provider>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
});

export default MapComponent;