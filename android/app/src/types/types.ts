// src/types/types.ts
export type Coordinate = {
    latitude: number;
    longitude: number;
  };
  
  export type Building = {
    id: number;
    name: string;
    geom_json: string;
  };
  
  export type FloorPolygon = {
    id: number;
    floor: string;
    building_id: number;
    geom_json: string;
  };
  
  export type Node = {
    node_id: number;
    latitude: number;
    longitude: number;
    type: 'indoor' | 'outdoor';
    floor?: string;
  };
  
  export type Edge = {
    id: number;
    coordinates: Coordinate[];
  };
  
  export type Path = Edge[];