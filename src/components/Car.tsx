import React, { useRef, forwardRef, useImperativeHandle } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { WORLD_SIZE } from '../lib/worldMap';

interface CarProps {
  laneOffset: number;
  speed: number;
  isVertical: boolean;
  color: string;
  initialPos: number;
  direction: 1 | -1;
  trees?: { position: [number, number, number], height: number }[];
}

export function CarModel({ color }: { color: string }) {
  return (
    <group>
      {/* Car Body */}
      <mesh position={[0, 0.6, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.8, 0.8, 4]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.6} />
      </mesh>
      {/* Car Top / Windows */}
      <mesh position={[0, 1.3, -0.2]} castShadow>
        <boxGeometry args={[1.6, 0.6, 2.2]} />
        <meshStandardMaterial color="#333333" roughness={0.1} metalness={0.8} />
      </mesh>
      
      {/* Headlights */}
      <mesh position={[-0.6, 0.6, 2.01]}>
         <planeGeometry args={[0.4, 0.3]} />
         <meshBasicMaterial color="#ffffaa" />
      </mesh>
      <mesh position={[0.6, 0.6, 2.01]}>
         <planeGeometry args={[0.4, 0.3]} />
         <meshBasicMaterial color="#ffffaa" />
      </mesh>

      {/* Taillights */}
      <mesh position={[-0.6, 0.6, -2.01]} rotation={[0, Math.PI, 0]}>
         <planeGeometry args={[0.4, 0.3]} />
         <meshBasicMaterial color="#ff0000" />
      </mesh>
      <mesh position={[0.6, 0.6, -2.01]} rotation={[0, Math.PI, 0]}>
         <planeGeometry args={[0.4, 0.3]} />
         <meshBasicMaterial color="#ff0000" />
      </mesh>
    </group>
  );
}

export const MovingCar = forwardRef<THREE.Group, CarProps>(({ laneOffset, speed, isVertical, color, initialPos, direction, trees }, ref) => {
  const group = useRef<THREE.Group>(null);
  const crashed = useRef(false);
  useImperativeHandle(ref, () => group.current!);
  
  useFrame((state, delta) => {
    if (!group.current) return;
    
    if (crashed.current) return;

    if (trees) {
       for (const t of trees) {
          const distXZ = Math.hypot(group.current.position.x - t.position[0], group.current.position.z - t.position[2]);
          if (distXZ < 2.5) {
             crashed.current = true;
             // Flip the car
             group.current.rotation.z = Math.PI;
             group.current.position.y += 1;
             return;
          }
       }
    }
    
    // Move car
    if (isVertical) {
      group.current.position.z += speed * direction * delta;
      
      // Loop around
      if (direction === 1 && group.current.position.z > WORLD_SIZE / 2) {
        group.current.position.z = -WORLD_SIZE / 2;
      } else if (direction === -1 && group.current.position.z < -WORLD_SIZE / 2) {
        group.current.position.z = WORLD_SIZE / 2;
      }
    } else {
      group.current.position.x += speed * direction * delta;
      
      // Loop around
      if (direction === 1 && group.current.position.x > WORLD_SIZE / 2) {
        group.current.position.x = -WORLD_SIZE / 2;
      } else if (direction === -1 && group.current.position.x < -WORLD_SIZE / 2) {
        group.current.position.x = WORLD_SIZE / 2;
      }
    }
  });

  const xPos = isVertical ? laneOffset : initialPos;
  const zPos = isVertical ? initialPos : laneOffset;
  
  // Rotation based on direction
  let rotationY = 0;
  if (isVertical) {
    rotationY = direction === 1 ? 0 : Math.PI;
  } else {
    rotationY = direction === 1 ? Math.PI / 2 : -Math.PI / 2;
  }

  return (
    <group ref={group} position={[xPos, 0, zPos]} rotation={[0, rotationY, 0]}>
      <CarModel color={color} />
    </group>
  );
});
