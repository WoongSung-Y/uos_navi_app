import axios from 'axios';
import type { Building, FloorPolygon, Node, Edge } from './src/types';

const apiClient = axios.create({
  baseURL: 'http://15.165.159.29:3000',
  timeout: 10000,
});

const handleError = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    console.error(`API Error: ${error.message}`, error.response?.data);
    throw new Error(error.response?.data?.message || 'API request failed');
  }
  throw new Error('Unknown API error');
};


export const uploadIndoorPhoto = async (uri: string, fileName: string, pressure: number | null) => {
  const formData = new FormData();
  formData.append('image', {
    uri,
    type: 'image/jpeg',
    name: fileName,
  } as any);

  // 🔥 기압도 같이 전송 (null이면 빈 문자열)
  formData.append('pressure', pressure?.toString() ?? '');

  try {
    const response = await apiClient.post('/api/indoor_upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (err) {
    console.error('Indoor 사진 업로드 실패:', err);
    return null;
  }
};


// 이미지 업로드
export const uploadImageToServer = async (uri: string, fileName: string) => {
  const formData = new FormData();
  formData.append('image', {
    uri,
    type: 'image/jpeg',
    name: fileName,
  } as any); // RN 환경에서는 타입 충돌 있을 수 있으므로 any 처리

  try {
    const response = await apiClient.post('/api/upload_image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (err) {
    console.error('이미지 업로드 실패:', err);
    return null;
  }
};

// POI 불러오기
export const fetchPOINodes = async (): Promise<Node[]> => {
  try {
    const response = await apiClient.get('/api/nodes');
    return response.data;
  } catch (error) {
    handleError(error);
    return [];
  }
};

// 건물 폴리곤 불러오기
export const fetchBuildingPolygons = async (): Promise<Building[]> => {
  try {
    const response = await apiClient.get('/api/total_building');
    return response.data;
  } catch (error) {
    handleError(error);
    return [];
  }
};

// 층 폴리곤 불러오기
export const fetchFloorPolygons = async (
  floor: string,
  buildingId: number
): Promise<FloorPolygon[]> => {
  try {
    const response = await apiClient.get('/api/buildings_in', {
      params: { floor, buildingId }
    });
    return response.data;
  } catch (error) {
    handleError(error);
    return [];
  }
};

// 노드 불러오기
export const fetchNodes = async (): Promise<Node[]> => {
  try {
    const response = await apiClient.get('/api/nodes');
    return response.data;
  } catch (error) {
    handleError(error);
    return [];
  }
};

// 최단 경로 계산
export const fetchShortestPath = async (
  startNode: number,
  endNode: number,
  // type: string
): Promise<Node[]> => {
  try {
    const response = await apiClient.get('/api/shortest_path', {
      params: { startNode, endNode }
    });
    return response.data;
  } catch (error) {
    handleError(error);
    return [];
  }
};

// edge
export const fetchEdgeCoordinates = async (
  edgeIds: number[]
): Promise<Edge[]> => {
  try {
    const response = await apiClient.get('/api/edge_coordinates', {
      params: { edgeIds: edgeIds.join(',') }
    });
    return response.data;
  } catch (error) {
    handleError(error);
    return [];
  }
};