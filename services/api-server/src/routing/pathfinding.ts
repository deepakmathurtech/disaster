import {
  RoadNode,
  RoadEdge,
  RouteDetail,
  RouteSegmentStatus,
  LocationCoordinates,
  TrafficLevel,
  SafetyCondition,
  RouteLengthCategory,
} from '../server';
import { ITrafficProvider } from './trafficProvider';

// ─── Colors for 5 Routes ──────────────────────────────────────────────
export const ROUTE_COLORS = [
  '#ef4444', // Route 1: Red
  '#10b981', // Route 2: Emerald Green
  '#f59e0b', // Route 3: Amber Yellow
  '#3b82f6', // Route 4: Blue
  '#a855f7', // Route 5: Purple
];

// ─── Haversine Distance Heuristic (in Km) ──────────────────────────────
export function haversineDistanceKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ─── Internal Path Structure ──────────────────────────────────────────
export interface PathResult {
  nodeIds: string[];
  edgeIds: string[];
  totalCostMin: number;
  totalDistanceKm: number;
}

// ─── A* Algorithm ──────────────────────────────────────────────────────
export function runAStar(
  nodes: Map<string, RoadNode>,
  edges: Map<string, RoadEdge>,
  sourceId: string,
  targetId: string,
  trafficProvider: ITrafficProvider,
  excludedEdgeIds: Set<string> = new Set(),
  excludedNodeIds: Set<string> = new Set()
): PathResult | null {
  if (!nodes.has(sourceId) || !nodes.has(targetId)) return null;
  if (sourceId === targetId) {
    return { nodeIds: [sourceId], edgeIds: [], totalCostMin: 0, totalDistanceKm: 0 };
  }

  const destNode = nodes.get(targetId)!;

  // Build adjacency graph (bidirectional)
  const adj = new Map<string, Array<{ neighborId: string; edge: RoadEdge }>>();
  for (const node of nodes.keys()) {
    adj.set(node, []);
  }

  for (const edge of edges.values()) {
    if (excludedEdgeIds.has(edge.id)) continue;
    if (excludedNodeIds.has(edge.source) || excludedNodeIds.has(edge.target)) continue;

    adj.get(edge.source)?.push({ neighborId: edge.target, edge });
    adj.get(edge.target)?.push({ neighborId: edge.source, edge });
  }

  const gScore = new Map<string, number>();
  const fScore = new Map<string, number>();
  const parent = new Map<string, { nodeId: string; edgeId: string }>();

  for (const nodeId of nodes.keys()) {
    gScore.set(nodeId, Infinity);
    fScore.set(nodeId, Infinity);
  }

  gScore.set(sourceId, 0);
  const startNode = nodes.get(sourceId)!;
  const initialH = haversineDistanceKm(startNode.lat, startNode.lng, destNode.lat, destNode.lng);
  fScore.set(sourceId, initialH);

  const openSet = new Set<string>([sourceId]);

  while (openSet.size > 0) {
    // Find node in openSet with lowest fScore
    let currentId: string | null = null;
    let lowestF = Infinity;

    for (const nodeId of openSet) {
      const f = fScore.get(nodeId)!;
      if (f < lowestF) {
        lowestF = f;
        currentId = nodeId;
      }
    }

    if (!currentId) break;
    if (currentId === targetId) {
      // Reconstruct path
      const pathNodes: string[] = [targetId];
      const pathEdges: string[] = [];
      let curr = targetId;
      let totalDist = 0;

      while (parent.has(curr)) {
        const p = parent.get(curr)!;
        pathNodes.unshift(p.nodeId);
        pathEdges.unshift(p.edgeId);
        const edge = edges.get(p.edgeId)!;
        totalDist += edge.distanceKm;
        curr = p.nodeId;
      }

      return {
        nodeIds: pathNodes,
        edgeIds: pathEdges,
        totalCostMin: gScore.get(targetId)!,
        totalDistanceKm: Math.round(totalDist * 100) / 100,
      };
    }

    openSet.delete(currentId);
    const currNode = nodes.get(currentId)!;
    const neighbors = adj.get(currentId) || [];

    for (const { neighborId, edge } of neighbors) {
      if (excludedNodeIds.has(neighborId)) continue;

      const evalResult = trafficProvider.evaluateEdge(
        edge.id,
        edge.roadName,
        edge.distanceKm,
        edge.baseSpeedKmh,
        edge.entityId
      );

      if (evalResult.isBlocked) continue; // Cannot traverse blocked roads

      const tentativeG = gScore.get(currentId)! + evalResult.travelTimeMin;

      if (tentativeG < (gScore.get(neighborId) ?? Infinity)) {
        parent.set(neighborId, { nodeId: currentId, edgeId: edge.id });
        gScore.set(neighborId, tentativeG);

        const nNode = nodes.get(neighborId)!;
        const h = (haversineDistanceKm(nNode.lat, nNode.lng, destNode.lat, destNode.lng) / 40) * 60;
        fScore.set(neighborId, tentativeG + h);

        openSet.add(neighborId);
      }
    }
  }

  return null; // No path found
}

