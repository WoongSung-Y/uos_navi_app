import type { Node } from '../types';

// 주어진 좌표(lat, lon)에서 가장 가까운 실외 노드 탐색
export const findNearestNode = (
  nodes: Node[],
  lat: number,
  lon: number,
  type: 'outdoor' | 'indoor' = 'outdoor'
): Node | null => {
  let nearestNode: Node | null = null;
  let minDist = Infinity;

  for (const node of nodes) {
    if (!node.latitude || !node.longitude) continue;
    if (node.type !== type) continue;

    const dist = Math.pow(lat - node.latitude, 2) + Math.pow(lon - node.longitude, 2);

    if (dist < minDist) {
      minDist = dist;
      nearestNode = node;
    }
  }

  if (!nearestNode) {
    console.warn(`[노드 탐색 실패] 타입: ${type}`);
    return null;
  }

  console.log(`[가까운 노드] ID=${nearestNode.node_id}, 좌표=(${nearestNode.latitude}, ${nearestNode.longitude}), type=${nearestNode.type}`);
  return nearestNode;
};
