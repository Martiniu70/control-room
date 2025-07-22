// components/CardWrapper.tsx
import React, { useState, useCallback, Suspense } from 'react'; // Importar Suspense

// Interface que define as propriedades que os componentes de conteúdo de visualização devem aceitar
export interface VisualizationContentProps {
  cardWidth?: number; // Tornar opcional, pois CardWrapper irá injetar
  cardHeight?: number; // Tornar opcional, pois CardWrapper irá injetar
  // Adicione aqui quaisquer outras props comuns que todos os componentes de visualização possam precisar
  data: any; // Dados genéricos, o componente de visualização específico saberá o tipo
  unit?: string; // Unidade, se aplicável
  color?: string; // Cor, se aplicável
  selectedChannelKey?: string; // Para EegRawCard, por exemplo
  onRotationUpdate?: (x: number, y: number, z: number) => void; // Para GyroCard, por exemplo
}

// NOVO: Interface para a configuração de uma visualização
interface VisualizationConfig {
  label: string;
  component: React.ComponentType<any>; // Componente React da visualização
}

interface CardWrapperProps {
  title: string;
  width?: number;
  height?: number;
  isLoading?: boolean;
  noDataMessage?: string;
  detailsContent?: React.ReactNode; // Slot para os detalhes/valores
  onClose?: () => void; // Callback para fechar o card
  headerContent?: React.ReactNode; // ADICIONADO NOVAMENTE: Para conteúdo customizado no cabeçalho (como o botão de ciclo)
  
  // NOVO: Array de visualizações que este card pode exibir
  visualizations: VisualizationConfig[];
  // NOVO: Dados específicos do card, que serão passados para a visualização ativa
  cardData: any;
  // NOVO: Props adicionais que podem ser passadas para as visualizações (ex: unit, color, selectedChannelKey)
  visualizationProps?: { [key: string]: any };
}

const CardWrapper: React.FC<CardWrapperProps> = ({
  title,
  width = 300,
  height = 200,
  isLoading = false,
  noDataMessage = "A aguardar dados...",
  detailsContent,
  onClose,
  headerContent, // Recebe o conteúdo customizado para o cabeçalho
  visualizations, // Recebe o array de visualizações
  cardData, // Recebe os dados brutos do card
  visualizationProps = {}, // Recebe props adicionais para as visualizações
}) => {
  // Alturas fixas para o cabeçalho e a área de detalhes
  const HEADER_HEIGHT = 40; // Altura do cabeçalho
  const DETAILS_HEIGHT = 60; // Altura da área de detalhes

  // Altura da área de visualização calculada dinamicamente
  const visualizationHeight = height - HEADER_HEIGHT - DETAILS_HEIGHT;

  // Estado para controlar a visualização ativa
  const [currentVisualizationIndex, setCurrentVisualizationIndex] = useState(0);

  // Função para alternar para a próxima visualização
  const handleToggleVisualization = useCallback(() => {
    setCurrentVisualizationIndex(prevIndex =>
      (prevIndex + 1) % visualizations.length
    );
  }, [visualizations.length]);

  // A visualização ativa
  const ActiveVisualization = visualizations[currentVisualizationIndex]?.component;
  const activeVisualizationLabel = visualizations[currentVisualizationIndex]?.label;

  // As novas propriedades a serem passadas para o componente de visualização ativo
  const newVisualizationProps: VisualizationContentProps = {
    cardWidth: width,
    cardHeight: visualizationHeight,
    data: cardData, // Passa os dados brutos
    ...visualizationProps, // Passa quaisquer props adicionais
  };

  // Botão para alternar a visualização (renderizado apenas se houver mais de uma)
  const toggleVisualizationButton = visualizations.length > 1 && (
    <button
      onClick={handleToggleVisualization}
      className="ml-2 px-3 py-1 bg-purple-500 text-white rounded-md text-sm hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 transition-colors duration-200"
      aria-label="Alternar visualização"
      disabled={isLoading} // Desabilita se estiver a carregar
    >
      {`Ver ${visualizations[(currentVisualizationIndex + 1) % visualizations.length]?.label || ''}`}
    </button>
  );

  return (
    <div
      className="bg-white rounded-lg shadow-md flex flex-col overflow-hidden"
      style={{ width: width, height: height }}
    >
      {/* Header Section */}
      <div
        className="flex justify-between items-center px-4 py-2 border-b border-gray-200"
        style={{ height: HEADER_HEIGHT }}
      >
        <h2 className="text-md font-semibold text-gray-800 truncate">{title}</h2>
        <div className="flex items-center"> {/* Flex container para o botão de ciclo e o botão de fechar */}
          {headerContent && <div className="ml-auto">{headerContent}</div>} {/* Renderiza o conteúdo customizado */}
          {toggleVisualizationButton} {/* Renderiza o botão de alternar visualização */}
          {onClose && (
            <button
              onClick={onClose}
              className="ml-2 text-gray-500 hover:text-gray-700 focus:outline-none"
              aria-label="Fechar card"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Visualization Area */}
      <div
        className="flex-1 flex items-center justify-center relative overflow-hidden"
        style={{ height: visualizationHeight }} // Altura dinâmica para a visualização
      >
        {isLoading ? (
          <div className="text-center text-gray-500 p-4">
            <p className="text-sm">A carregar...</p>
          </div>
        ) : (
          <Suspense fallback={<div className="text-center text-gray-500 p-4">A carregar visualização...</div>}>
            {/* Renderiza o componente de visualização ativo e passa as props */}
            {ActiveVisualization && <ActiveVisualization {...newVisualizationProps} />}
          </Suspense>
        )}
      </div>

      {/* Details/Values Area */}
      <div
        className="p-2 border-t border-gray-200 flex items-center justify-center bg-gray-50"
        style={{ height: DETAILS_HEIGHT }} // Altura fixa para os detalhes
      >
        {detailsContent ? (
          detailsContent
        ) : (
          <p className="text-xs text-gray-500">Sem detalhes disponíveis.</p>
        )}
      </div>
    </div>
  );
};

export default CardWrapper;
