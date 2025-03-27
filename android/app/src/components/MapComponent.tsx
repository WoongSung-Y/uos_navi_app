import React, { useRef, useState } from "react";
import MapView, { Marker, Polygon, Polyline, Circle } from "react-native-maps";
import { View, StyleSheet, Text } from "react-native";
import { Provider, Menu } from "react-native-paper";

const MapComponent = ({ 
  buildingPolygon, 
  floorPolygons,
  selectedBuilding, 
  setSelectedBuilding, 
  currentLocation,
  allEdge,
  setSelectedEdgeId,
  nodes,
}) => {
  const mapRef = useRef<MapView>(null);
  const [selectedLinkId, setSelectedLinkId] = useState<number | null>(null);

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
          showsUserLocation={true}
          showsMyLocationButton={true}
          showsBuildings={false}
          onPress={() => {setSelectedBuilding(null); setSelectedLinkId(null);}}
        >
{/* 선택된 링크의 노드 위치를 원으로 표시 */}
{selectedLinkId !== null && (() => {
  const selectedEdge = allEdge.find(e => e.id === selectedLinkId);
  if (!selectedEdge) return null;

  const node1 = nodes.find(n => n.node_id === selectedEdge.node1);
  const node2 = nodes.find(n => n.node_id === selectedEdge.node2);

  return (
    <>
      {node1 && (
        <Circle
          key={`node1-${node1.id}`}
          center={{ latitude: node1.latitude, longitude: node1.longitude }}
          radius={0.5} // 반경 작게
          fillColor="rgba(0, 200, 0, 0.8)" // 초록색
          strokeColor="white"
          strokeWidth={1}
        />
      )}
      {node2 && (
        <Circle
          key={`node2-${node2.id}`}
          center={{ latitude: node2.latitude, longitude: node2.longitude }}
          radius={0.5}
          fillColor="rgba(255, 165, 0, 0.8)" // 주황색
          strokeColor="white"
          strokeWidth={1}
        />
      )}
    </>
  );
})()}




        {/* 현재 위치를 원형 마커로 표시 */}
        {currentLocation && (
        <>
          <Circle
            center={currentLocation}
            
            strokeColor="rgba(0, 122, 255, 0.7)"
            fillColor="rgba(0, 122, 255, 0.3)"
          />
          </>
        )}
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

{allEdge.map((edge, index) => {
  const coords = edge.coordinates.map(([lng, lat]) => ({
    latitude: lat,
    longitude: lng,
  }));

  const isSelected = edge.id === selectedLinkId;

  return (
    <Polyline
      key={`floor-${index}`}
      coordinates={coords}
      strokeWidth={isSelected ? 5 : 3}  // 선택되면 굵게
      strokeColor={isSelected ? 'rgb(255, 0, 0)' : 'rgb(0, 255, 234)'} // 선택되면 파란색
      tappable={true}
      onPress={() => {
        setSelectedLinkId(edge.id);
        setSelectedEdgeId(edge.id);}}
    />
  );
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
        </MapView>
        {selectedLinkId !== null && (
        <Text style={{ position: 'absolute', top: 50, left: 20, fontSize: 16, backgroundColor: 'white', padding: 4 }}>
          선택된 링크 ID: {selectedLinkId}
        </Text>
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