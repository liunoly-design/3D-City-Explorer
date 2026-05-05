import React, { useRef, useState, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sky, useCursor } from '@react-three/drei';
import * as THREE from 'three';
import { generateMap, findPath, WORLD_SIZE, PATH_WIDTH, CellType, MapData, getTerrainHeight, CELL_SIZE, GRID_COUNT } from '../lib/worldMap';
import { MovingCar, CarModel } from './Car';

const NUM_STARS = 50;
const NUM_FOODS = 20;

export function generateFoods(mapData: MapData) {
  const newFoods = [];
  let baseId = Date.now();
  for (let i = 0; i < NUM_FOODS; i++) {
     let x = 0, z = 0;
     let isValid = false;
     let maxTries = 100;
     let targetY = 0;
     while (!isValid && maxTries > 0) {
         x = (Math.random() - 0.5) * WORLD_SIZE;
         z = (Math.random() - 0.5) * WORLD_SIZE;
         const gridX = Math.floor((x + WORLD_SIZE / 2) / CELL_SIZE);
         const gridZ = Math.floor((z + WORLD_SIZE / 2) / CELL_SIZE);
         if (gridX >= 0 && gridX < GRID_COUNT && gridZ >= 0 && gridZ < GRID_COUNT) {
             const type = mapData.grid[gridZ * GRID_COUNT + gridX];
             if (type === CellType.Empty || type === CellType.Road) {
                 isValid = true;
                 targetY = getTerrainHeight(x, z) + 0.3;
             } else if (type === CellType.Building) {
                 const gridWorldX = (gridX + 0.5) * CELL_SIZE - WORLD_SIZE / 2;
                 const gridWorldZ = (gridZ + 0.5) * CELL_SIZE - WORLD_SIZE / 2;
                 const b = mapData.buildings.find(bd => Math.abs(bd.position[0] - gridWorldX) < CELL_SIZE && Math.abs(bd.position[2] - gridWorldZ) < CELL_SIZE);
                 if (b) {
                     isValid = true;
                     targetY = b.position[1] + b.scale[1] / 2 + 0.3;
                 }
             }
         }
         maxTries--;
     }
     if (isValid) {
         newFoods.push({
             id: `food-${baseId}-${i}`,
             position: [x, targetY, z]
         });
     }
  }
  return newFoods;
}

export function generateStars(mapData: MapData) {
  const newStars = [];
  let baseId = Date.now();
  for (let i = 0; i < NUM_STARS; i++) {
     let x = 0, z = 0;
     let isValid = false;
     let maxTries = 100;
     let targetY = 0;
     while (!isValid && maxTries > 0) {
         x = (Math.random() - 0.5) * WORLD_SIZE;
         z = (Math.random() - 0.5) * WORLD_SIZE;
         const gridX = Math.floor((x + WORLD_SIZE / 2) / CELL_SIZE);
         const gridZ = Math.floor((z + WORLD_SIZE / 2) / CELL_SIZE);
         if (gridX >= 0 && gridX < GRID_COUNT && gridZ >= 0 && gridZ < GRID_COUNT) {
             const type = mapData.grid[gridZ * GRID_COUNT + gridX];
             if (type === CellType.Empty || type === CellType.Road) {
                 isValid = true;
                 targetY = getTerrainHeight(x, z) + 1.5;
             } else if (type === CellType.Building) {
                 const gridWorldX = (gridX + 0.5) * CELL_SIZE - WORLD_SIZE / 2;
                 const gridWorldZ = (gridZ + 0.5) * CELL_SIZE - WORLD_SIZE / 2;
                 const b = mapData.buildings.find(bd => Math.abs(bd.position[0] - gridWorldX) < CELL_SIZE && Math.abs(bd.position[2] - gridWorldZ) < CELL_SIZE);
                 if (b) {
                     isValid = true;
                     targetY = b.position[1] + b.scale[1] / 2 + 1.5;
                 }
             }
         }
         maxTries--;
     }
     if (isValid) {
         newStars.push({
             id: `star-${baseId}-${i}`,
             position: [x, targetY, z]
         });
     }
  }
  return newStars;
}

const StarMesh = React.memo(({ position }: { position: number[] }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame((state, delta) => {
      if (meshRef.current) {
          meshRef.current.rotation.y += delta;
      }
  });
  return (
    <mesh ref={meshRef} position={position as [number, number, number]} castShadow>
        <octahedronGeometry args={[0.8, 0]} />
        <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={0.8} roughness={0.2} metalness={0.8} />
    </mesh>
  );
});

const speed = 12;

