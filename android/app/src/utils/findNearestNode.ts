// 사용자가 지도에서 찍은 위치와 가장 가까운 노드를 찾는 컴포넌트
// 방식은 수정될 수 있음
export const findNearestNode = (nodes, lat, lon, type) => {
    let minDist = Infinity;
    let nearestNode = null;

    nodes.forEach(node => {
        // longitude나 latitude가 null이면 무시
        if (!node.longitude || !node.latitude) return;

        // 실내/실외 타입이 일치하지 않으면 무시
        if (node.type !== type) return;

        const dist = Math.sqrt(Math.pow(node.latitude - lat, 2) + Math.pow(node.longitude - lon, 2));
        if (dist < minDist) {
            minDist = dist;
            nearestNode = node;
        }
    });

    if (!nearestNode) {
        console.error("[노드 탐색 실패] 주어진 타입의 노드를 찾을 수 없음", type);
        return null;
    }

    console.log(`[가장 가까운 노드 찾음] ID=${nearestNode.node_id}, 위도=${nearestNode.latitude}, 경도=${nearestNode.longitude}, 타입=${nearestNode.type}`);
    
    return {
        node_id: nearestNode.node_id, // node_id 추가
        latitude: nearestNode.latitude,
        longitude: nearestNode.longitude,
        type: nearestNode.type
    };
};
