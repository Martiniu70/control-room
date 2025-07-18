/**
 * Hook para gerenciamento de sinais via API REST
 * 
 * @param {string} baseUrl - URL base da API (padrão: '/api/signal-control')
 * @param {number} [pollingInterval=30000] - Intervalo de atualização automática em ms (0 para desativar)
 * @returns {Object} Retorna o estado e ações para controle de sinais
 */
import { useState, useCallback } from 'react';

interface SignalControlState {
  availableSignals: Record<string, string[]>;
  activeSignals: Record<string, string[]>;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  operationInProgress: boolean;
}

interface SignalControlActions {
  fetchSignalStatus: () => Promise<void>;
  loadSignals: () => Promise<void>;
  enableSignal: (component: string, signal: string) => Promise<boolean>;
  disableSignal: (component: string, signal: string) => Promise<boolean>;
  enableAllSignals: (component?: string) => Promise<boolean>;
  disableAllSignals: (component?: string) => Promise<boolean>;
}

interface ComponentInfo {
  availableSignals: string[];
  activeSignals: string[];
  state?: string;
}

interface SignalControlResponse {
  components: Record<string, ComponentInfo>;
  timestamp?: string;
  totalComponents?: number;
}

export const useSignalControl = (
  baseUrl: string = '/api/signal-control'
): SignalControlState & SignalControlActions => {
  const [state, setState] = useState<SignalControlState>({
    availableSignals: {},
    activeSignals: {},
    loading: true,
    error: null,
    lastUpdated: null,
    operationInProgress: false
  });

  const normalizeApiData = useCallback((data: SignalControlResponse) => {
    const availableSignals: Record<string, string[]> = {};
    const activeSignals: Record<string, string[]> = {};

    console.log("normalizeApiData - Data received", data);
    if(data && typeof data.components === "object" && data.components !== null){
        const compName = "websocket";
        const compData = data.components[compName];
        if(compData && Array.isArray(compData.availableSignals) && Array.isArray(compData.activeSignals)){ 
            availableSignals[compName] = compData.availableSignals || [];
            activeSignals[compName] = compData.activeSignals || [];
        }
        else{
            console.warn(`normalizeApiData - Component '${compName}' has unexpected data format:`, compData);
            availableSignals[compName] = [];
            activeSignals[compName] = [];
        }
    }
    else{
        console.warn("normalizeApiData - `data.components` is not a valid object: ", data.components);
    }

    console.log("normalizeApiData - Resulting availableSignals:", availableSignals);
    console.log("normalizeApiData - Resulting activeSignals:", activeSignals);

    return { availableSignals, activeSignals };
  }, []);

  const fetchWithRetry = useCallback(async (
    url: string,
    options: RequestInit = {},
    retries = 2,
    timeout = 5000
  ): Promise<Response> => {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      
      clearTimeout(id);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      
      return response;
    } catch (error) {
      if (retries <= 0 || (error as Error).name === 'AbortError') throw error;
      await new Promise(resolve => setTimeout(resolve, 1000));
      return fetchWithRetry(url, options, retries - 1, timeout);
    }
  }, []);

  const fetchSignalStatus = useCallback(async () => {    
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const response = await fetchWithRetry(`${baseUrl}/components`);
      const data: SignalControlResponse = await response.json();
      const { availableSignals, activeSignals } = normalizeApiData(data);
      
      setState({
        availableSignals,
        activeSignals,
        loading: false,
        error: null,
        lastUpdated: new Date(),
        operationInProgress: false
      });
      
    } catch (error) {
      console.error('Failed to fetch signal status:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        operationInProgress: false
      }));
    }
  }, [baseUrl, normalizeApiData, fetchWithRetry]);

  const executeControlOperation = useCallback(async (
    endpoint: string,
    component?: string,
    signal?: string
  ): Promise<boolean> => {
    if (state.operationInProgress) {
      console.warn('Operation already in progress');
      return false;
    }

    setState(prev => ({ ...prev, operationInProgress: true }));
    
    try {
      let url = `${baseUrl}`;
      const options: RequestInit = { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      };
      
      if (component) {
        url += `/${component}`;
        if (signal) {
          url += `/signals/${signal}`;
        }
      }

      url += `/${endpoint}`;
      
      const response = await fetchWithRetry(url, options, 2, 10000);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Operation failed with status ${response.status}`);
      }
      
      await fetchSignalStatus();
      return true;
      
    } catch (error) {
      console.error(`Control operation ${endpoint} failed:`, error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Operation failed',
        operationInProgress: false
      }));
      return false;
    }
  }, [baseUrl, fetchSignalStatus, fetchWithRetry, state.operationInProgress]);

  const enableSignal = useCallback((component: string, signal: string) => 
    executeControlOperation('enable', component, signal), [executeControlOperation]);

  const disableSignal = useCallback((component: string, signal: string) => 
    executeControlOperation('disable', component, signal), [executeControlOperation]);

  const enableAllSignals = useCallback((component?: string) => 
    executeControlOperation('enable-all', component), [executeControlOperation]);

  const disableAllSignals = useCallback((component?: string) => 
    executeControlOperation('disable-all', component), [executeControlOperation]);

  const loadSignals = useCallback(async() => {
    await fetchSignalStatus();
  }, [fetchSignalStatus]);

  return {
    ...state,
    fetchSignalStatus,
    loadSignals,
    enableSignal,
    disableSignal,
    enableAllSignals,
    disableAllSignals
  };
};

export default useSignalControl;