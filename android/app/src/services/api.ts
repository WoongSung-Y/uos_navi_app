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