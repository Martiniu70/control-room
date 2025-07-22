/**
 * @file useSignalControl.ts
 * @description Custom React hook for managing signals via a REST API.
 * This hook provides functionality to fetch signal statuses, enable/disable
 * individual signals, and control all signals for a given component.
 */

import { useState, useCallback } from 'react';

/**
 * Interface representing the state managed by the `useSignalControl` hook.
 */
interface SignalControlState {
  availableSignals: Record<string, string[]>; // Signals that can be controlled, grouped by component.
  activeSignals: Record<string, string[]>;    // Currently active signals, grouped by component.
  loading: boolean;                            // Indicates if data is currently being fetched.
  error: string | null;                        // Stores any error message that occurred during API calls.
  lastUpdated: Date | null;                    // Timestamp of the last successful data update.
  operationInProgress: boolean;                // Indicates if a control operation (enable/disable) is ongoing.
}

/**
 * Interface representing the actions/functions exposed by the `useSignalControl` hook.
 */
interface SignalControlActions {
  fetchSignalStatus: () => Promise<void>;                             // Fetches the current status of all signals.
  loadSignals: () => Promise<void>;                                   // Alias for fetchSignalStatus, meant for initial loading.
  enableSignal: (component: string, signal: string) => Promise<boolean>;   // Enables a specific signal for a component.
  disableSignal: (component: string, signal: string) => Promise<boolean>;  // Disables a specific signal for a component.
  enableAllSignals: (component?: string) => Promise<boolean>;         // Enables all signals for a specific component, or all components if none specified.
  disableAllSignals: (component?: string) => Promise<boolean>;        // Disables all signals for a specific component, or all components if none specified.
}

/**
 * Interface for the information about a specific component returned by the API.
 */
interface ComponentInfo {
  availableSignals: string[]; // List of signals that this component can provide.
  activeSignals: string[];    // List of signals currently active for this component.
  state?: string;             // Optional state of the component (e.g., "running", "stopped").
}

/**
 * Interface for the overall response structure from the signal control API.
 */
interface SignalControlResponse {
  components: Record<string, ComponentInfo>; // A map of component names to their information.
  timestamp?: string;                        // Optional timestamp of the API response.
  totalComponents?: number;                  // Optional total number of components.
}

/**
 * Custom React hook for managing real-time data signals via a REST API.
 * It handles fetching the status of available and active signals and provides
 * functions to control them (enable/disable).
 *
 * @param {string} baseUrl - The base URL for the signal control API. Defaults to '/api/signal-control'.
 * @returns {SignalControlState & SignalControlActions} An object containing the current state
 * of signals and actions to interact with them.
 */
