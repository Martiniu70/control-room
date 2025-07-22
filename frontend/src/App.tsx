// App.tsx
import React, { useState, useEffect, useRef, useMemo } from "react";
import Sidebar from "./components/Sidebar";
import MainGrid from "./components/MainGrid";
import Header from "./components/Header";
import SignalModal from "./components/SignalModal";
import { useWebSocket } from "./hooks/useWebSocket";
import { useSignalControl } from "./hooks/useSignalControl";

// Importar a nova configuração de cards
import { CardConfig, getCardConfigBySignalName } from "./config/cardConfig";

import { Layout } from "react-grid-layout";

interface DataPoint {
  x: number;
  value: number;
}

interface EcgBatch{
  timeSeconds: number;
  values: number[];
}

interface AccProcessedData{
  x: number;
  y: number;
  z: number;
  timestamp: number;
}

interface GyroProcessedData {
  x: number[];
  y: number[];
  z: number[];
  timestamp: number;
}

interface EegRawProcessedData {
  [channel: string]: DataPoint[];
}

// ATUALIZADO: Interface para os dados processados de Face Landmarks com a nova estrutura
interface FaceLandmarksProcessedData {
  landmarks: number[][];
  gaze_vector: { dx: number; dy: number };
  ear: number;
  blink_rate: number;
  blink_counter: number;
  frame_b64: string; // 'confidence' removido
  timestamp: number; // Timestamp do SignalPoint
}


// ATUALIZADO: A interface CardType agora usa propriedades da CardConfig
interface CardType {
  id: string;
  label: string;
  colSpan: number;
  rowSpan: number;
  signalType: CardConfig['signalType']; // Usa o tipo de signalType da CardConfig
  // REMOVIDO: componentType, pois não é mais necessário aqui
  signalName: string;
  component: string;
  unit?: string; // Opcional, pode vir da config
  color?: string; // Opcional, pode vir da config
}

interface Tab {
  id: number;
  label: string;
}

