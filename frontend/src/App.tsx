// App.tsx
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Sidebar from "./components/Sidebar";
import MainGrid from "./components/MainGrid";
import Header from "./components/Header";
import SignalModal from "./components/SignalModal";
import { useWebSocket } from "./hooks/useWebSocket";
import { useSignalControl } from "./hooks/useSignalControl";

import { CardConfig, getCardConfigBySignalName } from "./config/cardConfig";

import { Layout } from "react-grid-layout";

/**
 * @file App.tsx
 * @description The main application component for the real-time sensor data dashboard.
 * It integrates WebSocket communication, signal control, and manages the layout
 * and display of various data visualization cards across multiple tabs.
 */

// Interfaces for various data types received from WebSocket or processed.
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

interface FaceLandmarksProcessedData {
  landmarks: number[][];
  gaze_vector: { dx: number; dy: number };
  ear: number;
  blink_rate: number;
  blink_counter: number;
  frame_b64: string;
  timestamp: number;
}

interface AlcoholLevelProcessedData {
  alcohol_level: number;
  timestamp: number;
}

interface CarInformationProcessedData {
  speed: number;
  lane_centrality: number;
  timestamp: number;
}


interface SignalPoint<T = any> {
  timestamp: number;
  value: T;
}

interface UnitySignalData {
  steering?: SignalPoint<any>;
  speed?: SignalPoint<any>;
  alcohol_level?: SignalPoint<{ alcohol_level: number }>;
  car_information?: SignalPoint<{ car_information: { speed: number; lane_centrality: number } }>;
}

/**
 * Defines the structure for a card displayed on the dashboard.
 */
interface CardType {
  id: string;
  label: string;
  colSpan: number;
  rowSpan: number;
  signalType: CardConfig['signalType'];
  signalName: string;
  component: string;
  unit?: string;
  color?: string;
  activeVisualizationIndex?: number; // NOVO: Índice da visualização ativa para persistência
}

/**
 * Defines the structure for a tab in the dashboard.
 */
interface Tab {
  id: number;
  label: string;
}

