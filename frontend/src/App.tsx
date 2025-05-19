import React, { useState, useEffect, useRef } from "react";
import Sidebar from "./Sidebar";
import MainGrid from "./MainGrid";
import Header from "./Header";
import { useWebSocket } from "./hooks/useWebSocket";

interface SignalPoint {
  timestamp: number;
  value: number;
}

interface SimulatorData {
  ecg: SignalPoint | null;
  eeg: SignalPoint | null;
  ppg: SignalPoint | null;
}

interface DataPoint {
  x: number;
  ecg?: number;
  eeg?: number;
  ppg?: number;
}

interface CardType {
  id: string;
  label: string;
  colSpan: number;
  rowSpan: number;
}


function App() {
  const { data } = useWebSocket<SimulatorData>("ws://localhost:8000/ws/simulator/latest");
  const [series, setSeries] = useState<DataPoint[]>([]);
  const elapsedSeconds = useRef<number>(0);

  useEffect(() => {
    if (!data) return;
    const newPoint: DataPoint = {
      x: elapsedSeconds.current,
      ecg: data.ecg?.value,
      eeg: data.eeg?.value,
      ppg: data.ppg?.value,
    };
    elapsedSeconds.current += 1;
    setSeries((prev) => [...prev, newPoint].slice(-100));
  }, [data]);

  const [tabs, setTabs] = useState<{ id: number; label: string }[]>([{ id: 1, label: "Tab 1" }]);
  const [currentTabId, setCurrentTabId] = useState<number>(1);
  const [nextTabId, setNextTabId] = useState<number>(2);
  const [layoutsPerTab, setLayoutsPerTab] = useState<Record<number, any[]>>({ 1: [] });
  const [cardsPerTab, setCardsPerTab] = useState<Record<number, CardType[]>>({ 1: [] });
  const [cardIdCounter, setCardIdCounter] = useState<number>(1);

  const updateLayout = (newLayout: any[]) => {
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

  const addCard = () => {
    const newCard: CardType = {
      id: `${currentTabId}-${cardIdCounter}`,
      label: `Card ${cardIdCounter}`,
      colSpan: 1,
      rowSpan: 1,
    };
    setCardsPerTab((prev) => ({
      ...prev,
      [currentTabId]: [...(prev[currentTabId] || []), newCard],
    }));
    setCardIdCounter((prev) => prev + 1);
  };

  const currentCards = cardsPerTab[currentTabId] || [];

  return (
    <div className="flex flex-col h-full">
      <Header onAddCard={addCard} />
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
            series={series}
          />
        </main>
      </div>
    </div>
  );
}

export default App;
