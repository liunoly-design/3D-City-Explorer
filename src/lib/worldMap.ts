import * as THREE from 'three';

export const WORLD_SIZE = 400;
export const PATH_WIDTH = 12; 
export const CELL_SIZE = 8;
export const GRID_COUNT = Math.floor(WORLD_SIZE / CELL_SIZE);

export enum CellType {
  Empty = 0,
  Building = 1,
  Tree = 2,
  Road = 3,
  ParkingLot = 4
}

export interface MapData {
  grid: Uint8Array;
  buildings: { position: [number, number, number], scale: [number, number, number], color: THREE.Color }[];
  trees: { position: [number, number, number], height: number }[];
  parkingLots: { position: [number, number, number], scale: [number, number, number] }[];
}

export function getTerrainHeight(x: number, z: number): number {
  let h = Math.sin(x * 0.03) * Math.cos(z * 0.03) * 8;
  h += Math.sin(x * 0.015 + 1) * Math.cos(z * 0.015 + 2) * 12;
  
  // Flatten near roads
  const wx = Math.min(1, Math.max(0, (Math.abs(x) - PATH_WIDTH - 6) / 15));
  const wz = Math.min(1, Math.max(0, (Math.abs(z) - PATH_WIDTH - 6) / 15));
  const weight = Math.pow(wx * wz, 2); // Squared to make the transition smoother
  
  return h * weight;
}

export function generateMap(): MapData {
  const grid = new Uint8Array(GRID_COUNT * GRID_COUNT);
  const buildings = [];
  const trees = [];
  const parkingLots = [];
  
  const getIndex = (x: number, z: number) => z * GRID_COUNT + x;

  for (let z = 0; z < GRID_COUNT; z++) {
    for (let x = 0; x < GRID_COUNT; x++) {
      const worldX = (x + 0.5) * CELL_SIZE - WORLD_SIZE / 2;
      const worldZ = (z + 0.5) * CELL_SIZE - WORLD_SIZE / 2;
      
      // Main cross roads
      if (Math.abs(worldX) < PATH_WIDTH || Math.abs(worldZ) < PATH_WIDTH) {
        grid[getIndex(x, z)] = CellType.Road;
        continue;
      }
      
      const rand = Math.random();
      if (rand < 0.1) {
        // Building
        grid[getIndex(x, z)] = CellType.Building;
        const width = CELL_SIZE * 0.9;
        const depth = CELL_SIZE * 0.9;
        const height = Math.random() * 40 + 10;
        
        const hue = Math.random() > 0.5 ? 0.6 : 0.0; 
        const saturation = Math.random() * 0.2;
        const lightness = Math.random() * 0.4 + 0.3;
        const color = new THREE.Color().setHSL(hue, saturation, lightness);
        
        const yOffset = getTerrainHeight(worldX, worldZ);
        
        buildings.push({
          position: [worldX, height / 2 + yOffset, worldZ] as [number, number, number],
          scale: [width, height, depth] as [number, number, number],
          color
        });
      } else if (rand < 0.25) {
        // Tree
        grid[getIndex(x, z)] = CellType.Tree;
        const height = Math.random() * 4 + 3;
        const yOffset = getTerrainHeight(worldX, worldZ);
        trees.push({
          position: [worldX, yOffset, worldZ] as [number, number, number],
          height
        });
      } else if (rand < 0.28) {
        // ParkingLot
        grid[getIndex(x, z)] = CellType.ParkingLot;
        const width = CELL_SIZE * 0.9;
        const depth = CELL_SIZE * 0.9;
        const yOffset = getTerrainHeight(worldX, worldZ);
        parkingLots.push({
          position: [worldX, yOffset + 0.05, worldZ] as [number, number, number],
          scale: [width, 0.1, depth] as [number, number, number]
        });
      }
    }
  }
  
  return { grid, buildings, trees, parkingLots };
}

