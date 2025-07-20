// components/GyroscopeCard.tsx
import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import CardWrapper from './CardWrapper'; // Importar o CardWrapper

// Define a interface para os dados do giroscópio
interface GyroscopeData {
  x: number[];
  y: number[];
  z: number[];
}

// Define as propriedades do componente GyroscopeContent
interface GyroscopeContentProps { // Conteúdo real da visualização 3D
  data: GyroscopeData | null;
  cardWidth: number;
  cardHeight: number;
  // Callback para enviar os valores de rotação para o componente pai
  onRotationUpdate: (x: number, y: number, z: number) => void; 
}

const GyroscopeCardContent: React.FC<GyroscopeContentProps> = ({ data, cardWidth, cardHeight, onRotationUpdate }) => {
  // Referência para o elemento canvas onde a cena 3D será renderizada
  const mountRef = useRef<HTMLDivElement>(null);
  // Refs para armazenar as instâncias do Three.js que devem persistir
  const objectGroupRef = useRef<THREE.Group | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null); // Inicializado como null
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  // Ref para armazenar a versão mais recente dos dados do giroscópio
  const latestGyroDataRef = useRef<GyroscopeData | null>(null);

  // Estados para controlar a rotação da esfera com o mouse
  const [isDragging, setIsDragging] = useState(false);
  const [previousMousePosition, setPreviousMousePosition] = useState({ x: 0, y: 0 });

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
      cameraRef.current = new THREE.PerspectiveCamera(75, cardWidth / cardHeight, 0.1, 1000);
      cameraRef.current.position.z = 2;
    }
    const camera = cameraRef.current;
    camera.aspect = cardWidth / cardHeight; // Atualiza o aspect ratio da câmera
    camera.updateProjectionMatrix(); // Recalcula a matriz de projeção da câmera

    // 3. Configuração do Renderizador (inicializa apenas uma vez, atualiza em redimensionamento)
    const renderWidth = cardWidth - 30; 
    const renderHeight = cardHeight - 100; 
    
    if (!rendererRef.current) {
      rendererRef.current = new THREE.WebGLRenderer({ antialias: true });
      mountRef.current.innerHTML = ''; // Limpa qualquer canvas anterior para evitar duplicatas
      mountRef.current.appendChild(rendererRef.current.domElement);
    }
    const renderer = rendererRef.current;
    renderer.setSize(renderWidth, renderHeight); // Define o tamanho do renderizador
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
        side: THREE.DoubleSide, // Renderiza ambos os lados
      });

      const solidBackMaterial = new THREE.MeshBasicMaterial({
        color: 0xff0000, // Vermelho sólido para a face traseira
        transparent: false, // Opaque
        side: THREE.DoubleSide, // Renderiza ambos os lados
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
        let currentX = 0;
        let currentY = 0;
        let currentZ = 0;

        // Aplicar rotação com base nos dados do giroscópio
        if (objectGroupRef.current && latestGyroDataRef.current) {
          const currentData = latestGyroDataRef.current;
          // Pega o último valor de cada array (o mais recente)
          currentX = currentData.x[currentData.x.length - 1] || 0;
          currentY = currentData.y[currentData.y.length - 1] || 0;
          currentZ = currentData.z[currentData.z.length - 1] || 0;

          // Fator de sensibilidade para ajustar a velocidade da rotação.
          // Este valor pode ser ajustado para controlar a "velocidade" da rotação visual.
          const sensitivity = 0.01; 

          // ATUALIZADO: Mapeamento dos eixos de rotação
          // Incoming X (horizontal) -> Three.js X-axis rotation (Pitch)
          objectGroupRef.current.rotation.x += THREE.MathUtils.degToRad(currentX) * sensitivity;
          // Incoming Z (vertical) -> Three.js Y-axis rotation (Yaw)
          objectGroupRef.current.rotation.y += THREE.MathUtils.degToRad(currentZ) * sensitivity;
          // Incoming Y (profundidade) -> Three.js Z-axis rotation (Roll)
          objectGroupRef.current.rotation.z += THREE.MathUtils.degToRad(currentY) * sensitivity;
        }

        rendererRef.current.render(sceneRef.current, cameraRef.current);

        // Chama o callback para enviar os valores *instantâneos* (do backend)
        // Estes valores ainda estão em graus/s, como vêm do backend.
        onRotationUpdate(currentX, currentY, currentZ);
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
  }, [cardWidth, cardHeight, onRotationUpdate]); // Adicionado onRotationUpdate às dependências

  // 5. Interatividade com o Mouse (Rotação) - Funções definidas fora do useEffect
  // Estas funções ainda permitem a rotação manual, e a rotação do giroscópio irá ADICIONAR-SE a elas.
  // Se quiser que a rotação do giroscópio seja a única fonte de rotação,
  // pode remover estes event listeners e as funções onMouseDown, onMouseMove, onMouseUp.
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
    // Esta rotação do mouse irá ADICIONAR-SE à rotação do giroscópio.
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
        {/* O canvas three.js será montado aqui */}
      </div>
    </div>
  );
};

// Componente Wrapper para uso externo
interface GyroscopeCardProps {
    title: string;
    data: GyroscopeData | null;
    width?: number;
    height?: number;
}

const GyroscopeCard: React.FC<GyroscopeCardProps> = ({
    title,
    data,
    width,
    height,
}) => {
    // Estado para armazenar os valores de rotação para exibição no header
    // Iniciado com null para indicar "sem dados" ou "ainda não recebido"
    const [displayRotationValues, setDisplayRotationValues] = useState<{ x: number; y: number; z: number } | null>(null);

    // Callback para atualizar os valores de rotação
    const handleRotationUpdate = useCallback((x: number, y: number, z: number) => {
        setDisplayRotationValues({ x, y, z });
    }, []);

    // Determine if there's any data present to show content or the "no data" message
    const hasData = data && (data.x.length > 0 || data.y.length > 0 || data.z.length > 0);

    // Conteúdo do cabeçalho para o CardWrapper
    const headerContent = (
        <div className="text-right text-sm text-gray-700">
            {displayRotationValues ? (
                <>
                    <p>X: {displayRotationValues.x.toFixed(2)} deg/s</p> {/* Unidade para deg/s */}
                    <p>Y: {displayRotationValues.y.toFixed(2)} deg/s</p>
                    <p>Z: {displayRotationValues.z.toFixed(2)} deg/s</p>
                </>
            ) : (
                <p>N/A</p> // Mensagem quando não há dados de rotação para exibir
            )}
        </div>
    );

    return (
        <CardWrapper
            title={title}
            width={width}
            height={height}
            isLoading={!hasData}
            noDataMessage="Waiting for gyroscope data..."
            headerContent={headerContent} // Passa o conteúdo do cabeçalho
        >
            {hasData ? (
                <GyroscopeCardContent
                    data={data}
                    cardWidth={width || 300}
                    cardHeight={height || 200}
                    onRotationUpdate={handleRotationUpdate} // Passa o callback
                />
            ) : null}
        </CardWrapper>
    );
};

export default GyroscopeCard;