// ─── Yen's K-Shortest Paths Algorithm ──────────────────────────────────
export function runYensKShortestPaths(
  nodes: Map<string, RoadNode>,
  edges: Map<string, RoadEdge>,
  sourceId: string,
  targetId: string,
  trafficProvider: ITrafficProvider,
  K: number = 5
): PathResult[] {
  const A: PathResult[] = [];
  const B: PathResult[] = [];

  // Path 0: Shortest path via A*
  const initialPath = runAStar(nodes, edges, sourceId, targetId, trafficProvider);
  if (!initialPath) return [];

  A.push(initialPath);

  for (let k = 1; k < K; k++) {
    const prevPath = A[k - 1];
    if (!prevPath || prevPath.nodeIds.length < 2) break;

    for (let i = 0; i < prevPath.nodeIds.length - 1; i++) {
      const spurNode = prevPath.nodeIds[i];
      const rootPathNodes = prevPath.nodeIds.slice(0, i + 1);
      const rootPathEdges = prevPath.edgeIds.slice(0, i);

      const excludedEdges = new Set<string>();
      const excludedNodes = new Set<string>();

      // Exclude edges of previous paths in A that share the same root path
      for (const path of A) {
        let isSameRoot = true;
        for (let r = 0; r <= i; r++) {
          if (path.nodeIds[r] !== rootPathNodes[r]) {
            isSameRoot = false;
            break;
          }
        }
        if (isSameRoot && path.edgeIds[i]) {
          excludedEdges.add(path.edgeIds[i]);
        }
      }

      // Exclude nodes in root path except spurNode to avoid loops
      for (const node of rootPathNodes) {
        if (node !== spurNode) {
          excludedNodes.add(node);
        }
      }

      const spurPath = runAStar(
        nodes,
        edges,
        spurNode,
        targetId,
        trafficProvider,
        excludedEdges,
        excludedNodes
      );

      if (spurPath) {
        const totalNodeIds = [...rootPathNodes.slice(0, -1), ...spurPath.nodeIds];
        const totalEdgeIds = [...rootPathEdges, ...spurPath.edgeIds];

        // Calculate combined cost and distance
        let totalCost = 0;
        let totalDist = 0;

        for (const edgeId of totalEdgeIds) {
          const edge = edges.get(edgeId)!;
          const evalResult = trafficProvider.evaluateEdge(
            edge.id,
            edge.roadName,
            edge.distanceKm,
            edge.baseSpeedKmh,
            edge.entityId
          );
          totalCost += evalResult.travelTimeMin;
          totalDist += edge.distanceKm;
        }

        const candidatePath: PathResult = {
          nodeIds: totalNodeIds,
          edgeIds: totalEdgeIds,
          totalCostMin: Math.round(totalCost * 10) / 10,
          totalDistanceKm: Math.round(totalDist * 100) / 100,
        };

        // Check if candidate path is unique
        const pathKey = totalNodeIds.join('->');
        const existsInA = A.some(p => p.nodeIds.join('->') === pathKey);
        const existsInB = B.some(p => p.nodeIds.join('->') === pathKey);

        if (!existsInA && !existsInB) {
          B.push(candidatePath);
        }
      }
    }

    if (B.length === 0) break;

    // Sort candidate paths in B by totalCostMin ascending
    B.sort((a, b) => a.totalCostMin - b.totalCostMin);
    A.push(B.shift()!);
  }

  return A;
}