export function findPath(grid: Uint8Array, startW: THREE.Vector3, endW: THREE.Vector3): THREE.Vector3[] {
  const startX = Math.floor((startW.x + WORLD_SIZE / 2) / CELL_SIZE);
  const startZ = Math.floor((startW.z + WORLD_SIZE / 2) / CELL_SIZE);
  const endX = Math.floor((endW.x + WORLD_SIZE / 2) / CELL_SIZE);
  const endZ = Math.floor((endW.z + WORLD_SIZE / 2) / CELL_SIZE);
  
  if (startX < 0 || startX >= GRID_COUNT || startZ < 0 || startZ >= GRID_COUNT) return [];
  if (endX < 0 || endX >= GRID_COUNT || endZ < 0 || endZ >= GRID_COUNT) return [];
  
  const getIndex = (x: number, z: number) => z * GRID_COUNT + x;
  
  // If Target is an obstacle, do not pathfind into it
  const targetType = grid[getIndex(endX, endZ)];
  if (targetType === CellType.Building || targetType === CellType.Tree) {
     return [];
  }

  const h = (x: number, z: number) => Math.abs(x - endX) + Math.abs(z - endZ);
  
  const openSet = new Set<number>();
  const cameFrom = new Map<number, number>();
  
  const gScore = new Map<number, number>();
  const fScore = new Map<number, number>();
  
  const startIdx = getIndex(startX, startZ);
  openSet.add(startIdx);
  gScore.set(startIdx, 0);
  fScore.set(startIdx, h(startX, startZ));
  
  const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  
  let iter = 0;
  
  while (openSet.size > 0) {
    if (++iter > 5000) break; // emergency break for infinite loops / too long paths
    
    let currentIdx = -1;
    let minF = Infinity;
    for (const idx of openSet) {
      const f = fScore.get(idx) ?? Infinity;
      if (f < minF) {
        minF = f;
        currentIdx = idx;
      }
    }
    
    if (currentIdx === getIndex(endX, endZ)) {
      const path = [];
      let curr = currentIdx;
      while (cameFrom.has(curr)) {
        const cx = curr % GRID_COUNT;
        const cz = Math.floor(curr / GRID_COUNT);
        const wx = (cx + 0.5) * CELL_SIZE - WORLD_SIZE / 2;
        const wz = (cz + 0.5) * CELL_SIZE - WORLD_SIZE / 2;
        path.push(new THREE.Vector3(wx, getTerrainHeight(wx, wz), wz));
        curr = cameFrom.get(curr)!;
      }
      path.reverse();
      if (path.length > 0) {
        path[path.length - 1] = endW.clone().setY(getTerrainHeight(endW.x, endW.z));
      } else {
        path.push(endW.clone().setY(getTerrainHeight(endW.x, endW.z)));
      }
      return path;
    }
    
    openSet.delete(currentIdx);
    
    const cx = currentIdx % GRID_COUNT;
    const cz = Math.floor(currentIdx / GRID_COUNT);
    
    for (const d of dirs) {
      const nx = cx + d[0];
      const nz = cz + d[1];
      
      if (nx < 0 || nx >= GRID_COUNT || nz < 0 || nz >= GRID_COUNT) continue;
      
      const nIdx = getIndex(nx, nz);
      
      const cellType = grid[nIdx];
      if (cellType === CellType.Building || cellType === CellType.Tree) continue;
      
      // prevent cutting corners through walls diagonally
      if (d[0] !== 0 && d[1] !== 0) {
        const type1 = grid[getIndex(cx + d[0], cz)];
        const type2 = grid[getIndex(cx, cz + d[1])];
        if (type1 === CellType.Building || type1 === CellType.Tree) continue;
        if (type2 === CellType.Building || type2 === CellType.Tree) continue;
      }
      
      const tentativeG = (gScore.get(currentIdx) ?? Infinity) + (d[0] !== 0 && d[1] !== 0 ? 1.414 : 1);
      
      if (tentativeG < (gScore.get(nIdx) ?? Infinity)) {
        cameFrom.set(nIdx, currentIdx);
        gScore.set(nIdx, tentativeG);
        fScore.set(nIdx, tentativeG + h(nx, nz));
        openSet.add(nIdx);
      }
    }
  }
  
  return [];
}
