// components/EegRawCard.tsx
import React, { useState, useCallback } from "react";
// Removidas as importações de visx, pois EegRawCardContent as terá
// import { scaleLinear } from "@visx/scale";
// import { Group } from "@visx/group";
// import { LinePath } from "@visx/shape";
// import { AxisLeft, AxisBottom } from "@visx/axis";
// import { curveMonotoneX } from "@visx/curve";
import CardWrapper from '../CardWrapper'; // Importar o CardWrapper
// EegBrainMapContent e EegRawCardContent serão passados via cardConfig.ts
// import EegBrainMapContent from './EegBrainMapContent';
import { cardConfigs } from '../../../config/cardConfig'; // CORRIGIDO: Caminho de importação para cardConfigs

// Interface para um ponto de dados de um canal EEG
interface EegChannelPoint {
  x: number; // Tempo em segundos
  value: number; // Valor do sinal
}

// Removido EegRawContentProps e EegRawCardContent daqui, pois serão definidos em seus próprios arquivos
// e o CardWrapper os renderizará diretamente.

// Componente Wrapper para uso externo
interface EegRawCardProps {
    title: string;
    data: { [key: string]: EegChannelPoint[] };
    width?: number;
    height?: number;
    unit?: string;
    onClose?: () => void; // Adicionado para passar para o CardWrapper
}

const EegRawCard: React.FC<EegRawCardProps> = ({
    title,
    data,
    width,
    height,
    unit = "µV",
    onClose,
}) => {
    // A condição hasData permanece a mesma, pois ela verifica a existência de dados
    const hasData = Object.keys(data).some(channel => data[channel].length > 0);

    // Obter as chaves dos canais disponíveis
    const channelKeys = Object.keys(data).sort(); // Ordenar para garantir uma ordem consistente

    // Estado para controlar o índice do canal a ser exibido
    // 0: todos os canais
    // 1: primeiro canal em channelKeys
    // 2: segundo canal, e assim por diante
    const [currentChannelIndex, setCurrentChannelIndex] = useState(0);

    // Função para ciclar entre os canais
    const handleCycleChannels = useCallback(() => {
        setCurrentChannelIndex(prevIndex => {
            // Se prevIndex for 0 (todos os canais), o próximo é o primeiro canal individual
            // Caso contrário, avança para o próximo canal individual
            // Se for o último canal individual, volta para 0 (todos os canais)
            const nextIndex = (prevIndex + 1) % (channelKeys.length + 1);
            return nextIndex;
        });
    }, [channelKeys.length]); // Depende do número de canais

    // Determinar o canal atualmente selecionado para passar aos componentes de visualização
    const selectedChannelKey = currentChannelIndex === 0
        ? undefined // Undefined significa "mostrar todos"
        : channelKeys[currentChannelIndex - 1]; // -1 porque o índice 0 é "todos"

    // Lógica para determinar o texto do botão de ciclo de canais
    let cycleButtonText: string;
    if (channelKeys.length === 0) {
        cycleButtonText = "Sem Canais"; // Caso não haja canais disponíveis
    } else if (currentChannelIndex === 0) {
        cycleButtonText = `Ver ${channelKeys[0]}`; // Mostra o primeiro canal ao clicar
    } else if (currentChannelIndex === channelKeys.length) {
        cycleButtonText = "Ver Todos"; // Último canal individual, próximo clique volta para todos
    } else {
        cycleButtonText = `Ver ${channelKeys[currentChannelIndex]}`; // Próximo canal individual
    }


    // Conteúdo para a nova área de detalhes (AGORA GERENCIADO AQUI)
    const detailsContent = (
        <div className="flex flex-col items-center justify-center w-full text-sm text-gray-700">
            <p>Canais: {Object.keys(data).length}</p>
            <p>Unidade: {unit}</p>
            <p className="font-semibold">
                Visualização: {selectedChannelKey ? `Canal ${selectedChannelKey}` : "Todos os Canais"}
            </p>
        </div>
    );

    // Botão para ciclar a visualização de canais (AGORA GERENCIADO AQUI)
    const cycleChannelsButton = (
        <button
            onClick={handleCycleChannels}
            className="ml-2 px-3 py-1 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-colors duration-200"
            aria-label="Alternar visualização de canais"
            disabled={channelKeys.length === 0}
        >
            {cycleButtonText}
        </button>
    );

    // Conteúdo do cabeçalho customizado (apenas o botão de ciclo de canais)
    const customHeaderContent = (
      <>
        {cycleChannelsButton}
      </>
    );

    return (
        <CardWrapper
            title={title}
            width={width}
            height={height}
            isLoading={!hasData} // Isso ainda é a lógica correta para mostrar o estado de carregamento
            noDataMessage="A aguardar dados EEG brutos..."
            detailsContent={detailsContent} // Passa o conteúdo dos detalhes
            onClose={onClose} // Passa a função de fechar
            headerContent={customHeaderContent} // Passa o botão de ciclo para o cabeçalho

            // NOVO: Passa o array de visualizações e os dados brutos
            visualizations={cardConfigs['eegRaw'].visualizations}
            cardData={data}
            // NOVO: Passa props específicas para as visualizações
            visualizationProps={{ unit, selectedChannelKey }}
        >
            {/* O CardWrapper agora renderiza o componente de visualização ativo. */}
            {/* Não há children direto aqui. */}
        </CardWrapper>
    );
};

export default EegRawCard;
