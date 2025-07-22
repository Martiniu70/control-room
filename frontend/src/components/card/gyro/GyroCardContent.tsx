// src/components/card/gyroscope/GyroscopeCardContent.tsx
import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { VisualizationContentProps } from '../CardWrapper';

/**
 * @file GyroscopeCardContent.tsx
 * @description This component renders a 3D cube visualization for Gyroscope data.
 * The cube rotates based on the incoming gyroscope values, providing a visual
 * representation of angular velocity. It also includes optional mouse interaction
 * for manual rotation.
 */

/**
 * Interface for Gyroscope data.
 */
interface GyroscopeData {
  x: number[]; // Array of X-axis rotation values.
  y: number[]; // Array of Y-axis rotation values.
  z: number[]; // Array of Z-axis rotation values.
}

/**
 * Interface defining the props for the GyroscopeContent component,
 * extending common visualization properties.
 */
interface GyroscopeContentProps extends VisualizationContentProps {
  data: GyroscopeData | null; // Gyroscope data (can be null).
  // cardWidth and cardHeight are inherited from VisualizationContentProps.
  onRotationUpdate: (x: number, y: number, z: number) => void; // Callback to send rotation values to parent.
}

/**
 * GyroscopeCardContent functional component.
 * Renders a 3D cube that rotates based on gyroscope data and optional mouse input.
 * @param {GyroscopeContentProps} props - The properties passed to the component.
 * @returns {JSX.Element} The gyroscope 3D cube visualization JSX.
 */
