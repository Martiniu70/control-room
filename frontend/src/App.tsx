// App.tsx
import React, { useState, useEffect, useRef } from "react";
import Sidebar from "./components/Sidebar";
import MainGrid from "./components/MainGrid";
import Header from "./components/Header";
import SignalModal from "./components/SignalModal";
import { useWebSocket } from "./hooks/useWebSocket";
import { useSignalControl } from "./hooks/useSignalControl";

import { Layout } from "react-grid-layout";

interface SignalPoint {
  timestamp: number;
  value: any;
  quality: number;
  metadata: Record<string, any>;
}

interface DataPoint {
  x: number;
  value: number;
}

interface EcgBatch{
  timeSeconds: number;
  values: number[];
}

interface CardType {
  id: string;
  label: string;
  colSpan: number;
  rowSpan: number;
  signalType: 'hr' | 'ecg' | 'eeg' | "gyroscope" | "accelerometer" | 'steering' | 'speed';
  component: string;
  signalName: string;
}

interface Tab {
  id: number;
  label: string;
}

function App() {
  // WebSocket connection to backend
  const { 
    latestCardiacData,
    latestEegData, 
    latestUnityData, 
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

  // Estados do componente
  const [modalOpen, setModalOpen] = useState(false);
  const startTimeRef = useRef<number>(Date.now());
  const [heartRateData, setHeartRateData] = useState<DataPoint[]>([]);
  // Estado para armazenar os batches de ECG brutos recebidos
  const [ecgDataBatches, setEcgDataBatches] = useState<EcgBatch[]>([]);
  const [throttledEcgData, setThrottledEcgData] = useState<DataPoint[]>([]);

  // Refs para controlar o throttling do ECG
  const lastEcgUpdateTimeRef = useRef(0);
  const ECG_THROTTLE_INTERVAL_MS = 1;
  const ECG_SAMPLE_RATE = 1000;
  const ECG_WINDOW_DURATION_SECONDS = 5;
  
  const ECG_DOWNSAMPLING_FACTOR = 10;

  const [tabs, setTabs] = useState<Tab[]>([{ id: 1, label: "Tab 1" }]);
  const [currentTabId, setCurrentTabId] = useState<number>(1);
  const [nextTabId, setNextTabId] = useState<number>(2);
  const [layoutsPerTab, setLayoutsPerTab] = useState<Record<number, Layout[]>>({ 1: [] });
  const [cardsPerTab, setCardsPerTab] = useState<Record<number, CardType[]>>({ 1: [] });
  const [cardIdCounter, setCardIdCounter] = useState<number>(1);

  // Atualizar dados de frequencia cardiaca
  useEffect(() => {
    if (latestCardiacData?.hr) {
      const currentTimeSeconds = (Date.now() - startTimeRef.current) / 1000;
      const newDataPoint: DataPoint = {
        x: currentTimeSeconds,
        value: latestCardiacData.hr.value
      };
      setHeartRateData(prev => [...prev, newDataPoint].slice(-200)); // Manter histórico para HR
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
      // Manter um número suficiente de batches para a janela de visualização do ChartCard
      // Ex: se o ChartCard mostra 5s de ECG a 200Hz, e cada batch tem 20 amostras (0.1s),
      // precisamos de 50 batches. Manter 100 batches dá um bom buffer.
      const maxBatchesToKeep = 100; 
      setEcgDataBatches(prev => [...prev, newEcgBatch].slice(-maxBatchesToKeep));
    }
  }, [latestCardiacData?.ecg]);

  useEffect(() => {
    // Função para achatar os batches de ECG em uma array de pontos plotáveis
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

      const desiredDownsampledPointsInWindow = Math.ceil((ECG_WINDOW_DURATION_SECONDS * ECG_SAMPLE_RATE) / ECG_DOWNSAMPLING_FACTOR);


      return downsampledPoints.slice(-1000);
    };

    const now = Date.now();
    // Aplica o throttling: só atualiza se o tempo de intervalo tiver passado
    if (now - lastEcgUpdateTimeRef.current > ECG_THROTTLE_INTERVAL_MS) {
      const newEcgPoints = flattenEcgBatches(ecgDataBatches);
      setThrottledEcgData(newEcgPoints);
      lastEcgUpdateTimeRef.current = now;
    }
    // Se o tempo não passou, a atualização é ignorada até o próximo intervalo.
    // Isso evita re-renderizações excessivas do gráfico.

  }, [ecgDataBatches, ECG_THROTTLE_INTERVAL_MS]); // Depende dos batches brutos e do intervalo de throttling

  // Funcoes de manipulação de UI
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

  // Mapeamento de tipos de sinal para labels
  const labelMap: Record<CardType["signalType"], string> = {
    hr: "Heart Rate",
    ecg: "ECG",
    eeg: "EEG",
    gyroscope: "Gyro",
    accelerometer: "Acc",
    steering: "Steering",
    speed: "Speed"
  };

  const addCard = (component: string, signalName: string) => {
    let signalType: CardType["signalType"] = "hr";
    if (signalName.includes("ecg")) signalType = "ecg";
    else if (signalName.includes("eeg")) signalType = "eeg";
    else if (signalName.includes("accelerometer")) signalType = "accelerometer";
    else if (signalName.includes("gyroscope")) signalType = "gyroscope";
    else if (signalName.includes("steering")) signalType = "steering";
    else if (signalName.includes("speed")) signalType = "speed";

    const newCard: CardType = {
      id: `${currentTabId}-${cardIdCounter}`,
      label: `${labelMap[signalType]} (${signalName})`,
      colSpan: 1,
      rowSpan: 1,
      signalType,
      component,
      signalName
    };
    
    setCardsPerTab((prev) => ({
      ...prev,
      [currentTabId]: [...(prev[currentTabId] || []), newCard],
    }));
    setCardIdCounter((prev) => prev + 1);

    if(!activeSignals[component]?.includes(signalName)){
      enableSignal(component, signalName);
    }
  };

  // Ao clicar no botão Add Card no Header, abrir modal
  const handleAddCardClick = () => {
    loadSignals();
    setModalOpen(true);
  };

  // Quando o utilizador clicar num sinal dentro do modal
  const handleSignalSelect = (component: string, signalName: string) => {
    addCard(component, signalName)
    setModalOpen(false); 
  };
  
  const currentCards = cardsPerTab[currentTabId] || [];

  return (
    <div className="flex flex-col h-full">
      {/* Connection Status Bar */}
      <div className={`px-4 py-2 text-sm text-white ${
        connectionStatus.connected ? 'bg-green-600' : 
        connectionStatus.reconnecting ? 'bg-yellow-600' : 'bg-red-600'
      }`}>
        <div className="flex justify-between items-center">
          <span>
            {connectionStatus.connected ? '🟢 Connected to Control Room Backend' :
             connectionStatus.reconnecting ? '🟡 Reconnecting...' :
             '🔴 Disconnected from Backend'}
          </span>
          <div className="flex gap-2">
            {recentAnomalies.length > 0 && (
              <span className="bg-red-500 px-2 py-1 rounded text-xs">
                ⚠️ {recentAnomalies.length} Anomalies
              </span>
            )}
            <button 
              onClick={connectionStatus.connected ? disconnect : connect}
              className="bg-white/20 hover:bg-white/30 px-2 py-1 rounded text-xs transition"
            >
              {connectionStatus.connected ? 'Disconnect' : 'Reconnect'}
            </button>
          </div>
        </div>
        {connectionStatus.error && (
          <div className="text-xs mt-1 opacity-90">
            Error: {connectionStatus.error}
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
            items={currentCards}
            layout={layoutsPerTab[currentTabId] || []}
            onLayoutChange={updateLayout}
            heartRateData={heartRateData}
            // ✅ ATUALIZADO: Passando os dados de ECG throttled
            ecgData={throttledEcgData} 
            onDisableSignal={(cardId) => {
              const card = currentCards.find(c => c.id === cardId);
              if (card) {
                disableSignal(card.component, card.signalName);
              }
            }}
          />
        </main>
      </div>

      {/* Modal para seleção de sinais */}
      <SignalModal 
        open={modalOpen}
        availableSignals={availableSignals}
        loading={signalsLoading}
        onClose={() => setModalOpen(false)}
        onSelect={handleSignalSelect}
      />

      {/* DEBUG PANEL */}
      {process.env.NODE_ENV === 'development' && (
        <div className="bg-gray-800 text-white p-2 text-xs">
          <div className="flex gap-4">
            <span>HR Points: {heartRateData.length}</span>
            <span>Latest HR: {heartRateData[heartRateData.length - 1]?.value ?? 'N/A'} bpm</span>
            <span>ECG Batches (Raw): {ecgDataBatches.length}</span>
            <span>ECG Points (Throttled): {throttledEcgData.length}</span> {/* ✅ DEBUG para dados throttled */}
            <span>Time Running: {((Date.now() - startTimeRef.current) / 1000).toFixed(1)}s</span>
            <span>Connected: {connectionStatus.connected ? 'Yes' : 'No'}</span>
            <span>Anomalies: {recentAnomalies.length}</span>
            <span>Signals Loading: {signalsLoading ? 'Yes' : 'No'}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;