function Player({ target, isMoving, onReachTarget, mapData, setMapData, movingCarsRefs, parkedCars, setParkedCars, cameraYawRef, isDraggingRef, stars, setStars, onScore, onWoodChange, foods, setFoods, onEatFood }: { target: THREE.Vector3, isMoving: boolean, onReachTarget: () => void, mapData: MapData | null, setMapData: any, movingCarsRefs: React.MutableRefObject<(THREE.Group | null)[]>, parkedCars: any[], setParkedCars: any, cameraYawRef: React.MutableRefObject<number>, isDraggingRef: React.MutableRefObject<boolean>, stars: any[], setStars: any, onScore?: (val: any) => void, onWoodChange?: (val: any) => void, foods: any[], setFoods: any, onEatFood?: () => void }) {
  const group = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Mesh>(null);
  const rightLeg = useRef<THREE.Mesh>(null);
  const leftArm = useRef<THREE.Mesh>(null);
  const rightArm = useRef<THREE.Mesh>(null);
  
  const [path, setPath] = useState<THREE.Vector3[]>([]);
  const [pathIndex, setPathIndex] = useState(0);

  const [mode, setMode] = useState<'walking' | 'driving'>('walking');
  const [carColor, setCarColor] = useState('#ffffff');
  const [crashed, setCrashed] = useState(false);
  const crashVelocity = useRef(new THREE.Vector3());
  const [invincibleUntil, setInvincibleUntil] = useState(() => Date.now() + 3000);
  const shieldRef = useRef<THREE.Mesh>(null);

  const keys = useRef<{ [key: string]: boolean }>({});
  const isJumping = useRef(false);
  const playerVelocity = useRef(new THREE.Vector3());

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => keys.current[e.key.toLowerCase()] = true;
    const handleKeyUp = (e: KeyboardEvent) => keys.current[e.key.toLowerCase()] = false;
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const initialized = useRef(false);
  useEffect(() => {
    if (group.current && !initialized.current) {
      group.current.position.set(20, getTerrainHeight(20, 20), 20);
      initialized.current = true;
    }
  }, []);

  useEffect(() => {
    if (isMoving && mapData && group.current && !crashed) {
       const newPath = findPath(mapData.grid, group.current.position, target);
       setPath(newPath);
       setPathIndex(0);
       if (newPath.length === 0) {
         onReachTarget(); // unable to reach
       }
    }
  }, [target, isMoving, mapData, crashed]);

  const woodRef = useRef(0);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === '4' && group.current && mode === 'walking' && mapData) {
        // Chop down tree
        const px = group.current.position.x;
        const pz = group.current.position.z;
        let choppedIdx = -1;
        let minDis = 2.5;

        for (let i = 0; i < mapData.trees.length; i++) {
          const t = mapData.trees[i];
          const dist = Math.hypot(t.position[0] - px, t.position[2] - pz);
          if (dist < minDis) {
            minDis = dist;
            choppedIdx = i;
          }
        }

        if (choppedIdx !== -1) {
          const t = mapData.trees[choppedIdx];
          mapData.trees.splice(choppedIdx, 1);
          
          const gridX = Math.floor((t.position[0] + WORLD_SIZE / 2) / CELL_SIZE);
          const gridZ = Math.floor((t.position[2] + WORLD_SIZE / 2) / CELL_SIZE);
          if (gridX >= 0 && gridX < GRID_COUNT && gridZ >= 0 && gridZ < GRID_COUNT) {
              mapData.grid[gridZ * GRID_COUNT + gridX] = CellType.Empty;
          }
          
          setMapData({ ...mapData });
          woodRef.current += 1;
          if (onWoodChange) onWoodChange(woodRef.current);
        }
        return;
      }

      if (e.key === '6' && group.current && mode === 'walking' && mapData) {
        // Plant tree
        if (woodRef.current > 0) {
          const px = group.current.position.x;
          const pz = group.current.position.z;
          const gridX = Math.floor((px + WORLD_SIZE / 2) / CELL_SIZE);
          const gridZ = Math.floor((pz + WORLD_SIZE / 2) / CELL_SIZE);
          
          if (gridX >= 0 && gridX < GRID_COUNT && gridZ >= 0 && gridZ < GRID_COUNT) {
            const currentCellType = mapData.grid[gridZ * GRID_COUNT + gridX];
            if (currentCellType === CellType.Empty || currentCellType === CellType.Road) {
              // Plant here
              mapData.grid[gridZ * GRID_COUNT + gridX] = CellType.Tree;
              const worldX = (gridX + 0.5) * CELL_SIZE - WORLD_SIZE / 2;
              const worldZ = (gridZ + 0.5) * CELL_SIZE - WORLD_SIZE / 2;
              const height = Math.random() * 4 + 3;
              const yOffset = getTerrainHeight(worldX, worldZ);
              
              mapData.trees.push({
                position: [worldX, yOffset, worldZ],
                height
              });
              
              setMapData({ ...mapData });
              woodRef.current -= 1;
              if (onWoodChange) onWoodChange(woodRef.current);
            }
          }
        }
        return;
      }

      if (e.key === '1' && group.current) {
        setMode('walking');
        setCrashed(false);
        setPath([]);
        onReachTarget();
        setInvincibleUntil(Date.now() + 3000);
        group.current.position.set(20, getTerrainHeight(20, 20), 20); // Reset to clear grass
        group.current.rotation.set(0, 0, 0);
        return;
      }

      if (e.key === '0' && !crashed && group.current) {
        if (mode === 'walking') {
          let closestIdx = -1;
          let minDis = 8;
          for (let i = 0; i < parkedCars.length; i++) {
             const pc = parkedCars[i];
             const d = new THREE.Vector3(...pc.position).distanceTo(group.current.position);
             if (d < minDis) {
                minDis = d;
                closestIdx = i;
             }
          }
          if (closestIdx !== -1) {
             const car = parkedCars[closestIdx];
             setMode('driving');
             setCarColor(car.color);
             setParkedCars((prev: any) => {
                const next = [...prev];
                next.splice(closestIdx, 1);
                return next;
             });
             group.current.position.set(car.position[0], car.position[1], car.position[2]);
             group.current.rotation.y = car.rotationY;
             setPath([]);
             onReachTarget();
          }
        } else {
          setMode('walking');
          setParkedCars((prev: any) => [
             ...prev,
             {
                id: `dropped-${Date.now()}`,
                color: carColor,
                position: [group.current!.position.x, 0, group.current!.position.z],
                rotationY: group.current!.rotation.y
             }
          ]);
          group.current.position.x += 3; // step out
          setPath([]);
          onReachTarget();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode, parkedCars, carColor, crashed, onReachTarget]);

  const currentSpeed = mode === 'driving' ? 30 : 12;

  useFrame((state, delta) => {
    if (!group.current) return;
    
    if (crashed) {
       group.current.position.addScaledVector(crashVelocity.current, delta);
       const groundY = getTerrainHeight(group.current.position.x, group.current.position.z);
       if (group.current.position.y > groundY + 0.1) {
           group.current.rotation.x += delta * 5;
           group.current.rotation.y += delta * 4;
           group.current.rotation.z += delta * 3;
           crashVelocity.current.y -= 30 * delta; // gravity
       } else {
           group.current.position.y = groundY;
           crashVelocity.current.set(0, 0, 0); // hit the ground, stop moving
       }
       
       const camDist = mode === 'driving' ? 40 : 25;
       const camYOffset = mode === 'driving' ? 35 : 20;

       const idealCam = new THREE.Vector3(
           group.current.position.x + Math.sin(cameraYawRef.current) * camDist,
           group.current.position.y + camYOffset,
           group.current.position.z + Math.cos(cameraYawRef.current) * camDist
       );
       state.camera.position.lerp(idealCam, 0.05);
       state.camera.lookAt(group.current.position);
       return;
    }
    
    if (shieldRef.current) {
        shieldRef.current.visible = Date.now() < invincibleUntil;
        if (shieldRef.current.visible) {
            shieldRef.current.rotation.y += delta * 2;
        }
    }

    // Collision check
    if (Date.now() > invincibleUntil) {
      for (const carGroup of movingCarsRefs.current) {
        if (!carGroup) continue;
        const distXZ = Math.hypot(group.current.position.x - carGroup.position.x, group.current.position.z - carGroup.position.z);
        const distY = Math.abs(group.current.position.y - carGroup.position.y);
        if (distXZ < 3.5 && distY < 2.0) {
           setCrashed(true);
           onReachTarget();
           const dir = group.current.position.clone().sub(carGroup.position).normalize();
           crashVelocity.current = new THREE.Vector3(dir.x * 8, 10, dir.z * 8);
           break; // Stop checking
        }
      }
    }

    if (crashed) return;

    // Movement Logic
    const moveZ = (keys.current['w'] || keys.current['arrowup'] ? -1 : 0) + (keys.current['s'] || keys.current['arrowdown'] ? 1 : 0);
    const moveX = (keys.current['a'] || keys.current['arrowleft'] ? -1 : 0) + (keys.current['d'] || keys.current['arrowright'] ? 1 : 0);
    
    const isKeyboardMoving = moveX !== 0 || moveZ !== 0;

    // Jump
    if (keys.current[' '] && !isJumping.current) {
      playerVelocity.current.y = 25;
      isJumping.current = true;
    }

    if (isKeyboardMoving) {
      if (isMoving) {
         setPath([]);
         onReachTarget();
      }

      const moveDir = new THREE.Vector3(moveX, 0, moveZ).normalize();
      
      const forwardX = Math.sin(cameraYawRef.current) * moveDir.z + Math.cos(cameraYawRef.current) * moveDir.x;
      const forwardZ = Math.cos(cameraYawRef.current) * moveDir.z - Math.sin(cameraYawRef.current) * moveDir.x;
      
      const newPos = group.current.position.clone();
      newPos.x += forwardX * currentSpeed * delta;
      newPos.z += forwardZ * currentSpeed * delta;

      let canMove = true;
      if (mode === 'walking') {
          const gridX = Math.floor((newPos.x + WORLD_SIZE / 2) / CELL_SIZE);
          const gridZ = Math.floor((newPos.z + WORLD_SIZE / 2) / CELL_SIZE);
          const cellType = mapData?.grid[gridZ * GRID_COUNT + gridX] ?? CellType.Empty;
          
          let collisionY = getTerrainHeight(newPos.x, newPos.z);
          let isObstacle = false;
          
          if (cellType === CellType.Building) {
              isObstacle = true;
              const gridWorldX = (gridX + 0.5) * CELL_SIZE - WORLD_SIZE / 2;
              const gridWorldZ = (gridZ + 0.5) * CELL_SIZE - WORLD_SIZE / 2;
              const b = mapData?.buildings.find(bd => Math.abs(bd.position[0] - gridWorldX) < CELL_SIZE && Math.abs(bd.position[2] - gridWorldZ) < CELL_SIZE);
              if (b) collisionY = b.position[1] + b.scale[1] / 2;
          } else if (cellType === CellType.Tree) {
              const treeX = (gridX + 0.5) * CELL_SIZE - WORLD_SIZE / 2;
              const treeZ = (gridZ + 0.5) * CELL_SIZE - WORLD_SIZE / 2;
              if (Math.hypot(newPos.x - treeX, newPos.z - treeZ) < 1.5) {
                  isObstacle = true;
                  const t = mapData?.trees.find(tr => Math.abs(tr.position[0] - treeX) < 1 && Math.abs(tr.position[2] - treeZ) < 1);
                  if (t) collisionY = t.position[1] + t.height + 1;
              }
          }
          
          if (isObstacle && group.current.position.y < collisionY - 2.0) {
              canMove = false;
          }
      }

      if (canMove) {
          group.current.position.x = newPos.x;
          group.current.position.z = newPos.z;

          const targetRotation = Math.atan2(forwardX, forwardZ);
          let diff = targetRotation - group.current.rotation.y;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          group.current.rotation.y += diff * 12 * delta;
      }
      
      if (mode === 'walking') {
          const time = state.clock.getElapsedTime();
          const stride = Math.sin(time * 15);
          if (leftLeg.current) leftLeg.current.rotation.x = stride * 0.5;
          if (rightLeg.current) rightLeg.current.rotation.x = -stride * 0.5;
          if (leftArm.current) leftArm.current.rotation.x = -stride * 0.5;
          if (rightArm.current) rightArm.current.rotation.x = stride * 0.5;
      }
    } else if (isMoving && path.length > 0 && pathIndex < path.length) {
      const currentTarget = path[pathIndex];
      const distanceXZ = Math.hypot(group.current.position.x - currentTarget.x, group.current.position.z - currentTarget.z);
      
      if (distanceXZ > 0.5) {
        const direction = new THREE.Vector3(currentTarget.x, 0, currentTarget.z)
             .sub(new THREE.Vector3(group.current.position.x, 0, group.current.position.z)).normalize();
        
        group.current.position.x += direction.x * currentSpeed * delta;
        group.current.position.z += direction.z * currentSpeed * delta;
        
        const targetRotation = Math.atan2(direction.x, direction.z);
        let diff = targetRotation - group.current.rotation.y;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        group.current.rotation.y += diff * 12 * delta;

        if (mode === 'walking') {
          const time = state.clock.getElapsedTime();
          const stride = Math.sin(time * 15);
          if (leftLeg.current) leftLeg.current.rotation.x = stride * 0.5;
          if (rightLeg.current) rightLeg.current.rotation.x = -stride * 0.5;
          if (leftArm.current) leftArm.current.rotation.x = -stride * 0.5;
          if (rightArm.current) rightArm.current.rotation.x = stride * 0.5;
        }
      } else {
        setPathIndex(prev => prev + 1);
        if (pathIndex + 1 >= path.length) {
            onReachTarget();
        }
      }
    } else {
      if (isMoving) {
        onReachTarget();
      }
      if (mode === 'walking') {
        if (leftLeg.current) leftLeg.current.rotation.x = 0;
        if (rightLeg.current) rightLeg.current.rotation.x = 0;
        if (leftArm.current) leftArm.current.rotation.x = 0;
        if (rightArm.current) rightArm.current.rotation.x = 0;
      }
    }
    
    // Jump & Climb Physics
    let isClimbing = false;
    if (keys.current['2']) {
        let canClimb = false;
        if (mapData) {
            const currentGridX = Math.floor((group.current.position.x + WORLD_SIZE / 2) / CELL_SIZE);
            const currentGridZ = Math.floor((group.current.position.z + WORLD_SIZE / 2) / CELL_SIZE);
            for (let dx = -1; dx <= 1; dx++) {
                for (let dz = -1; dz <= 1; dz++) {
                    const gx = currentGridX + dx;
                    const gz = currentGridZ + dz;
                    if (gx >= 0 && gx < GRID_COUNT && gz >= 0 && gz < GRID_COUNT) {
                        const ct = mapData.grid[gz * GRID_COUNT + gx];
                        if (ct === CellType.Building) {
                            const gridWorldX = (gx + 0.5) * CELL_SIZE - WORLD_SIZE / 2;
                            const gridWorldZ = (gz + 0.5) * CELL_SIZE - WORLD_SIZE / 2;
                            if (Math.hypot(group.current.position.x - gridWorldX, group.current.position.z - gridWorldZ) < CELL_SIZE * 0.8) {
                                const b = mapData.buildings.find(bd => Math.abs(bd.position[0] - gridWorldX) < CELL_SIZE && Math.abs(bd.position[2] - gridWorldZ) < CELL_SIZE);
                                if (b) {
                                    const roofY = b.position[1] + b.scale[1] / 2;
                                    if (group.current.position.y < roofY - 1.0) canClimb = true;
                                }
                            }
                        } else if (ct === CellType.Tree) {
                            const treeX = (gx + 0.5) * CELL_SIZE - WORLD_SIZE / 2;
                            const treeZ = (gz + 0.5) * CELL_SIZE - WORLD_SIZE / 2;
                            if (Math.hypot(group.current.position.x - treeX, group.current.position.z - treeZ) < 2.5) {
                                const t = mapData.trees.find(tr => Math.abs(tr.position[0] - treeX) < 1 && Math.abs(tr.position[2] - treeZ) < 1);
                                if (t) {
                                    const treeTopY = t.position[1] + t.height + 1;
                                    if (group.current.position.y < treeTopY - 1.0) canClimb = true;
                                }
                            }
                        }
                    }
                }
            }
        }
        
        if (canClimb) {
            playerVelocity.current.y = 15;
            isJumping.current = true;
            isClimbing = true;
        }
    }

    if (!isClimbing) {
        playerVelocity.current.y -= 40 * delta; 
    }
    group.current.position.y += playerVelocity.current.y * delta;
    let surfaceY = getTerrainHeight(group.current.position.x, group.current.position.z);
    
    if (mapData) {
        const gridX = Math.floor((group.current.position.x + WORLD_SIZE / 2) / CELL_SIZE);
        const gridZ = Math.floor((group.current.position.z + WORLD_SIZE / 2) / CELL_SIZE);
        const cellType = mapData.grid[gridZ * GRID_COUNT + gridX];
        
        let objHeight = 0;
        if (cellType === CellType.Building) {
           const gridWorldX = (gridX + 0.5) * CELL_SIZE - WORLD_SIZE / 2;
           const gridWorldZ = (gridZ + 0.5) * CELL_SIZE - WORLD_SIZE / 2;
           const b = mapData.buildings.find(bd => Math.abs(bd.position[0] - gridWorldX) < CELL_SIZE && Math.abs(bd.position[2] - gridWorldZ) < CELL_SIZE);
           if (b) objHeight = b.position[1] + b.scale[1] / 2 - getTerrainHeight(gridWorldX, gridWorldZ);
        } else if (cellType === CellType.Tree) {
           const treeX = (gridX + 0.5) * CELL_SIZE - WORLD_SIZE / 2;
           const treeZ = (gridZ + 0.5) * CELL_SIZE - WORLD_SIZE / 2;
           if (Math.hypot(group.current.position.x - treeX, group.current.position.z - treeZ) < 1.5) {
               const t = mapData.trees.find(tr => Math.abs(tr.position[0] - treeX) < 1 && Math.abs(tr.position[2] - treeZ) < 1);
               if (t) objHeight = t.height + 1;
           }
        }
        
        // If player is above or close to the object's top, they can land on it
        if (objHeight > 0 && group.current.position.y >= surfaceY + objHeight - 1.5) {
            surfaceY += objHeight;
        }
    }
    
    if (group.current.position.y <= surfaceY) { 
        group.current.position.y = surfaceY;
        playerVelocity.current.y = 0;
        isJumping.current = false;
    }

    // Star Collision Check
    if (stars.length > 0) {
        let collectedIdx = -1;
        for (let i = 0; i < stars.length; i++) {
            const p = stars[i].position;
            const distXZ = Math.hypot(group.current.position.x - p[0], group.current.position.z - p[2]);
            const distY = Math.abs(group.current.position.y - p[1]);
            // check distance
            if (distXZ < 2.0 && distY < 3.0) {
                collectedIdx = i;
                break;
            }
        }
        if (collectedIdx !== -1) {
            setStars((prev: any[]) => prev.filter((_, i) => i !== collectedIdx));
            if (onScore) onScore((s: number) => s + 1);
        }
    }

    // Food Collision Check
    if (foods && foods.length > 0) {
        let collectedIdx = -1;
        for (let i = 0; i < foods.length; i++) {
            const p = foods[i].position;
            const distXZ = Math.hypot(group.current.position.x - p[0], group.current.position.z - p[2]);
            const distY = Math.abs(group.current.position.y - p[1]);
            if (distXZ < 2.0 && distY < 3.0) {
                collectedIdx = i;
                break;
            }
        }
        if (collectedIdx !== -1) {
            setFoods((prev: any[]) => prev.filter((_, i) => i !== collectedIdx));
            if (onEatFood) onEatFood();
        }
    }

    // Camera follow smoothly
    const camDist = mode === 'driving' ? 40 : 25;
    const camYOffset = mode === 'driving' ? 35 : 20;
    
    let shouldAutoFollow = false;
    if (isMoving && path.length > 0) {
        shouldAutoFollow = true;
    } else if (isKeyboardMoving && moveZ < 0 && moveX === 0) {
        shouldAutoFollow = true;
    } else if (mode === 'driving' && isKeyboardMoving) {
        shouldAutoFollow = true;
    }

    if (shouldAutoFollow && !isDraggingRef.current) {
        const targetCamYaw = group.current.rotation.y + Math.PI;
        let diff = targetCamYaw - cameraYawRef.current;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        
        if (Math.abs(diff) > 0.01) {
            cameraYawRef.current += diff * 3 * delta;
        }
    }

    const idealCam = new THREE.Vector3(
        group.current.position.x + Math.sin(cameraYawRef.current) * camDist,
        group.current.position.y + camYOffset,
        group.current.position.z + Math.cos(cameraYawRef.current) * camDist
    );
    state.camera.position.lerp(idealCam, 0.05);
    
    const idealLookAt = group.current.position.clone();
    idealLookAt.y += 2;
    state.camera.lookAt(idealLookAt);
  });

  return (
    <group ref={group} position={[0, 0, 0]}>
      {mode === 'walking' ? (
        <>
          {/* Body */}
          <mesh position={[0, 1.5, 0]} castShadow>
            <boxGeometry args={[0.8, 1.2, 0.5]} />
            <meshStandardMaterial color="#3b82f6" />
          </mesh>
          {/* Head */}
          <mesh position={[0, 2.4, 0]} castShadow>
            <boxGeometry args={[0.6, 0.6, 0.6]} />
            <meshStandardMaterial color="#fcd5ce" />
          </mesh>
          {/* Left Arm */}
          <mesh ref={leftArm} position={[-0.55, 1.8, 0]} castShadow>
            <boxGeometry args={[0.3, 1, 0.3]} />
            <meshStandardMaterial color="#3b82f6" />
          </mesh>
          {/* Right Arm */}
          <mesh ref={rightArm} position={[0.55, 1.8, 0]} castShadow>
            <boxGeometry args={[0.3, 1, 0.3]} />
            <meshStandardMaterial color="#3b82f6" />
          </mesh>
          {/* Left Leg */}
          <mesh ref={leftLeg} position={[-0.25, 0.5, 0]} castShadow>
            <boxGeometry args={[0.35, 1, 0.35]} />
            <meshStandardMaterial color="#1e3a8a" />
          </mesh>
          {/* Right Leg */}
          <mesh ref={rightLeg} position={[0.25, 0.5, 0]} castShadow>
            <boxGeometry args={[0.35, 1, 0.35]} />
            <meshStandardMaterial color="#1e3a8a" />
          </mesh>
        </>
      ) : (
        <CarModel color={carColor} />
      )}
      
      {/* Invincibility Shield */}
      <mesh ref={shieldRef} position={[0, mode === 'walking' ? 1 : 0.5, 0]}>
         <sphereGeometry args={[mode === 'walking' ? 2 : 3, 16, 16]} />
         <meshBasicMaterial color="#fbbf24" transparent opacity={0.3} wireframe />
      </mesh>

      {!crashed && (mode === 'walking' ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <ringGeometry args={[0.6, 0.8, 16]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.3} />
        </mesh>
      ) : (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
          <ringGeometry args={[2, 2.3, 32]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.3} />
        </mesh>
      ))}

      {/* Path tracer */}
      {isMoving && !crashed && path.length > 0 && path.slice(pathIndex).map((p, i) => (
         <mesh key={`p-${i}`} position={[p.x, 0.2, p.z]} rotation={[-Math.PI/2, 0, 0]}>
            <circleGeometry args={[0.2, 8]} />
            <meshBasicMaterial color="#ffaa00" />
         </mesh>
      ))}
    </group>
  );
}

