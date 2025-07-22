// components/EegRawCard.tsx
import React, { useState, useCallback } from "react";
import CardWrapper from '../CardWrapper';
import { cardConfigs } from '../../../config/cardConfig';

/**
 * @file EegRawCard.tsx
 * @description Wrapper component for displaying Raw EEG data.
 * This component handles the selection of individual EEG channels for visualization
 * and passes the appropriate data and configuration to `CardWrapper`.
 */

/**
 * Interface for a single EEG channel data point.
 */
interface EegChannelPoint {
  x: number;     // Time in seconds.
  value: number; // Signal value.
}

/**
 * Interface defining the props for the EegRawCard component.
 * NOVO: Adicionadas activeVisualizationIndex e onVisualizationChange.
 */
interface EegRawCardProps {
    title: string;                               // Title of the card.
    data: { [key: string]: EegChannelPoint[] };  // Raw EEG data, organized by channel key.
    width?: number;                              // Optional width of the card.
    height?: number;                             // Optional height of the card.
    unit?: string;                               // Optional unit for EEG data (defaults to µV).
    onClose?: () => void;                        // Callback function to close the card.
    activeVisualizationIndex?: number; // NOVO: Índice da visualização ativa.
    onVisualizationChange?: (newIndex: number) => void; // NOVO: Callback para mudança de visualização.
}

/**
 * EegRawCard functional component.
 * Renders a raw EEG data card, allowing users to cycle through individual channels
 * or view all channels simultaneously.
 * @param {EegRawCardProps} props - The properties passed to the component.
 * @returns {JSX.Element} The raw EEG card JSX.
 */
const EegRawCard: React.FC<EegRawCardProps> = ({
    title,
    data,
    width,
    height,
    unit = "µV", // Default unit for EEG.
    onClose,
    activeVisualizationIndex, // NOVO: Desestruturado da props
    onVisualizationChange,    // NOVO: Desestruturado da props
}) => {
    // Get all available channel keys from the data.
    const channelKeys = Object.keys(data);

    /**
     * State for the selected channel index.
     * 0: "All Channels" view.
     * 1 to N: Specific channel (channelKeys[index - 1]).
     */
    const [selectedChannelIndex, setSelectedChannelIndex] = useState(0); // Starts with "All Channels".

    /**
     * Determines the key of the currently selected channel to pass to the content component.
     * If `selectedChannelIndex` is 0, `selectedChannelKey` will be `undefined`,
     * which signals `EegRawCardContent` to display all channels.
     */
    const selectedChannelKey = selectedChannelIndex === 0
        ? undefined
        : channelKeys[selectedChannelIndex - 1]; // Adjust index to get the correct channel.

    // Check if there is data available for any channel.
    const hasData = channelKeys.some(key => data[key] && data[key].length > 0);

    /**
     * Calculates the last value for the selected channel (or the first channel if "All" is selected).
     * Used for display in the details content.
     */
    const currentChannelData = selectedChannelKey
        ? data[selectedChannelKey]
        : (channelKeys.length > 0 ? data[channelKeys[0]] : []); // If "All", use the first channel as an example.
    const currentValue = currentChannelData.length > 0
        ? currentChannelData[currentChannelData.length - 1].value
        : undefined;

    /**
     * Function to cycle to the next channel or to the "All Channels" view.
     */
    const cycleChannels = useCallback(() => {
        if (channelKeys.length > 0) {
            // The next index includes the "All Channels" option (index 0).
            setSelectedChannelIndex((prevIndex) => (prevIndex + 1) % (channelKeys.length + 1));
        }
    }, [channelKeys]);

    /**
     * Text for the channel cycle button, indicating the current view.
     */
    const cycleButtonText = selectedChannelIndex === 0
        ? "Visualização: Todos os Canais"
        : `Visualização: ${selectedChannelKey}`;

    /**
     * Content for the details area of the card.
     * Displays the current value for the selected/example channel and the number of active channels.
     */
    const detailsContent = (
      <div className="flex flex-col items-center justify-center w-full text-sm text-gray-700">
          <span style={{ color: cardConfigs['eegRaw'].color }}>
              {selectedChannelKey ? `Atual (${selectedChannelKey}):` : `Último Valor (Canal 0):`} {currentValue !== undefined ? `${currentValue.toFixed(2)} ${unit}` : "N/A"}
          </span>
          <span className="text-gray-500">
              Canais Ativos: {channelKeys.length}
          </span>
      </div>
    );

    /**
     * Button for cycling through channels, displayed in the header.
     */
    const cycleChannelsButton = (
        <button
            onClick={cycleChannels}
            className="no-drag bg-blue-500 text-white text-xs font-medium px-3 py-1 rounded-full hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-colors duration-200"
            aria-label="Alternar visualização de canais"
            disabled={channelKeys.length === 0}
        >
            {cycleButtonText}
        </button>
    );

    /**
     * Custom header content for the CardWrapper, containing the channel cycle button.
     */
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
            isLoading={!hasData}
            noDataMessage="A aguardar dados EEG brutos..."
            detailsContent={detailsContent}
            onClose={onClose}
            headerContent={customHeaderContent}

            visualizations={cardConfigs['eegRaw'].visualizations}
            cardData={data}
            // Pass selectedChannelKey (which can be undefined for "all channels") to the visualization.
            visualizationProps={{ unit, selectedChannelKey }}
            activeVisualizationIndex={activeVisualizationIndex} // NOVO: Passa o índice ativo
            onVisualizationChange={onVisualizationChange}       // NOVO: Passa o callback de mudança
        >
        </CardWrapper>
    );
};

export default EegRawCard;
