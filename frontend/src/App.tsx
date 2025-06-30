import React, { useState, useEffect, useRef } from "react";
import Sidebar from "./components/Sidebar";
import MainGrid from "./components/MainGrid";
import Header from "./components/Header";
import SignalModal from "./components/SignalModal";
import { useWebSocket } from "./hooks/useWebSocket";
import { Layout } from "react-grid-layout";

interface SignalPoint {
  timestamp: number;
  value: any;
  quality: number;
  metadata: Record<string, any>;
}

interface DataPoint {
  timeSeconds: number;  // Tempo real em segundos desde início
  hr?: number;         // Heart Rate
  ecg?: number;        // TODO
  eeg?: number;        // TODO
}

interface CardType {
  id: string;
  label: string;
  colSpan: number;
  rowSpan: number;
  signalType: 'hr' | 'ecg' | 'eeg' | 'steering' | 'speed';
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
    availableSignals,
    connect,
    disconnect
  } = useWebSocket();

  // Estado para mostrar/ocultar modal
  const [modalOpen, setModalOpen] = useState(false);

  // Referência para tempo inicial
  const startTimeRef = useRef<number>(Date.now());
  
  const [heartRateData, setHeartRateData] = useState<DataPoint[]>([]);

  const [tabs, setTabs] = useState<Tab[]>([{ id: 1, label: "Tab 1" }]);
  const [currentTabId, setCurrentTabId] = useState<number>(1);
  const [nextTabId, setNextTabId] = useState<number>(2);
  const [layoutsPerTab, setLayoutsPerTab] = useState<Record<number, Layout[]>>({ 1: [] });
  const [cardsPerTab, setCardsPerTab] = useState<Record<number, CardType[]>>({ 1: [] });
  const [cardIdCounter, setCardIdCounter] = useState<number>(1);

  useEffect(() => {
    if (latestCardiacData?.hr) {
      const currentTimeSeconds = (Date.now() - startTimeRef.current) / 1000;
      const newDataPoint: DataPoint = {
        timeSeconds: currentTimeSeconds,
        hr: latestCardiacData.hr.value
      };
      setHeartRateData(prev => [...prev, newDataPoint].slice(-200));
      console.log(`HR received: ${latestCardiacData.hr.value} bpm at ${currentTimeSeconds.toFixed(1)}s`);
    }
  }, [latestCardiacData?.hr]);

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

  const addCard = (signalType : CardType["signalType"]) => {
    const labelMap: Record<CardType["signalType"], string> = {
      hr: "Heart Rate",
      ecg: "ECG",
      eeg: "EEG",
      steering: "Steering",
      speed: "Speed"
    };

    const newCard: CardType = {
      id: `${currentTabId}-${cardIdCounter}`,
      label: labelMap[signalType] || signalType,
      colSpan: 1,
      rowSpan: 1,
      signalType,
    };
    
    setCardsPerTab((prev) => ({
      ...prev,
      [currentTabId]: [...(prev[currentTabId] || []), newCard],
    }));
    setCardIdCounter((prev) => prev + 1);
  };

  const currentCards = cardsPerTab[currentTabId] || [];

  // Ao clicar no botão Add Card no Header, abrir modal
  const handleAddCardClick = () => {
    setModalOpen(true);
  };

  // Quando o utilizador clicar num sinal dentro do modal
  const handleSignalSelect = (signalName: string) => {
    console.log("Selected signal:", signalName);

    if(signalName === "cardiac"){
      addCard("hr");
    }

    // Por enquanto só log
    setModalOpen(false);  // Fecha modal
  };

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

      {/* Passar a função que abre modal para o Header */}
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
          />
        </main>
      </div>

      {/* Modal para seleção de sinais */}
      <SignalModal 
        open={modalOpen}
        signals={availableSignals}
        onClose={() => setModalOpen(false)}
        onSelect={handleSignalSelect}/>

      {/* DEBUG PANEL */}
      {process.env.NODE_ENV === 'development' && (
        <div className="bg-gray-800 text-white p-2 text-xs">
          <div className="flex gap-4">
            <span>HR Points: {heartRateData.length}</span>
            <span>Latest HR: {heartRateData[heartRateData.length - 1]?.hr ?? 'N/A'} bpm</span>
            <span>Time Running: {((Date.now() - startTimeRef.current) / 1000).toFixed(1)}s</span>
            <span>Connected: {connectionStatus.connected ? 'Yes' : 'No'}</span>
            <span>Anomalies: {recentAnomalies.length}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