function Ground({ setTarget, setTargetActive }: { setTarget: (pos: THREE.Vector3) => void, setTargetActive: (val: boolean) => void }) {
  const [hovered, setHovered] = useState(false);
  useCursor(hovered, 'pointer', 'auto');
  const geomRef = useRef<THREE.PlaneGeometry>(null);

  useEffect(() => {
    if (geomRef.current) {
      const pos = geomRef.current.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const worldZ = -y;
        
        const h = getTerrainHeight(x, worldZ);
        pos.setZ(i, h);
      }
      geomRef.current.computeVertexNormals();
      pos.needsUpdate = true;
    }
  }, []);

  return (
    <mesh 
      rotation={[-Math.PI / 2, 0, 0]} 
      position={[0, 0, 0]} 
      receiveShadow
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={(e) => { e.stopPropagation(); setHovered(false); }}
      onPointerDown={(e) => {
        e.stopPropagation();
        setTarget(e.point.clone());
        setTargetActive(true);
      }}
    >
      <planeGeometry ref={geomRef} args={[WORLD_SIZE, WORLD_SIZE, 128, 128]} />
      <meshStandardMaterial color="#4ade80" roughness={1} />
    </mesh>
  );
}

const BuildingMesh = React.memo(({ b, emissiveMap }: { b: any, emissiveMap: THREE.Texture }) => {
  const geomRef = useRef<THREE.BoxGeometry>(null);
  
  useEffect(() => {
    if (geomRef.current) {
      const uvs = geomRef.current.attributes.uv;
      for (let i = 0; i < uvs.count; i++) {
        let u = uvs.getX(i);
        let v = uvs.getY(i);
        uvs.setXY(i, u * (b.scale[0] / 4), v * (b.scale[1] / 6)); 
      }
      uvs.needsUpdate = true;
    }
  }, [b.scale]);

  return (
    <mesh position={b.position} castShadow receiveShadow>
      <boxGeometry ref={geomRef} args={b.scale} />
      <meshStandardMaterial 
        color={b.color} 
        roughness={0.8} 
        metalness={0.2} 
        emissiveMap={emissiveMap}
        emissive="#ffffff"
        emissiveIntensity={1}
      />
    </mesh>
  );
});