function App() {
  // Destructure values and functions from the useWebSocket hook for real-time data.
  const {
    latestCardiacData,
    latestEegData,
    latestCameraData,
    latestUnityData,
    latestSensorData,
    connectionStatus,
    recentAnomalies,
    connect,
    disconnect
  } = useWebSocket() as {
    latestCardiacData: any;
    latestEegData: any;
    latestCameraData: any;
    latestUnityData: UnitySignalData | null;
    latestSensorData: any;
    connectionStatus: any;
    recentAnomalies: any[];
    connect: () => void;
    disconnect: () => void;
  };

  // Destructure values and functions from the useSignalControl hook for API interaction.
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

  // State variables for UI and data management.
  const [modalOpen, setModalOpen] = useState(false); // Controls the visibility of the signal selection modal.
  const startTimeRef = useRef<number>(Date.now()); // Reference for application start time, used for relative timestamps.

  // States for processed and accumulated sensor data.
  const [heartRateData, setHeartRateData] = useState<DataPoint[]>([]);
  const [ecgDataBatches, setEcgDataBatches] = useState<EcgBatch[]>([]);
  const [throttledEcgData, setThrottledEcgData] = useState<DataPoint[]>([]);
  const [latestAccelerometerData, setLatestAccelerometerData] = useState<AccProcessedData | null>(null);
  const [latestGyroscopeData, setLatestGyroscopeData] = useState<GyroProcessedData | null>(null);
  const [eegRawData, setEegRawData] = useState<EegRawProcessedData>({});
  const [faceLandmarksData, setFaceLandmarksData] = useState<FaceLandmarksProcessedData | null>(null);
  const [latestAlcoholLevelData, setLatestAlcoholLevelData] = useState<AlcoholLevelProcessedData | null>(null);
  const [latestCarInformationData, setLatestCarInformationData] = useState<CarInformationProcessedData | null>(null);


  // References and constants for ECG data processing.
  const lastEcgUpdateTimeRef = useRef(0);
  const ECG_THROTTLE_INTERVAL_MS = 1; // Interval to throttle ECG data updates.
  const ECG_SAMPLE_RATE = 1000; // ECG samples per second.
  const ECG_WINDOW_DURATION_SECONDS = 5; // Duration of the ECG data window to display.
  const ECG_DOWNSAMPLING_FACTOR = 10; // Factor to downsample ECG data for display.

  // Constants for EEG data processing.
  const EEG_SAMPLE_RATE = 250; // EEG samples per second.
  const EEG_WINDOW_DURATION_SECONDS = 5; // Duration of the EEG data window to display.
  const EEG_DOWNSAMPLING_FACTOR = 1; // Factor to downsample EEG data for display.

  // States for local persistence of dashboard configuration (tabs, layouts, cards).
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [currentTabId, setCurrentTabId] = useState<number>(1);
  const [nextTabId, setNextTabId] = useState<number>(1);
  const [layoutsPerTab, setLayoutsPerTab] = useState<Record<number, Layout[]>>({});
  const [cardsPerTab, setCardsPerTab] = useState<Record<number, CardType[]>>({});
  const [cardIdCounter, setCardIdCounter] = useState<number>(1);

  /**
   * Effect hook to load dashboard configuration from localStorage on initial component mount.
   * It attempts to retrieve tabs, layouts, cards, and counters, providing fallback defaults if not found.
   */
  useEffect(() => {
    try {
      const storedTabs = localStorage.getItem('tabs');
      const storedLayouts = localStorage.getItem('layoutsPerTab');
      const storedCards = localStorage.getItem('cardsPerTab');
      const storedNextTabId = localStorage.getItem('nextTabId');
      const storedCurrentTabId = localStorage.getItem('currentTabId');
      const storedCardIdCounter = localStorage.getItem('cardIdCounter');

      let initialTabs: Tab[] = [];
      let initialLayouts: Record<number, Layout[]> = {};
      let initialCards: Record<number, CardType[]> = {};
      let initialNextTabId = 1;
      let initialCurrentTabId = 1;
      let initialCardIdCounter = 1;

      // Parse stored tabs or initialize a default tab if none exist.
      if (storedTabs) {
        initialTabs = JSON.parse(storedTabs);
      }

      if (initialTabs.length === 0) {
        initialTabs = [{ id: 1, label: "Tab 1" }];
      }

      // Parse stored layouts or initialize for the default tab.
      if (storedLayouts) {
        initialLayouts = JSON.parse(storedLayouts);
      } else {
        initialLayouts = { [initialTabs[0].id]: [] };
      }

      // Parse stored cards or initialize for the default tab.
      if (storedCards) {
        initialCards = JSON.parse(storedCards);
      } else {
        initialCards = { [initialTabs[0].id]: [] };
      }

      // Determine the highest existing tab ID to ensure unique new tab IDs.
      const maxTabId = initialTabs.reduce((max, tab) => Math.max(max, tab.id), 0);
      initialNextTabId = maxTabId + 1;

      // Set the current tab ID, falling back to the first tab if the stored ID is invalid.
      if (storedCurrentTabId) {
        const parsedCurrentTabId = parseInt(storedCurrentTabId);
        if (initialTabs.some(tab => tab.id === parsedCurrentTabId)) {
          initialCurrentTabId = parsedCurrentTabId;
        } else {
          initialCurrentTabId = initialTabs[0].id;
        }
      } else {
        initialCurrentTabId = initialTabs[0].id;
      }

      // Set the card ID counter, calculating the max existing card ID to prevent collisions.
      if (storedCardIdCounter) {
        initialCardIdCounter = parseInt(storedCardIdCounter);
      } else {
        let maxCardId = 0;
        Object.values(initialCards).forEach(cardsArray => {
          cardsArray.forEach(card => {
            const parts = card.id.split('-');
            if (parts.length === 2) {
              const cardNum = parseInt(parts[1]);
              if (!isNaN(cardNum)) {
                maxCardId = Math.max(maxCardId, cardNum);
              }
            }
          });
        });
        initialCardIdCounter = maxCardId + 1;
      }

      // Update the component's state with the loaded or default values.
      setTabs(initialTabs);
      setLayoutsPerTab(initialLayouts);
      setCardsPerTab(initialCards);
      setNextTabId(initialNextTabId);
      setCurrentTabId(initialCurrentTabId);
      setCardIdCounter(initialCardIdCounter);

      console.log("Loaded data from localStorage.");
    } catch (error) {
      console.error("Error loading data from localStorage:", error);
      // Fallback to default empty state if loading or parsing fails.
      setTabs([{ id: 1, label: "Tab 1" }]);
      setLayoutsPerTab({ 1: [] });
      setCardsPerTab({ 1: [] });
      setNextTabId(2);
      setCurrentTabId(1);
      setCardIdCounter(1);
    }
  }, []); // Empty dependency array ensures this effect runs only once on mount.

  // Effects to persist relevant states to localStorage whenever they change.
  useEffect(() => {
    localStorage.setItem('tabs', JSON.stringify(tabs));
  }, [tabs]);

  useEffect(() => {
    localStorage.setItem('layoutsPerTab', JSON.stringify(layoutsPerTab));
  }, [layoutsPerTab]);

  useEffect(() => {
    localStorage.setItem('cardsPerTab', JSON.stringify(cardsPerTab));
  }, [cardsPerTab]);

  useEffect(() => {
    localStorage.setItem('nextTabId', nextTabId.toString());
  }, [nextTabId]);

  useEffect(() => {
    localStorage.setItem('currentTabId', currentTabId.toString());
  }, [currentTabId]);

  useEffect(() => {
    localStorage.setItem('cardIdCounter', cardIdCounter.toString());
  }, [cardIdCounter]);


  /**
   * Effect hook to update heart rate data.
   * Appends new heart rate data points and keeps the array size limited.
   */
  useEffect(() => {
    if (latestCardiacData?.hr) {
      const currentTimeSeconds = (Date.now() - startTimeRef.current) / 1000;
      const newDataPoint: DataPoint = {
        x: currentTimeSeconds,
        value: latestCardiacData.hr.value
      };
      setHeartRateData(prev => [...prev, newDataPoint].slice(-200)); // Keep last 200 points.
    }
  }, [latestCardiacData?.hr]);

  /**
   * Effect hook to accumulate raw ECG data batches.
   * Appends new ECG batches and limits the number of stored batches.
   */
  useEffect(() => {
    if(latestCardiacData?.ecg && Array.isArray(latestCardiacData.ecg.value)){
      const currentTimeSeconds = (Date.now() - startTimeRef.current) / 1000;
      const newEcgBatch: EcgBatch = {
        timeSeconds : currentTimeSeconds,
        values: latestCardiacData.ecg.value
      };
      const maxBatchesToKeep = 100; // Limit the number of ECG batches to keep.
      setEcgDataBatches(prev => [...prev, newEcgBatch].slice(-maxBatchesToKeep));
    }
  }, [latestCardiacData?.ecg]);

  /**
   * Effect hook to flatten, downsample, and throttle ECG data for display.
   * This prevents re-rendering the chart too frequently with high-frequency data.
   */
  useEffect(() => {
    /**
     * Flattens an array of ECG batches into a single array of DataPoint objects.
     * Applies downsampling to reduce the number of points for rendering.
     * @param batches The array of `EcgBatch` objects.
     * @returns An array of `DataPoint` objects suitable for charting.
     */
    const flattenEcgBatches = (batches: EcgBatch[]): DataPoint[] => {
      const allPoints: DataPoint[] = [];
      const sampleDuration = 1 / ECG_SAMPLE_RATE; // Time duration of a single sample.

      batches.forEach(batch => {
        batch.values.forEach((val, index) => {
          const pointTime = batch.timeSeconds + (index * sampleDuration);
          allPoints.push({x: pointTime, value: val});
        });
      });

      const downsampledPoints: DataPoint[] = [];
      for (let i = 0; i < allPoints.length; i++){
        if(i % ECG_DOWNSAMPLING_FACTOR === 0){ // Apply downsampling.
          downsampledPoints.push(allPoints[i]);
        }
      }

      return downsampledPoints.slice(-1000); // Keep only the last 1000 downsampled points.
    };

    const now = Date.now();
    // Throttle updates to prevent excessive re-renders.
    if (now - lastEcgUpdateTimeRef.current > ECG_THROTTLE_INTERVAL_MS) {
      const newEcgPoints = flattenEcgBatches(ecgDataBatches);
      setThrottledEcgData(newEcgPoints);
      lastEcgUpdateTimeRef.current = now;
    }
  }, [ecgDataBatches, ECG_THROTTLE_INTERVAL_MS, ECG_SAMPLE_RATE, ECG_WINDOW_DURATION_SECONDS, ECG_DOWNSAMPLING_FACTOR]);

  /**
   * Effect hook to process and update the latest accelerometer data.
   */
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

  /**
   * Effect hook to process and update the latest gyroscope data.
   */
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


  /**
   * Effect hook to process raw EEG data.
   * It accumulates EEG data per channel and keeps it within a defined time window.
   */
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

            // Filter data to keep only points within the defined time window.
            const filteredData = combinedData.filter(point => point.x >= minTimeForWindow);

            // Ensure the array does not exceed a maximum size to prevent memory overflow.
            const maxPointsPerChannel = EEG_SAMPLE_RATE * EEG_WINDOW_DURATION_SECONDS * 1.2; // 20% buffer.
            newEegRawData[channelName] = filteredData.slice(-maxPointsPerChannel);
          }
        });
        return newEegRawData;
      });
    }
  }, [latestEegData?.raw, EEG_SAMPLE_RATE, EEG_WINDOW_DURATION_SECONDS]);

  /**
   * Effect hook to process and update Face Landmarks data.
   */
  useEffect(() => {
    if (latestCameraData?.faceLandmarks?.value) {
      const landmarksValue = latestCameraData.faceLandmarks.value;
      setFaceLandmarksData({
        landmarks: landmarksValue.landmarks,
        gaze_vector: landmarksValue.gaze_vector,
        ear: landmarksValue.ear,
        blink_rate: landmarksValue.blink_rate,
        blink_counter: landmarksValue.blink_counter,
        frame_b64: landmarksValue.frame_b64,
        timestamp: latestCameraData.faceLandmarks.timestamp,
      });
    }
  }, [latestCameraData?.faceLandmarks]);

  /**
   * Effect hook to process and update Alcohol Level data.
   */
  useEffect(() => {
    if (latestUnityData?.alcohol_level?.value) {
      setLatestAlcoholLevelData({
        alcohol_level: latestUnityData.alcohol_level.value.alcohol_level,
        timestamp: latestUnityData.alcohol_level.timestamp,
      });
    }
  }, [latestUnityData?.alcohol_level]);

  /**
   * Effect hook to process and update Car Information data.
   */
  useEffect(() => {
    if (latestUnityData?.car_information?.value) {
      setLatestCarInformationData({
        speed: latestUnityData.car_information.value.car_information.speed,
        lane_centrality: latestUnityData.car_information.value.car_information.lane_centrality,
        timestamp: latestUnityData.car_information.timestamp,
      });
    }
  }, [latestUnityData?.car_information]);


  // UI manipulation functions.

  /**
   * Updates the layout for the currently active tab.
   * @param newLayout The new layout array for the current tab.
   */
  const updateLayout = (newLayout: Layout[]) => {
    setLayoutsPerTab((prev) => ({
      ...prev,
      [currentTabId]: newLayout,
    }));
  };

  /**
   * Adds a new tab to the dashboard.
   * Generates a unique ID for the new tab and initializes its card and layout states.
   */
  const addTab = useCallback(() => {
    const newTabId = nextTabId;
    const newTab = {
      id: newTabId,
      label: `Tab ${newTabId}`,
    };

    setTabs((prev) => [...prev, newTab]);
    setCurrentTabId(newTab.id);
    setNextTabId((prev) => prev + 1);

    // Initialize empty card and layout arrays for the new tab.
    setCardsPerTab((prev) => ({ ...prev, [newTab.id]: [] }));
    setLayoutsPerTab((prev) => ({ ...prev, [newTab.id]: [] }));

    console.log(`Initialized new tab ${newTabId}.`);
  }, [nextTabId]);

  /**
   * Closes a specified tab from the dashboard.
   * If only one tab remains, the operation is ignored.
   * Updates the current tab if the closed tab was active.
   * @param idToRemove The ID of the tab to close.
   */
  const closeTab = useCallback((idToRemove: number) => {
    if (tabs.length === 1) return; // Prevent closing the last tab.

    setTabs((prevTabs) => {
      const index = prevTabs.findIndex((t) => t.id === idToRemove);
      const newTabs = prevTabs.filter((t) => t.id !== idToRemove);
      // If the current tab is being removed, switch to an adjacent tab.
      if (currentTabId === idToRemove) {
        const newIndex = index > 0 ? index - 1 : 0;
        setCurrentTabId(newTabs[newIndex].id);
      }
      return newTabs;
    });
    // Remove cards and layouts associated with the closed tab.
    setCardsPerTab((prev) => {
      const updated = { ...prev };
      delete updated[idToRemove];
      return updated;
    });
    setLayoutsPerTab((prev) => {
      const updated = { ...prev };
      delete updated[idToRemove];
      return updated;
    });

    console.log(`Deleted tab ${idToRemove} data.`);
  }, [tabs, currentTabId]);


  /**
   * Adds a new card to the dashboard based on the selected signal.
   * Retrieves card configuration from `cardConfig.ts` and enables the signal if not already active.
   * @param component The backend component associated with the signal (e.g., 'websocket').
   * @param signalName The specific signal name (e.g., 'hr_data', 'ecg_signal').
   */
  const addCard = (component: string, signalName: string) => {
    // Get the card configuration based on the signal name.
    const cardConfig = getCardConfigBySignalName(signalName);

    if (!cardConfig) {
      console.warn(`No card configuration found for signal: ${signalName}`);
      return;
    }

    // Create the new card object using properties from the configuration.
    const newCard: CardType = {
      id: `${currentTabId}-${cardIdCounter}`, // Unique ID for the card within its tab.
      label: `${cardConfig.label} (${signalName})`,
      colSpan: cardConfig.defaultColSpan,
      rowSpan: cardConfig.defaultRowSpan,
      signalType: cardConfig.signalType,
      signalName: signalName,
      component: component,
      unit: cardConfig.unit,
      color: cardConfig.color,
      activeVisualizationIndex: 0, // NOVO: Inicializa o índice da visualização ativa para 0
    };

    // Add the new card to the cardsPerTab state for the current tab.
    setCardsPerTab((prev) => ({
      ...prev,
      [currentTabId]: [...(prev[currentTabId] || []), newCard],
    }));
    setCardIdCounter((prev) => prev + 1); // Increment card ID counter for next card.

    // Check if the signal is already active before attempting to enable it.
    const isSignalAlreadyActive = activeSignals[component]?.includes(signalName);
    if (!isSignalAlreadyActive) {
      enableSignal(component, signalName); // Enable the signal via API.
    }
  };

  /**
   * Handles the click event for adding a new card.
   * Loads available signals and opens the signal selection modal.
   */
  const handleAddCardClick = () => {
    loadSignals(); // Fetch available signals from the backend.
    setModalOpen(true); // Open the modal.
  };

  /**
   * Handles the selection of a signal from the modal.
   * Adds a new card for the selected signal and closes the modal.
   * @param component The backend component of the selected signal.
   * @param signalName The name of the selected signal.
   */
  const handleSignalSelect = (component: string, signalName: string) => {
    addCard(component, signalName) // Add the card to the dashboard.
    setModalOpen(false); // Close the modal.
  };

  /**
   * Handles the change of active visualization within a specific card.
   * Updates the `activeVisualizationIndex` for the card in `cardsPerTab` state.
   * @param cardId The ID of the card whose visualization changed.
   * @param newIndex The new active visualization index.
   */
  const handleVisualizationChange = useCallback((cardId: string, newIndex: number) => {
    setCardsPerTab(prevCardsPerTab => {
      const updatedCardsForTab = (prevCardsPerTab[currentTabId] || []).map(card => {
        if (card.id === cardId) {
          return { ...card, activeVisualizationIndex: newIndex };
        }
        return card;
      });
      return {
        ...prevCardsPerTab,
        [currentTabId]: updatedCardsForTab,
      };
    });
  }, [currentTabId]);


  // Memoized value for the cards in the currently active tab.
  const currentCards = useMemo(() => cardsPerTab[currentTabId] || [], [cardsPerTab, currentTabId]);

  /**
   * Memoized computation for the layout of cards in the current tab.
   * It merges saved layouts with new cards, calculating appropriate positions for new cards.
   */
  const currentLayout = useMemo(() => {
    const savedLayout = layoutsPerTab[currentTabId] || [];
    const activeCardsForTab = cardsPerTab[currentTabId] || [];

    const newLayout: Layout[] = [];
    const existingLayoutMap = new Map<string, Layout>();
    savedLayout.forEach(item => existingLayoutMap.set(item.i, item));

    // Variables for positioning new cards.
    let maxExistingY = 0;
    if (savedLayout.length > 0) {
      maxExistingY = Math.max(...savedLayout.map(item => item.y + item.h));
    }
    let nextX = 0;
    let nextY = maxExistingY; // Start adding new cards below existing ones.

    activeCardsForTab.forEach(card => {
      const existingLayoutItem = existingLayoutMap.get(card.id);

      if (existingLayoutItem) {
        // If the card already has a saved layout, use its position and dimensions.
        newLayout.push(existingLayoutItem);
      } else {
        // If it's a new card, add it with default dimensions and calculate a new position.
        const cardConfig = getCardConfigBySignalName(card.signalType);
        const w = cardConfig?.defaultColSpan || 1;
        const h = cardConfig?.defaultRowSpan || 1;

        // Simple logic to find the next available position.
        const tempGridCols = 3; // Temporary value for position calculation, ideally from MainGrid.
        if (nextX + w > tempGridCols) { // If it doesn't fit in the current row, move to the next.
          nextX = 0;
          nextY += h;
        }

        newLayout.push({
          i: card.id,
          x: nextX,
          y: nextY,
          w: w,
          h: h,
          minW: 1,
          minH: 1,
        });
        nextX += w; // Move to the next position in the row.
      }
    });

    // Filter out layout items that no longer have a corresponding active card.
    const finalLayout = newLayout.filter(layoutItem =>
      activeCardsForTab.some(card => card.id === layoutItem.i)
    );

    // Sort the layout to ensure consistency (good practice for React Grid Layout).
    finalLayout.sort((a, b) => {
      if (a.y === b.y) return a.x - b.x;
      return a.y - b.y;
    });

    return finalLayout;
  }, [layoutsPerTab, cardsPerTab, currentTabId]); // Re-calculate when these dependencies change.


  /**
   * Handles disabling a signal and removing its corresponding card from the grid.
   * It checks if this is the last card of its type before calling `disableSignal`.
   * @param cardId The ID of the card to remove.
   */
  const handleDisableSignalAndRemoveCard = useCallback((cardId: string) => {
    // Find the card that is being removed.
    const cardToDisable = currentCards.find(c => c.id === cardId);

    if (cardToDisable) {
      const { component, signalName } = cardToDisable;

      // Filter cards to see how many of the same type remain BEFORE removal.
      const remainingCardsOfType = (cardsPerTab[currentTabId] || []).filter(
        (card) => card.id !== cardId && card.component === component && card.signalName === signalName
      );

      // If this is the LAST card of its type, call disableSignal.
      if (remainingCardsOfType.length === 0) {
        disableSignal(component, signalName);
      }

      // Remove the card from the `cardsPerTab` state.
      setCardsPerTab(prevCardsPerTab => {
        const updatedCardsForTab = (prevCardsPerTab[currentTabId] || []).filter(
          (card) => card.id !== cardId
        );
        return {
          ...prevCardsPerTab,
          [currentTabId]: updatedCardsForTab,
        };
      });

      // Remove the item from the layout state.
      setLayoutsPerTab(prevLayoutsPerTab => {
        const updatedLayoutsForTab = (prevLayoutsPerTab[currentTabId] || []).filter(
          (layoutItem) => layoutItem.i !== cardId
        );
        return {
          ...prevLayoutsPerTab,
          [currentTabId]: updatedLayoutsForTab,
        };
      });
    }
  }, [currentTabId, cardsPerTab, currentCards, disableSignal]);


  return (
    <div className="flex flex-col h-full">
      {/* Connection Status Bar */}
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
            {/* Anomaly Indicator */}
            {recentAnomalies.length > 0 && (
              <span className="bg-red-500 px-2 py-1 rounded text-xs">
                ⚠️ {recentAnomalies.length} Anomalias
              </span>
            )}
            {/* Connect/Disconnect Button */}
            <button
              onClick={connectionStatus.connected ? disconnect : connect}
              className="bg-white/20 hover:bg-white/30 px-2 py-1 rounded text-xs transition"
            >
              {connectionStatus.connected ? 'Desconectar' : 'Reconectar'}
            </button>
          </div>
        </div>
        {/* Connection Error Message */}
        {connectionStatus.error && (
          <div className="text-xs mt-1 opacity-90">
            Erro: {connectionStatus.error}
          </div>
        )}
      </div>

      {/* Header component with Add Card functionality */}
      <Header onAddCard={handleAddCardClick} />

      <div className="flex flex-1">
        {/* Sidebar component for tab navigation */}
        <Sidebar
          tabs={tabs}
          currentTabId={currentTabId}
          onTabClick={setCurrentTabId}
          onAddTab={addTab}
          onCloseTab={closeTab}
        />
        {/* Main content area for the grid of cards */}
        <main className="flex-1 bg-gray-100 p-4 overflow-hidden">
          <MainGrid
            activeSignals={currentCards}
            onLayoutChange={updateLayout}
            layout={currentLayout}
            hrData={heartRateData}
            ecgData={throttledEcgData}
            accelerometerData={latestAccelerometerData}
            gyroscopeData={latestGyroscopeData}
            eegRawData={eegRawData}
            faceLandmarksData={faceLandmarksData}
            alcoholLevelData={latestAlcoholLevelData}
            carInformationData={latestCarInformationData}
            onDisableSignal={handleDisableSignalAndRemoveCard}
            onVisualizationChange={handleVisualizationChange} // NOVO: Passa o callback de mudança de visualização
          />
        </main>
      </div>

      {/* Signal selection modal */}
      <SignalModal
        open={modalOpen}
        availableSignals={availableSignals}
        loading={signalsLoading}
        onClose={() => setModalOpen(false)}
        onSelect={handleSignalSelect}
      />

      {/* Development-only debug information footer */}
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
            <span>FaceLandmarks: {faceLandmarksData ? 'Recebido' : 'N/A'}</span>
            <span>Nível Álcool: {latestAlcoholLevelData?.alcohol_level?.toFixed(2) ?? 'N/A'}‰</span>
            <span>Info Carro: {latestCarInformationData ? `Vel: ${latestCarInformationData.speed.toFixed(1)} ${getCardConfigBySignalName('car_information')?.unit}, Central: ${latestCarInformationData.lane_centrality.toFixed(2)}` : 'N/A'}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;