const GyroscopeCardContent: React.FC<GyroscopeContentProps> = ({
  data,
  cardWidth = 300,  // Default width if not provided.
  cardHeight = 100, // Default height if not provided.
  onRotationUpdate
}) => {
  // Ref for the DOM element where the 3D scene will be rendered.
  const mountRef = useRef<HTMLDivElement>(null);
  // Refs to store Three.js instances that need to persist across re-renders.
  const objectGroupRef = useRef<THREE.Group | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  // Ref to store the latest gyroscope data for use in the animation loop.
  const latestGyroDataRef = useRef<GyroscopeData | null>(null);

  // States to control mouse-based rotation of the sphere (optional, can be removed if only gyroscope data is used).
  const [isDragging, setIsDragging] = useState(false);
  const [previousMousePosition, setPreviousMousePosition] = useState({ x: 0, y: 0 });

  /**
   * Effect hook to update the `latestGyroDataRef` whenever the `data` prop changes.
   * This ensures the animation loop always has access to the most recent gyroscope data.
   */
  useEffect(() => {
    latestGyroDataRef.current = data;
  }, [data]); // Dependency: `data` prop.

  /**
   * Effect hook for initial setup of the Three.js scene and renderer,
   * and for handling updates when `cardWidth` or `cardHeight` change.
   */
  useEffect(() => {
    if (!mountRef.current) return;

    // 1. Scene Setup (initialized only once)
    if (!sceneRef.current) {
      sceneRef.current = new THREE.Scene();
      sceneRef.current.background = new THREE.Color(0xf0f0f0); // Light gray background.
    }
    const scene = sceneRef.current;

    // 2. Camera Setup (initialized only once, updated on resize)
    if (!cameraRef.current) {
      cameraRef.current = new THREE.PerspectiveCamera(75, cardWidth / cardHeight, 0.1, 1000);
      cameraRef.current.position.z = 2;
    }
    const camera = cameraRef.current;
    camera.aspect = cardWidth / cardHeight; // Update camera aspect ratio.
    camera.updateProjectionMatrix(); // Recalculate camera projection matrix.

    // 3. Renderer Setup (initialized only once, updated on resize)
    const renderWidth = cardWidth - 10; // Small margin for rendering area.
    const renderHeight = cardHeight - 10; // Small margin for rendering area.

    if (!rendererRef.current) {
      rendererRef.current = new THREE.WebGLRenderer({ antialias: true });
      mountRef.current.innerHTML = ''; // Clear any previous canvas to avoid duplicates.
      mountRef.current.appendChild(rendererRef.current.domElement);
    }
    const renderer = rendererRef.current;
    renderer.setSize(renderWidth, renderHeight); // Set renderer size.
    renderer.setPixelRatio(window.devicePixelRatio); // Set pixel ratio for high quality.

    // 4. 3D Cube Creation (created only once)
    if (!objectGroupRef.current) {
      const boxSize = 1.0; // Size of the cube.
      const geometry = new THREE.BoxGeometry(boxSize, boxSize, boxSize); // Cube geometry.

      // Materials for the cube faces.
      const translucentMaterial = new THREE.MeshBasicMaterial({
        color: 0x007bff, // Vibrant blue for normal faces.
        transparent: true,
        opacity: 0.3,
        depthWrite: false, // Do not write to depth buffer for translucency.
      });

      const solidFrontMaterial = new THREE.MeshBasicMaterial({
        color: 0x0000ff, // Solid blue for the front face.
        transparent: false,
        side: THREE.DoubleSide, // Render both sides.
      });

      const solidBackMaterial = new THREE.MeshBasicMaterial({
        color: 0xff0000, // Solid red for the back face.
        transparent: false,
        side: THREE.DoubleSide, // Render both sides.
      });

      // Create an array of materials for the cube faces.
      // Order: [+X, -X, +Y, -Y, +Z (Front), -Z (Back)]
      const materials = [
        translucentMaterial, // +X (Right)
        translucentMaterial, // -X (Left)
        translucentMaterial, // +Y (Top)
        translucentMaterial, // -Y (Bottom)
        solidFrontMaterial,  // +Z (Front) - Solid Blue
        solidBackMaterial,   // -Z (Back) - Solid Red
      ];

      const cube = new THREE.Mesh(geometry, materials); // Apply the array of materials.

      const group = new THREE.Group(); // Use a group to apply initial rotation to the cube.
      group.add(cube);
      objectGroupRef.current = group; // Store the group in the ref.
      scene.add(group); // Add the group to the scene only once.

      // Optional: Add edges (wireframe) to the cube for better visualization of rotations.
      const edges = new THREE.EdgesGeometry(geometry);
      const lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 }); // Black lines.
      const wireframe = new THREE.LineSegments(edges, lineMaterial);
      cube.add(wireframe); // Add lines as a child of the cube.

      // Set initial rotation to 0 on all axes, so reference faces point directly at the user.
      objectGroupRef.current.rotation.x = 0;
      objectGroupRef.current.rotation.y = 0;
      objectGroupRef.current.rotation.z = 0;

      // Add mouse event listeners to the renderer's DOM element for interaction.
      const domElement = renderer.domElement;
      domElement.addEventListener('mousedown', onMouseDown);
      domElement.addEventListener('mousemove', onMouseMove);
      domElement.addEventListener('mouseup', onMouseUp);
      domElement.addEventListener('mouseleave', onMouseUp); // Stop dragging if mouse leaves canvas.
    }

    // 6. Animation Loop
    const animate = () => {
      // Ensure renderer, scene, and camera exist before rendering.
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        let currentX = 0;
        let currentY = 0;
        let currentZ = 0;

        // Apply rotation based on gyroscope data.
        if (objectGroupRef.current && latestGyroDataRef.current) {
          const currentData = latestGyroDataRef.current;
          // Get the latest value from each array.
          currentX = currentData.x[currentData.x.length - 1] || 0;
          currentY = currentData.y[currentData.y.length - 1] || 0;
          currentZ = currentData.z[currentData.z.length - 1] || 0;

          // Sensitivity factor to adjust rotation speed.
          // This value can be adjusted to control the visual "speed" of rotation.
          const sensitivity = 0.01;

          // UPDATED: Mapping of rotation axes.
          // Incoming X (horizontal) -> Three.js X-axis rotation (Pitch)
          objectGroupRef.current.rotation.x += THREE.MathUtils.degToRad(currentX) * sensitivity;
          // Incoming Z (vertical) -> Three.js Y-axis rotation (Yaw)
          objectGroupRef.current.rotation.y += THREE.MathUtils.degToRad(currentZ) * sensitivity;
          // Incoming Y (depth) -> Three.js Z-axis rotation (Roll)
          objectGroupRef.current.rotation.z += THREE.MathUtils.degToRad(currentY) * sensitivity;
        }

        rendererRef.current.render(sceneRef.current, cameraRef.current);

        // Call the callback to send the *instantaneous* values (from the backend).
        // These values are still in deg/s, as they come from the backend.
        onRotationUpdate(currentX, currentY, currentZ);
      }
      // Store the ID of the next frame so it can be canceled.
      animationFrameIdRef.current = requestAnimationFrame(animate);
    };

    // Start the animation loop only if it's not already running.
    if (animationFrameIdRef.current === null) {
      animate();
    }

    // 7. Cleanup
    // Cleanup function that will be executed when the component is unmounted.
    return () => {
      // Cancel the animation loop if an ID exists.
      if (animationFrameIdRef.current !== null) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null; // Reset the ID.
      }

      // If `mountRef` does not contain the canvas, it means the component is being unmounted.
      if (!mountRef.current || !mountRef.current.contains(rendererRef.current?.domElement || null)) {
        console.log("Cleaning up Three.js scene");
        // Remove event listeners.
        if (rendererRef.current) {
          const domElement = rendererRef.current.domElement;
          domElement.removeEventListener('mousedown', onMouseDown);
          domElement.removeEventListener('mousemove', onMouseMove);
          domElement.removeEventListener('mouseup', onMouseUp);
          domElement.removeEventListener('mouseleave', onMouseUp);
        }

        // Dispose of Three.js objects to free up memory.
        if (objectGroupRef.current) {
          objectGroupRef.current.traverse((obj) => {
            if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
              if (obj.geometry) obj.geometry.dispose();
              if (Array.isArray(obj.material)) {
                obj.material.forEach(material => material.dispose());
              } else if (obj.material) {
                obj.material.dispose();
              }
            }
          });
          sceneRef.current?.remove(objectGroupRef.current);
        }
        rendererRef.current?.dispose();

        // Reset references.
        objectGroupRef.current = null;
        rendererRef.current = null;
        cameraRef.current = null;
        sceneRef.current = null;
      }
    };
  }, [cardWidth, cardHeight, onRotationUpdate]); // Added `onRotationUpdate` to dependencies.

  // 5. Mouse Interaction (Rotation) - Functions defined outside useEffect.
  // These functions still allow manual rotation, and gyroscope rotation will ADD to them.
  // If you want gyroscope rotation to be the only source of rotation,
  // you can remove these event listeners and the `onMouseDown`, `onMouseMove`, `onMouseUp` functions.
  const onMouseDown = (event: MouseEvent) => {
    setIsDragging(true);
    setPreviousMousePosition({ x: event.clientX, y: event.clientY });
  };

  const onMouseMove = (event: MouseEvent) => {
    if (!isDragging || !objectGroupRef.current) return;

    const deltaX = event.clientX - previousMousePosition.x;
    const deltaY = event.clientY - previousMousePosition.y;

    const rotationSpeed = 0.01;

    // Directly modify the rotation of the persistent Three.js object.
    // This mouse rotation will ADD to the gyroscope rotation.
    objectGroupRef.current.rotation.y += deltaX * rotationSpeed;
    objectGroupRef.current.rotation.x += deltaY * rotationSpeed;

    setPreviousMousePosition({ x: event.clientX, y: event.clientY });
  };

  const onMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center">
      <div ref={mountRef} className="flex-1 w-full h-full">
        {/* The Three.js canvas will be mounted here */}
      </div>
    </div>
  );
};

export default GyroscopeCardContent;