// ─── Format Paths to Detailed Route Objects ────────────────────────────
export function buildRouteDetails(
  paths: PathResult[],
  nodesMap: Map<string, RoadNode>,
  edgesMap: Map<string, RoadEdge>,
  trafficProvider: ITrafficProvider
): RouteDetail[] {
  if (paths.length === 0) return [];

  // Determine distance range for short/medium/long classification
  const distances = paths.map(p => p.totalDistanceKm);
  const minDist = Math.min(...distances);
  const maxDist = Math.max(...distances);

  return paths.map((path, idx) => {
    const routeId = idx + 1;
    const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];

    // Build coordinate list & segment metadata
    const coordinates: LocationCoordinates[] = [];
    const segments: RouteSegmentStatus[] = [];
    let heavyCount = 0;
    let dangerousCount = 0;

    for (let i = 0; i < path.edgeIds.length; i++) {
      const edgeId = path.edgeIds[i];
      const edge = edgesMap.get(edgeId)!;
      const evalResult = trafficProvider.evaluateEdge(
        edge.id,
        edge.roadName,
        edge.distanceKm,
        edge.baseSpeedKmh,
        edge.entityId
      );

      if (evalResult.trafficLevel === 'heavy') heavyCount++;
      if (evalResult.safetyCondition === 'dangerous') dangerousCount++;

      segments.push({
        edgeId: edge.id,
        roadName: edge.roadName,
        entityId: edge.entityId,
        entityState: evalResult.entityState,
        penaltyMultiplier: evalResult.penaltyMultiplier,
      });

      // Append coordinates avoiding duplication at segment junctions
      const coords = edge.coordinates;
      const isReverse = edge.target === path.nodeIds[i];
      const orderedCoords = isReverse ? [...coords].reverse() : coords;

      orderedCoords.forEach((c, cIdx) => {
        if (coordinates.length === 0 || cIdx > 0) {
          coordinates.push(c);
        }
      });
    }

    // Determine overall Traffic Level
    const traffic: TrafficLevel =
      heavyCount > 0 ? 'heavy' : segments.some(s => s.penaltyMultiplier > 1.2) ? 'moderate' : 'low';

    // Determine overall Safety Condition
    const safety: SafetyCondition =
      dangerousCount > 0 ? 'dangerous' : segments.some(s => s.penaltyMultiplier > 1.2) ? 'cautious' : 'safe';

    // Length classification relative to alternatives
    let lengthCategory: RouteLengthCategory = 'medium';
    if (path.totalDistanceKm <= minDist + 0.3) {
      lengthCategory = 'short';
    } else if (path.totalDistanceKm >= maxDist - 0.3) {
      lengthCategory = 'long';
    }

    const startNode = nodesMap.get(path.nodeIds[0]);
    const endNode = nodesMap.get(path.nodeIds[path.nodeIds.length - 1]);
    const name = `Route ${routeId} via ${segments[0]?.roadName || 'Direct'}`;

    return {
      routeId,
      name,
      distanceKm: path.totalDistanceKm,
      estimatedTimeMin: path.totalCostMin,
      traffic,
      safety,
      routeLengthClassification: lengthCategory,
      color,
      pathNodeIds: path.nodeIds,
      coordinates,
      segments,
    };
  });
}