export function CityScene({ onScore, onWoodChange, onEatFood }: { onScore?: (score: number | ((prev: number) => number)) => void, onWoodChange?: (wood: number | ((prev: number) => number)) => void, onEatFood?: () => void }) {
  const [target, setTarget] = useState(() => new THREE.Vector3(20, 0, 20));
  const [targetActive, setTargetActive] = useState(false);
  const cameraYawRef = useRef(0);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    let prevMouseX = 0;

    const onMouseDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement).tagName !== 'CANVAS') return;
      isDraggingRef.current = true;
      prevMouseX = e.clientX;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (isDraggingRef.current) {
        cameraYawRef.current -= (e.clientX - prevMouseX) * 0.005;
        prevMouseX = e.clientX;
      }
    };
    const onMouseUp = () => {
      isDraggingRef.current = false;
    };

    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);
  
  const [mapData, setMapData] = useState<MapData>(() => generateMap());
  
  const [stars, setStars] = useState<any[]>(() => generateStars(mapData));
  const [foods, setFoods] = useState<any[]>(() => generateFoods(mapData));

  useEffect(() => {
     if (stars.length === 0) {
         const t = setTimeout(() => {
             setStars(generateStars(mapData));
         }, 3000);
         return () => clearTimeout(t);
     }
  }, [stars.length, mapData]);

  useEffect(() => {
     if (foods.length === 0) {
         const t = setTimeout(() => {
             setFoods(generateFoods(mapData));
         }, 3000);
         return () => clearTimeout(t);
     }
  }, [foods.length, mapData]);

  const [parkedCars, setParkedCars] = useState<any[]>(() => {
    const list = [];
    const colors = ['#ef4444', '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#000000', '#ffffff'];
    let idCounter = 0;
    
    // Parked cars in parking lots
    mapData.parkingLots.forEach((lot) => {
      if (Math.random() > 0.2) { // 80% chance for a parking lot to have a car
         list.push({ 
           id: `parked-${idCounter++}`, 
           color: colors[Math.floor(Math.random() * colors.length)], 
           position: [lot.position[0], lot.position[1] + 0.1, lot.position[2]], 
           rotationY: Math.random() > 0.5 ? 0 : Math.PI / 2 
         });
      }
    });

    return list;
  });

  const movingCarsRefs = useRef<(THREE.Group | null)[]>([]);

  // Generate cars on the cross roads
  const cars = useMemo(() => {
    const list = [];
    const colors = ['#ef4444', '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#000000', '#ffffff'];
    let index = 0;
    
    // Vertical road cars
    for (let startZ = -WORLD_SIZE/2; startZ < WORLD_SIZE/2; startZ += 30) {
       list.push({
         id: `v-${index}`,
         laneOffset: (index % 2 === 0 ? 1 : -1) * 4, // left lane or right lane
         speed: 15, // uniform speed prevents overlapping
         isVertical: true,
         direction: index % 2 === 0 ? 1 : -1 as 1 | -1,
         color: colors[Math.floor(Math.random() * colors.length)],
         initialPos: startZ
       });
       index++;
    }

    // Horizontal road cars
    for (let startX = -WORLD_SIZE/2; startX < WORLD_SIZE/2; startX += 30) {
      list.push({
        id: `h-${index}`,
        laneOffset: (index % 2 === 0 ? 1 : -1) * 4, 
        speed: 15,
        isVertical: false,
        direction: index % 2 === 0 ? -1 : 1 as 1 | -1,
        color: colors[Math.floor(Math.random() * colors.length)],
        initialPos: startX
      });
      index++;
    }

    return list;
  }, []);

  const buildingEmissiveMap = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 64, 64);
    
    ctx.fillStyle = '#ffeba3';
    for(let x=4; x<64; x+=16) {
      for(let y=4; y<64; y+=16) {
        if(Math.random() > 0.6) {
           ctx.fillRect(x, y, 6, 8);
        }
      }
    }
    
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.NearestFilter;
    return tex;
  }, []);

  return (
    <div className="w-full h-screen bg-sky-200">
      <Canvas shadows camera={{ position: [0, 25, 30], fov: 45 }}>
        <Sky sunPosition={[100, 20, 100]} turbidity={0.1} rayleigh={0.5} />
        
        <ambientLight intensity={0.5} />
        <directionalLight 
          position={[150, 150, 100]} 
          intensity={1.5} 
          castShadow 
          shadow-mapSize={4096}
          shadow-bias={-0.0005}
          shadow-camera-left={-WORLD_SIZE/2}
          shadow-camera-right={WORLD_SIZE/2}
          shadow-camera-top={WORLD_SIZE/2}
          shadow-camera-bottom={-WORLD_SIZE/2}
          shadow-camera-far={WORLD_SIZE + 400}
        />
        
        <Ground setTarget={setTarget} setTargetActive={setTargetActive} />
        
        {/* Render Map */}
        {mapData.buildings.map((b, i) => (
          <BuildingMesh key={`b-${i}`} b={b} emissiveMap={buildingEmissiveMap} />
        ))}
        {mapData.parkingLots.map((p, i) => (
          <mesh key={`p-${i}`} position={p.position} receiveShadow>
            <boxGeometry args={p.scale} />
            <meshStandardMaterial color="#444444" roughness={0.9} />
            <mesh position={[0, p.scale[1] / 2 + 0.02, 0]} rotation={[-Math.PI/2, 0, 0]}>
              <planeGeometry args={[p.scale[0] * 0.8, p.scale[2] * 0.8]} />
              <meshBasicMaterial color="#aaaaaa" wireframe={true} />
            </mesh>
          </mesh>
        ))}
        {mapData.trees.map((t, i) => (
          <group key={`t-${i}`} position={t.position}>
              <mesh position={[0, t.height / 2, 0]} castShadow receiveShadow>
                  <cylinderGeometry args={[0.2, 0.4, t.height]} />
                  <meshStandardMaterial color="#5c4033" />
              </mesh>
              <mesh position={[0, t.height + 0.5, 0]} castShadow receiveShadow>
                  <sphereGeometry args={[1.5, 7, 7]} />
                  <meshStandardMaterial color="#2d5a27" roughness={0.8} />
              </mesh>
          </group>
        ))}
        {/* Horizontal Path */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
          <planeGeometry args={[WORLD_SIZE, PATH_WIDTH * 2]} />
          <meshStandardMaterial color="#333333" roughness={0.9} />
        </mesh>
        {/* Vertical Path */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
          <planeGeometry args={[PATH_WIDTH * 2, WORLD_SIZE]} />
          <meshStandardMaterial color="#333333" roughness={0.9} />
        </mesh>

        {/* Parked Cars */}
        {parkedCars.map(c => (
           <group key={c.id} position={c.position as [number, number, number]} rotation={[0, c.rotationY, 0]}>
             <CarModel color={c.color} />
           </group>
        ))}

        {/* Cars */}
        {cars.map((c, i) => <MovingCar key={c.id} {...c} trees={mapData.trees} ref={el => movingCarsRefs.current[i] = el} />)}
        
        {/* Stars */}
        {stars.map((s) => <StarMesh key={s.id} position={s.position} />)}

        {/* Foods */}
        {foods.map((f) => (
          <mesh key={f.id} position={f.position}>
             <boxGeometry args={[0.6, 0.6, 0.6]} />
             <meshStandardMaterial color="#fca5a5" emissive="#ef4444" emissiveIntensity={0.5} />
          </mesh>
        ))}

        <Player target={target} isMoving={targetActive} onReachTarget={() => setTargetActive(false)} mapData={mapData} setMapData={setMapData} movingCarsRefs={movingCarsRefs} parkedCars={parkedCars} setParkedCars={setParkedCars} cameraYawRef={cameraYawRef} isDraggingRef={isDraggingRef} stars={stars} setStars={setStars} onScore={onScore} onWoodChange={onWoodChange} foods={foods} setFoods={setFoods} onEatFood={onEatFood} />
        
        {/* Target marker (where user clicked) */}
        {targetActive && mapData && (
          <mesh position={[target.x, 0.2, target.z]} rotation={[-Math.PI/2, 0, 0]}>
            <ringGeometry args={[0.4, 0.6, 32]} />
            <meshBasicMaterial color="#ff0000" />
          </mesh>
        )}
      </Canvas>
    </div>
  );
}