function App() {
  const {
    latestCardiacData,
    latestEegData,
    latestCameraData, // Usar para faceLandmarks
    latestUnityData,
    latestSensorData,
    connectionStatus,
    recentAnomalies,
    connect,
    disconnect
  } = useWebSocket();

  const {
    availableSignals,
    activeSignals,
    loading: signalsLoading,
    fetchSignalStatus,
    loadSignals,
    enableAllSignals,
    enableSignal,
    disableSignal
  } = useSignalControl();

  const [modalOpen, setModalOpen] = useState(false);
  const startTimeRef = useRef<number>(Date.now());
  const [heartRateData, setHeartRateData] = useState<DataPoint[]>([]);
  const [ecgDataBatches, setEcgDataBatches] = useState<EcgBatch[]>([]);
  const [throttledEcgData, setThrottledEcgData] = useState<DataPoint[]>([]);
  const [latestAccelerometerData, setLatestAccelerometerData] = useState<AccProcessedData | null>(null);
  const [latestGyroscopeData, setLatestGyroscopeData] = useState<GyroProcessedData | null>(null);
  const [eegRawData, setEegRawData] = useState<EegRawProcessedData>({});
  const [faceLandmarksData, setFaceLandmarksData] = useState<FaceLandmarksProcessedData | null>(null); // NOVO ESTADO

  const lastEcgUpdateTimeRef = useRef(0);
  const ECG_THROTTLE_INTERVAL_MS = 1;
  const ECG_SAMPLE_RATE = 1000;
  const ECG_WINDOW_DURATION_SECONDS = 5;
  const ECG_DOWNSAMPLING_FACTOR = 10;

  const EEG_SAMPLE_RATE = 250;
  const EEG_WINDOW_DURATION_SECONDS = 5;
  const EEG_DOWNSAMPLING_FACTOR = 1;

  const [tabs, setTabs] = useState<Tab[]>([{ id: 1, label: "Tab 1" }]);
  const [currentTabId, setCurrentTabId] = useState<number>(1);
  const [nextTabId, setNextTabId] = useState<number>(2);
  const [layoutsPerTab, setLayoutsPerTab] = useState<Record<number, Layout[]>>({ 1: [] });
  const [cardsPerTab, setCardsPerTab] = useState<Record<number, CardType[]>>({ 1: [] });
  const [cardIdCounter, setCardIdCounter] = useState<number>(1);

  // Atualizar dados de frequência cardíaca
  useEffect(() => {
    if (latestCardiacData?.hr) {
      const currentTimeSeconds = (Date.now() - startTimeRef.current) / 1000;
      const newDataPoint: DataPoint = {
        x: currentTimeSeconds,
        value: latestCardiacData.hr.value
      };
      setHeartRateData(prev => [...prev, newDataPoint].slice(-200));
    }
  }, [latestCardiacData?.hr]);

  // Efeito para acumular batches de ECG brutos
  useEffect(() => {
    if(latestCardiacData?.ecg && Array.isArray(latestCardiacData.ecg.value)){
      const currentTimeSeconds = (Date.now() - startTimeRef.current) / 1000;
      const newEcgBatch: EcgBatch = {
        timeSeconds : currentTimeSeconds,
        values: latestCardiacData.ecg.value
      };
      const maxBatchesToKeep = 100;
      setEcgDataBatches(prev => [...prev, newEcgBatch].slice(-maxBatchesToKeep));
    }
  }, [latestCardiacData?.ecg]);

  useEffect(() => {
    const flattenEcgBatches = (batches: EcgBatch[]): DataPoint[] => {
      const allPoints: DataPoint[] = [];
      const sampleDuration = 1 / ECG_SAMPLE_RATE;

      batches.forEach(batch => {
        batch.values.forEach((val, index) => {
          const pointTime = batch.timeSeconds + (index * sampleDuration);
          allPoints.push({x: pointTime, value: val});
        });
      });

      const downsampledPoints: DataPoint[] = [];
      for (let i = 0; i < allPoints.length; i++){
        if(i % ECG_DOWNSAMPLING_FACTOR === 0){
          downsampledPoints.push(allPoints[i]);
        }
      }

      return downsampledPoints.slice(-1000);
    };

    const now = Date.now();
    if (now - lastEcgUpdateTimeRef.current > ECG_THROTTLE_INTERVAL_MS) {
      const newEcgPoints = flattenEcgBatches(ecgDataBatches);
      setThrottledEcgData(newEcgPoints);
      lastEcgUpdateTimeRef.current = now;
    }
  }, [ecgDataBatches, ECG_THROTTLE_INTERVAL_MS, ECG_SAMPLE_RATE, ECG_WINDOW_DURATION_SECONDS, ECG_DOWNSAMPLING_FACTOR]);

  // Efeito para processar e aplicar throttling aos dados do acelerômetro
  useEffect(() => {
    if(latestSensorData?.accelerometer?.value){
      const acc = latestSensorData.accelerometer.value.accelerometer;
      const lastX = acc.x[acc.x.length - 1];
      const lastY = acc.y[acc.y.length - 1];
      const lastZ = acc.z[acc.z.length - 1];

      if(lastX !== undefined && lastY !== undefined && lastZ !== undefined){
        setLatestAccelerometerData({
          x: lastX,
          y: lastY,
          z: lastZ,
          timestamp: latestSensorData.accelerometer.timestamp
        });
      }
    }
  }, [latestSensorData?.accelerometer]);

  // Efeito para processar os dados do giroscópio
  useEffect(() => {
    if(latestSensorData?.gyroscope?.value){
      const gyro = latestSensorData.gyroscope.value.gyroscope;
      setLatestGyroscopeData({
        x: gyro.x,
        y: gyro.y,
        z: gyro.z,
        timestamp: latestSensorData.gyroscope.timestamp
      });
    }
  }, [latestSensorData?.gyroscope]);


  // Efeito para processar os dados brutos do EEG
  useEffect(() => {
    if (latestEegData?.raw && typeof latestEegData.raw.value === 'object') {
      const currentTimeSeconds = (Date.now() - startTimeRef.current) / 1000;
      const eegRawValue = latestEegData.raw.value as { [key: string]: number[] };
      const sampleDuration = 1 / EEG_SAMPLE_RATE;

      setEegRawData(prev => {
        const newEegRawData: EegRawProcessedData = { ...prev };

        Object.entries(eegRawValue).forEach(([channelName, values]) => {
          if (Array.isArray(values)) {
            const currentChannelData = newEegRawData[channelName] || [];

            const newPointsForChannel: DataPoint[] = values.map((val, index) => ({
              x: currentTimeSeconds + (index * sampleDuration),
              value: val
            }));

            const combinedData = [...currentChannelData, ...newPointsForChannel];
            const minTimeForWindow = currentTimeSeconds - EEG_WINDOW_DURATION_SECONDS;

            // Filtra os dados para manter apenas os pontos dentro da janela de tempo
            const filteredData = combinedData.filter(point => point.x >= minTimeForWindow);

            // Garante que o array não exceda um tamanho máximo para evitar estouro de memória
            const maxPointsPerChannel = EEG_SAMPLE_RATE * EEG_WINDOW_DURATION_SECONDS * 1.2; // 20% a mais para buffer
            newEegRawData[channelName] = filteredData.slice(-maxPointsPerChannel);
          }
        });
        // console.log("App.tsx - eegRawData atualizado:", newEegRawData); // Log para depuração
        return newEegRawData;
      });
    }
  }, [latestEegData?.raw, EEG_SAMPLE_RATE, EEG_WINDOW_DURATION_SECONDS]);

  // ATUALIZADO: Efeito para processar dados de Face Landmarks com a nova estrutura
  useEffect(() => {
    if (latestCameraData?.faceLandmarks?.value) {
      const landmarksValue = latestCameraData.faceLandmarks.value;
      // console.log("App.tsx - landmarksValue recebido:", landmarksValue); // Manter para depuração se necessário

      setFaceLandmarksData({
        landmarks: landmarksValue.landmarks,
        gaze_vector: landmarksValue.gaze_vector,
        ear: landmarksValue.ear,
        blink_rate: landmarksValue.blink_rate,
        blink_counter: landmarksValue.blink_counter,
        // 'confidence' removido
        frame_b64: landmarksValue.frame_b64,
        // As propriedades abaixo foram removidas da estrutura de dados do backend:
        // attentionPattern: landmarksValue.attentionPattern,
        // isBlinking: landmarksValue.isBlinking,
        // frameNumber: landmarksValue.frameNumber,
        // frameTimestamp: landmarksValue.frameTimestamp,
        // anomalyType: landmarksValue.anomalyType,
        timestamp: latestCameraData.faceLandmarks.timestamp,
      });
    }
  }, [latestCameraData?.faceLandmarks]);


  // Funções de manipulação de UI
  const updateLayout = (newLayout: Layout[]) => {
    setLayoutsPerTab((prev) => ({
      ...prev,
      [currentTabId]: newLayout,
    }));
  };

  const addTab = () => {
    const newTab = {
      id: nextTabId,
      label: `Tab ${nextTabId}`,
    };
    setTabs((prev) => [...prev, newTab]);
    setCurrentTabId(newTab.id);
    setNextTabId((prev) => prev + 1);
    setCardsPerTab((prev) => ({ ...prev, [newTab.id]: [] }));
  };

  const closeTab = (idToRemove: number) => {
    if (tabs.length === 1) return;
    setTabs((prevTabs) => {
      const index = prevTabs.findIndex((t) => t.id === idToRemove);
      const newTabs = prevTabs.filter((t) => t.id !== idToRemove);
      if (currentTabId === idToRemove) {
        const newIndex = index > 0 ? index - 1 : 0;
        setCurrentTabId(newTabs[newIndex].id);
      }
      return newTabs;
    });
    setCardsPerTab((prev) => {
      const updated = { ...prev };
      delete updated[idToRemove];
      return updated;
    });
  };

  /**
   * @function addCard
   * @param {string} component - O componente backend associado (ex: 'websocket').
   * @param {string} signalName - O nome do sinal específico (ex: 'hr_data', 'ecg_signal').
   * @description Adiciona um novo card ao dashboard com base no sinal selecionado.
   * Utiliza a configuração centralizada para determinar as propriedades do card.
   */
  const addCard = (component: string, signalName: string) => {
    // Obtém a configuração do card com base no nome do sinal
    const cardConfig = getCardConfigBySignalName(signalName);

    if (!cardConfig) {
      console.warn(`No card configuration found for signal: ${signalName}`);
      // Opcional: mostrar uma mensagem de erro para o usuário
      return;
    }

    // Cria o novo card usando as propriedades da configuração
    const newCard: CardType = {
      id: `${currentTabId}-${cardIdCounter}`,
      label: `${cardConfig.label} (${signalName})`, // Combina o rótulo da config com o nome do sinal
      colSpan: cardConfig.defaultColSpan,
      rowSpan: cardConfig.defaultRowSpan,
      signalType: cardConfig.signalType,
      // REMOVIDO: componentType: cardConfig.componentType, // Define o tipo de componente aqui
      signalName: signalName,
      component: component,
      unit: cardConfig.unit, // Adiciona a unidade se disponível na config
      color: cardConfig.color, // Adiciona a cor se disponível na config
    };

    setCardsPerTab((prev) => ({
      ...prev,
      [currentTabId]: [...(prev[currentTabId] || []), newCard],
    }));
    setCardIdCounter((prev) => prev + 1);

    // Verifique se o sinal já está ativo antes de tentar habilitá-lo
    const isSignalAlreadyActive = activeSignals[component]?.includes(signalName);
    if (!isSignalAlreadyActive) {
      enableSignal(component, signalName);
    }
  };

  const handleAddCardClick = () => {
    loadSignals();
    setModalOpen(true);
  };

  const handleSignalSelect = (component: string, signalName: string) => {
    addCard(component, signalName)
    setModalOpen(false);
  };

  const currentCards = useMemo(() => cardsPerTab[currentTabId] || [], [cardsPerTab, currentTabId]);

  return (
    <div className="flex flex-col h-full">
      <div className={`px-4 py-2 text-sm text-white ${
        connectionStatus.connected ? 'bg-green-600' :
        connectionStatus.reconnecting ? 'bg-yellow-600' : 'bg-red-600'
      }`}>
        <div className="flex justify-between items-center">
          <span>
            {connectionStatus.connected ? '🟢 Conectado ao Backend da Sala de Controlo' :
             connectionStatus.reconnecting ? '🟡 A reconectar...' :
             '🔴 Desconectado do Backend'}
          </span>
          <div className="flex gap-2">
            {recentAnomalies.length > 0 && (
              <span className="bg-red-500 px-2 py-1 rounded text-xs">
                ⚠️ {recentAnomalies.length} Anomalias
              </span>
            )}
            <button
              onClick={connectionStatus.connected ? disconnect : connect}
              className="bg-white/20 hover:bg-white/30 px-2 py-1 rounded text-xs transition"
            >
              {connectionStatus.connected ? 'Desconectar' : 'Reconectar'}
            </button>
          </div>
        </div>
        {connectionStatus.error && (
          <div className="text-xs mt-1 opacity-90">
            Erro: {connectionStatus.error}
          </div>
        )}
      </div>

      <Header onAddCard={handleAddCardClick} />

      <div className="flex flex-1">
        <Sidebar
          tabs={tabs}
          currentTabId={currentTabId}
          onTabClick={setCurrentTabId}
          onAddTab={addTab}
          onCloseTab={closeTab}
        />
        <main className="flex-1 bg-gray-100 p-4 overflow-hidden">
          <MainGrid
            activeSignals={currentCards}
            onLayoutChange={updateLayout}
            hrData={heartRateData}
            ecgData={throttledEcgData}
            accelerometerData={latestAccelerometerData}
            gyroscopeData={latestGyroscopeData}
            eegRawData={eegRawData}
            faceLandmarksData={faceLandmarksData} // NOVO: Passa os dados de face landmarks
            onDisableSignal={(cardId) => {
              const card = currentCards.find(c => c.id === cardId);
              if (card) {
                disableSignal(card.component, card.signalName);
              }
            }}
          />
        </main>
      </div>

      <SignalModal
        open={modalOpen}
        availableSignals={availableSignals}
        loading={signalsLoading}
        onClose={() => setModalOpen(false)}
        onSelect={handleSignalSelect}
      />

      {process.env.NODE_ENV === 'development' && (
        <div className="bg-gray-800 text-white p-2 text-xs">
          <div className="flex gap-4">
            <span>Pontos HR: {heartRateData.length}</span>
            <span>Último HR: {heartRateData[heartRateData.length - 1]?.value ?? 'N/A'} bpm</span>
            <span>Batches ECG (Bruto): {ecgDataBatches.length}</span>
            <span>Pontos ECG (Throttled): {throttledEcgData.length}</span>
            <span>Pontos EEG Raw (ch0): {eegRawData['ch0']?.length ?? 0}</span>
            <span>Tempo de Execução: {((Date.now() - startTimeRef.current) / 1000).toFixed(1)}s</span>
            <span>Conectado: {connectionStatus.connected ? 'Sim' : 'Não'}</span>
            <span>Anomalias: {recentAnomalies.length}</span>
            <span>Sinais a Carregar: {signalsLoading ? 'Sim' : 'Não'}</span>
            {/* ATUALIZADO: Removido frameNumber do log de desenvolvimento */}
            <span>FaceLandmarks: {faceLandmarksData ? 'Recebido' : 'N/A'}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