export const useSignalControl = (
  baseUrl: string = '/api/signal-control'
): SignalControlState & SignalControlActions => {
  // Initialize the state for signal control.
  const [state, setState] = useState<SignalControlState>({
    availableSignals: {},
    activeSignals: {},
    loading: true,
    error: null,
    lastUpdated: null,
    operationInProgress: false
  });

  /**
   * Normalizes the API response data into the hook's internal state structure.
   * Specifically processes the 'websocket' component's signals.
   * @param data The raw `SignalControlResponse` from the API.
   * @returns An object containing normalized `availableSignals` and `activeSignals`.
   */
  const normalizeApiData = useCallback((data: SignalControlResponse) => {
    const availableSignals: Record<string, string[]> = {};
    const activeSignals: Record<string, string[]> = {};

    console.log("normalizeApiData - Data received", data);
    // Ensure `data.components` is a valid object before proceeding.
    if(data && typeof data.components === "object" && data.components !== null){
        const compName = "websocket"; // Target specific component 'websocket'.
        const compData = data.components[compName];
        // Check if the component data and its signal arrays are valid.
        if(compData && Array.isArray(compData.availableSignals) && Array.isArray(compData.activeSignals)){
            availableSignals[compName] = compData.availableSignals || [];
            activeSignals[compName] = compData.activeSignals || [];
        }
        else{
            console.warn(`normalizeApiData - Component '${compName}' has unexpected data format:`, compData);
            availableSignals[compName] = []; // Default to empty arrays if format is unexpected.
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

  /**
   * Performs a fetch request with retry logic and a timeout.
   * @param url The URL to fetch.
   * @param options Request options for `fetch`.
   * @param retries Number of retry attempts.
   * @param timeout Timeout for each request in milliseconds.
   * @returns A Promise that resolves with the Response object on success.
   * @throws Error if the fetch operation fails after retries or times out.
   */
  const fetchWithRetry = useCallback(async (
    url: string,
    options: RequestInit = {},
    retries = 2,
    timeout = 5000
  ): Promise<Response> => {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout); // Set timeout for the request.

      // Perform the fetch request with the abort signal.
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(id); // Clear the timeout if the request completes in time.

      // Throw an error if the HTTP response status is not OK.
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})); // Attempt to parse error message from response body.
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return response;
    } catch (error) {
      // Retry the request if retries are available and it's not an AbortError.
      if (retries <= 0 || (error as Error).name === 'AbortError') throw error;
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait before retrying.
      return fetchWithRetry(url, options, retries - 1, timeout); // Recursive call for retry.
    }
  }, []);

  /**
   * Fetches the current status of all signals from the API.
   * Updates the hook's state with available and active signals.
   */
  const fetchSignalStatus = useCallback(async () => {
    // Set loading state to true and clear any previous errors.
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Fetch component data from the API.
      const response = await fetchWithRetry(`${baseUrl}/components`);
      const data: SignalControlResponse = await response.json();
      // Normalize the received data.
      const { availableSignals, activeSignals } = normalizeApiData(data);

      // Update the state with the fetched and normalized data.
      setState({
        availableSignals,
        activeSignals,
        loading: false,
        error: null,
        lastUpdated: new Date(),
        operationInProgress: false // Ensure this is false after fetching status.
      });

    } catch (error) {
      console.error('Failed to fetch signal status:', error);
      // Update state to reflect the error.
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        operationInProgress: false // Ensure this is false after a failed fetch.
      }));
    }
  }, [baseUrl, normalizeApiData, fetchWithRetry]);

  /**
   * Executes a control operation (enable/disable) on a signal or component.
   * Prevents concurrent operations and updates signal status after completion.
   * @param endpoint The API endpoint for the operation (e.g., 'enable', 'disable', 'enable-all').
   * @param component Optional. The name of the component.
   * @param signal Optional. The name of the signal.
   * @returns A Promise that resolves to `true` if the operation was successful, `false` otherwise.
   */
  const executeControlOperation = useCallback(async (
    endpoint: string,
    component?: string,
    signal?: string
  ): Promise<boolean> => {
    // Prevent multiple operations from running concurrently.
    if (state.operationInProgress) {
      console.warn('Operation already in progress');
      return false;
    }

    // Set operationInProgress to true to block further operations.
    setState(prev => ({ ...prev, operationInProgress: true }));

    try {
      let url = `${baseUrl}`;
      const options: RequestInit = {
        method: 'POST', // Control operations are typically POST requests.
        headers: { 'Content-Type': 'application/json' }
      };

      // Construct the URL based on component and signal presence.
      if (component) {
        url += `/${component}`;
        if (signal) {
          url += `/signals/${signal}`;
        }
      }

      url += `/${endpoint}`; // Append the specific operation endpoint.

      // Execute the API call with retry mechanism.
      const response = await fetchWithRetry(url, options, 2, 10000); // 2 retries, 10s timeout.

      // Check if the response was successful.
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Operation failed with status ${response.status}`);
      }

      // Refresh signal status after a successful operation.
      await fetchSignalStatus();
      return true;

    } catch (error) {
      console.error(`Control operation ${endpoint} failed:`, error);
      // Update state to reflect the error and reset operation status.
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Operation failed',
        operationInProgress: false
      }));
      return false;
    }
  }, [baseUrl, fetchSignalStatus, fetchWithRetry, state.operationInProgress]);

  /**
   * Enables a specific signal for a given component.
   * @param component The name of the component.
   * @param signal The name of the signal to enable.
   * @returns A Promise resolving to `true` if successful, `false` otherwise.
   */
  const enableSignal = useCallback((component: string, signal: string) =>
    executeControlOperation('enable', component, signal), [executeControlOperation]);

  /**
   * Disables a specific signal for a given component.
   * @param component The name of the component.
   * @param signal The name of the signal to disable.
   * @returns A Promise resolving to `true` if successful, `false` otherwise.
   */
  const disableSignal = useCallback((component: string, signal: string) =>
    executeControlOperation('disable', component, signal), [executeControlOperation]);

  /**
   * Enables all signals for a specified component, or for all components if no component is specified.
   * @param component Optional. The name of the component.
   * @returns A Promise resolving to `true` if successful, `false` otherwise.
   */
  const enableAllSignals = useCallback((component?: string) =>
    executeControlOperation('enable-all', component), [executeControlOperation]);

  /**
   * Disables all signals for a specified component, or for all components if no component is specified.
   * @param component Optional. The name of the component.
   * @returns A Promise resolving to `true` if successful, `false` otherwise.
   */
  const disableAllSignals = useCallback((component?: string) =>
    executeControlOperation('disable-all', component), [executeControlOperation]);

  /**
   * An alias for `fetchSignalStatus`, intended for explicit loading of signals.
   */
  const loadSignals = useCallback(async() => {
    await fetchSignalStatus();
  }, [fetchSignalStatus]);

  /**
   * Returns the current state and actions to components using this hook.
   */
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