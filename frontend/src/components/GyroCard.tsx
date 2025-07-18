// components/GyroscopeCard.tsx
import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';

// Define a interface para os dados do giroscópio
interface GyroscopeData {
  x: number[];
  y: number[];
  z: number[];
}

// Define as propriedades do componente GyroscopeCard
interface GyroscopeCardProps {
  title: string;
  data: GyroscopeData | null;
  width: number;
  height: number;
}

const GyroscopeCard: React.FC<GyroscopeCardProps> = ({ title, data, width, height }) => {
  // Referência para o elemento canvas onde a cena 3D será renderizada
  const mountRef = useRef<HTMLDivElement>(null);
  // Refs para armazenar as instâncias do Three.js que devem persistir
  const objectGroupRef = useRef<THREE.Group | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  // Ref para armazenar a versão mais recente dos dados do giroscópio
  const latestGyroDataRef = useRef<GyroscopeData | null>(null);

  // Estados para controlar a rotação da esfera com o mouse
  const [isDragging, setIsDragging] = useState(false);
  const [previousMousePosition, setPreviousMousePosition] = useState({ x: 0, y: 0 });

  // Estado para armazenar os valores de rotação para exibição
  const [rotationValues, setRotationValues] = useState({ x: 0, y: 0, z: 0 });

  // Este useEffect atualiza o ref com os dados mais recentes do giroscópio.
  // Ele é executado sempre que a prop 'data' muda.
  useEffect(() => {
    latestGyroDataRef.current = data;
  }, [data]); // Dependência: 'data'

  // Este useEffect será executado uma vez para a configuração inicial
  // e sempre que a largura ou altura do card mudarem.
  useEffect(() => {
    if (!mountRef.current) return;

    // 1. Configuração da Cena (inicializa apenas uma vez)
    if (!sceneRef.current) {
      sceneRef.current = new THREE.Scene();
      sceneRef.current.background = new THREE.Color(0xf0f0f0); // Cor de fundo cinza claro
    }
    const scene = sceneRef.current;

    // 2. Configuração da Câmera (inicializa apenas uma vez, atualiza em redimensionamento)
    if (!cameraRef.current) {
      cameraRef.current = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
      cameraRef.current.position.z = 2;
    }
    const camera = cameraRef.current;
    camera.aspect = width / height; // Atualiza o aspect ratio da câmera
    camera.updateProjectionMatrix(); // Recalcula a matriz de projeção da câmera

    // 3. Configuração do Renderizador (inicializa apenas uma vez, atualiza em redimensionamento)
    if (!rendererRef.current) {
      rendererRef.current = new THREE.WebGLRenderer({ antialias: true });
      mountRef.current.innerHTML = ''; // Limpa qualquer canvas anterior para evitar duplicatas
      mountRef.current.appendChild(rendererRef.current.domElement);
    }
    const renderer = rendererRef.current;
    renderer.setSize(width, height); // Define o tamanho do renderizador
    renderer.setPixelRatio(window.devicePixelRatio); // Define a proporção de pixels para alta qualidade

    // 4. Criação do Cubo 3D (cria apenas uma vez)
    if (!objectGroupRef.current) {
      const boxSize = 1.0; // Tamanho do cubo
      const geometry = new THREE.BoxGeometry(boxSize, boxSize, boxSize); // Geometria do cubo

      // Materiais para as faces
      const translucentMaterial = new THREE.MeshBasicMaterial({
        color: 0x007bff, // Azul vibrante para faces normais
        transparent: true,
        opacity: 0.3,
        depthWrite: false, // Não escreve no buffer de profundidade
      });

      const solidFrontMaterial = new THREE.MeshBasicMaterial({
        color: 0x0000ff, // Azul sólido para a face frontal
        transparent: false, // Opaque
        side: THREE.DoubleSide, // NOVO: Renderiza ambos os lados
      });

      const solidBackMaterial = new THREE.MeshBasicMaterial({
        color: 0xff0000, // Vermelho sólido para a face traseira
        transparent: false, // Opaque
        side: THREE.DoubleSide, // NOVO: Renderiza ambos os lados
      });

      // Cria uma array de materiais para o cubo
      // Ordem: [+X, -X, +Y, -Y, +Z (Frente), -Z (Trás)]
      const materials = [
        translucentMaterial, // +X (Direita)
        translucentMaterial, // -X (Esquerda)
        translucentMaterial, // +Y (Cima)
        translucentMaterial, // -Y (Baixo)
        solidFrontMaterial,  // +Z (Frente) - Azul Sólido
        solidBackMaterial,   // -Z (Trás) - Vermelho Sólido
      ];

      const cube = new THREE.Mesh(geometry, materials); // Aplica a array de materiais

      const group = new THREE.Group(); // Usamos um grupo para aplicar a rotação inicial ao cubo
      group.add(cube);
      objectGroupRef.current = group; // Armazena o grupo na ref
      scene.add(group); // Adiciona o grupo à cena apenas uma vez

      // Opcional: Adicionar arestas (wireframe) ao cubo para melhor visualização das rotações
      const edges = new THREE.EdgesGeometry(geometry);
      const lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 }); // Linhas pretas
      const wireframe = new THREE.LineSegments(edges, lineMaterial);
      cube.add(wireframe); // Adiciona as linhas como um filho do cubo

      // Define a rotação inicial como 0 em todos os eixos
      // para que as faces de referência estejam diretamente apontadas para o utilizador.
      objectGroupRef.current.rotation.x = 0;
      objectGroupRef.current.rotation.y = 0;
      objectGroupRef.current.rotation.z = 0;

      // Adiciona os event listeners ao elemento DOM do renderizador
      const domElement = renderer.domElement;
      domElement.addEventListener('mousedown', onMouseDown);
      domElement.addEventListener('mousemove', onMouseMove);
      domElement.addEventListener('mouseup', onMouseUp);
      domElement.addEventListener('mouseleave', onMouseUp); // Para parar de arrastar se o mouse sair do canvas
    }

    // 6. Loop de Animação
    const animate = () => {
      // Verifica se o renderizador, cena e câmera existem antes de renderizar
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        // Aplicar rotação com base nos dados do giroscópio
        if (objectGroupRef.current && latestGyroDataRef.current) {
          const currentData = latestGyroDataRef.current;
          // Pega o último valor de cada array (o mais recente)
          const lastX = currentData.x[currentData.x.length - 1];
          const lastY = currentData.y[currentData.y.length - 1];
          const lastZ = currentData.z[currentData.z.length - 1];

          // Fator de sensibilidade para ajustar a velocidade da rotação.
          // Este valor pode precisar ser ajustado dependendo da escala dos dados do seu giroscópio.
          const sensitivity = 0.01; 

          if (lastX !== undefined) {
            objectGroupRef.current.rotation.x += lastX * sensitivity;
          }
          if (lastY !== undefined) {
            objectGroupRef.current.rotation.y += lastY * sensitivity;
          }
          if (lastZ !== undefined) {
            objectGroupRef.current.rotation.z += lastZ * sensitivity;
          }
        }

        rendererRef.current.render(sceneRef.current, cameraRef.current);

        // Atualiza o estado com os valores de rotação atuais
        if (objectGroupRef.current) {
          setRotationValues({
            x: objectGroupRef.current.rotation.x,
            y: objectGroupRef.current.rotation.y,
            z: objectGroupRef.current.rotation.z,
          });
        }
      }
      // Armazena o ID do próximo frame para que possa ser cancelado
      animationFrameIdRef.current = requestAnimationFrame(animate);
    };

    // Inicia o loop de animação apenas se ainda não estiver rodando
    if (animationFrameIdRef.current === null) {
      animate();
    }

    // 7. Cleanup
    // Função de limpeza que será executada quando o componente for desmontado.
    return () => {
      // Cancela o loop de animação se existir um ID
      if (animationFrameIdRef.current !== null) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null; // Reseta o ID
      }

      // Se o mountRef não contiver o canvas, significa que o componente está sendo desmontado.
      if (!mountRef.current || !mountRef.current.contains(rendererRef.current?.domElement || null)) {
        console.log("Cleaning up Three.js scene");
        // Remove event listeners
        if (rendererRef.current) {
          const domElement = rendererRef.current.domElement;
          domElement.removeEventListener('mousedown', onMouseDown);
          domElement.removeEventListener('mousemove', onMouseMove);
          domElement.removeEventListener('mouseup', onMouseUp);
          domElement.removeEventListener('mouseleave', onMouseUp);
        }

        // Descarta os objetos do Three.js para liberar memória
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

        // Reseta as referências
        objectGroupRef.current = null;
        rendererRef.current = null;
        cameraRef.current = null;
        sceneRef.current = null;
      }
    };
  }, [width, height]); // Dependências: o setup só é re-executado se a largura ou altura mudarem

  // 5. Interatividade com o Mouse (Rotação) - Funções definidas fora do useEffect
  const onMouseDown = (event: MouseEvent) => {
    setIsDragging(true);
    setPreviousMousePosition({ x: event.clientX, y: event.clientY });
  };

  const onMouseMove = (event: MouseEvent) => {
    if (!isDragging || !objectGroupRef.current) return;

    const deltaX = event.clientX - previousMousePosition.x;
    const deltaY = event.clientY - previousMousePosition.y;

    const rotationSpeed = 0.01;

    // Modifica diretamente a rotação do objeto Three.js persistente
    objectGroupRef.current.rotation.y += deltaX * rotationSpeed;
    objectGroupRef.current.rotation.x += deltaY * rotationSpeed;

    setPreviousMousePosition({ x: event.clientX, y: event.clientY });
  };

  const onMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center">
      {title && <h4 className="text-lg font-semibold mb-2">{title}</h4>}
      <div ref={mountRef} className="flex-1 w-full h-full" style={{ minHeight: '150px' }}>
        {/* O canvas three.js será montado aqui */}
      </div>
      {/* Exibir os valores de rotação */}
      <div className="text-sm mt-2 text-gray-700">
        <p>Rotação X: {rotationValues.x.toFixed(2)} rad</p>
        <p>Rotação Y: {rotationValues.y.toFixed(2)} rad</p>
        <p>Rotação Z: {rotationValues.z.toFixed(2)} rad</p>
      </div>
    </div>
  );
};

export default GyroscopeCard;
