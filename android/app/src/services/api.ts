const ngrokBaseUrl = 'http://15.165.159.29:3000';

// 서버에서 건물 polygon 데이터 가져오는 함수: fetchBuildingPolygons
// 반환값: 건물 폴리곤 -> app.tsx에서 buildingPolygon state에 업데이트
export const fetchBuildingPolygons = async () => {
  try {
    const response = await fetch(`${ngrokBaseUrl}/api/total_building`); // 서버에서 데이터 요청, /api/total_building: 건물 데이터 가져오는 API 엔드포인트
    return await response.json(); // 응답 받은 데이터: JSON 형식으로 변환
  } catch (error) {
    console.error('건물 데이터 Fetch 오류:', error);
    return [];
  }
};

// 서버에서 층 polygon 데이터 가져오는 함수: fetchFloorPolygons
// floor랑 buildingID는 반환값이 아니라 서버에 요청하는 값!!!!
// 반환값은 그 해당 건물의 특정 층에 해당하는 폴리곤 데이터!!!!!!!!!!! -> MapComponent.tsx에서 floorPolygons state에 업데이트 (loadFloorPolygons)
export const fetchFloorPolygons = async (floor: string, buildingId: number | null) => { // buildingID가 있을 경우, 해당 건물의 데이터를 요청하고 없을경우 요청하지 않음. floor: 층 정보(ex:1, 2 ...) 
  try {
    if (!buildingId) return [];
    // 서버 DB에 층과 건물ID 요청
    const response = await fetch(`${ngrokBaseUrl}/api/buildings_in?floor=${floor}&buildingId=${buildingId}`);
    return await response.json();
  } catch (error) {
    console.error('층 데이터 Fetch 오류:', error);
    return [];
  }
};

// 서버에서 노드 데이터 가져오는 함수: fetchNodes
// 반환값: 노드 데이터 -> MapComponent.tsx에서 nodes state에 업데이트 (getNodes)
export const fetchNodes = async () => {
  try {
    const response = await fetch(`${ngrokBaseUrl}/api/nodes`);
    const text = await response.text(); // 바로 JSON으로 변환하지 않고, 텍스트로 확인
    console.log("🛠 서버 응답 (원본):", text);

    const data = JSON.parse(text); // JSON으로 변환
    return data;
  } catch (error) {
    console.error("❌ 노드 데이터 Fetch 오류:", error);
    return [];
  }
};


// 서버에서 최단 경로 데이터 가져오는 함수: fetchShortestPath
export const fetchShortestPath = async (startNode: number, endNode: number, type: string) => {
  try {
    const response = await fetch(`${ngrokBaseUrl}/api/shortest_path?startNode=${startNode}&endNode=${endNode}&type=${type}`);
    return await response.json();
  } catch (error) {
    console.error('최단 경로 Fetch 오류:', error);
    return [];
  }
};

// 위에서 출발, 도착, type을 MapComponent.tsx의 shortestPath state에 업데이트
// shortestPath에서 edgeIDs를 받아서 서버에 요청
// Edge(도로 링크) 좌표 데이터를 배열 형태로 반환
export const fetchEdgeCoordinates = async (edgeIds: number[]) => {
  try {
    const response = await fetch(
      `${ngrokBaseUrl}/api/edge_coordinates?edgeIds=${edgeIds.join(',')}`
    );
    console.log("📡 Edge Fetch 결과:", response);
    if (!response.ok) {                               
      throw new Error("Edge 좌표를 불러오는 데 실패했습니다.");
    }
    return await response.json();
  } catch (error) {
    console.error("❌ fetchEdgeCoordinates 오류:", error);
    return [];
  }
};
