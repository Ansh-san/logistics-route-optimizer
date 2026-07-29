// App.jsx
import { useState, useMemo, useCallback, useEffect } from "react";
import "leaflet/dist/leaflet.css";
import MapVisualizer from "./components/MapVisualizer";
import ControlPanel from "./components/ControlPanel";
import MultiStopPanel from "./components/MultiStopPanel";
import { fetchGraph, calculateShortest, calculateMultiStop } from "./services/api";
import { enrichEdgesWithRoadData } from "./utils/osrmService";

export default function App() {
  const [mode, setMode] = useState("single"); // "single" | "multi"

  // --- graph data loaded from API ---
  const [warehouses, setWarehouses] = useState([]);
  const [staticEdges, setStaticEdges] = useState([]);
  const [graphLoading, setGraphLoading] = useState(true);
  const [graphError, setGraphError] = useState(null);

  const warehouseMap = useMemo(
    () => warehouses.reduce((acc, w) => { acc[w.id] = w; return acc; }, {}),
    [warehouses]
  );

  // --- shared road-data loading ---
  const [liveEdges, setLiveEdges] = useState([]);
  const [edgesLoading, setEdgesLoading] = useState(true);

  // Fetch graph from API on mount
  useEffect(() => {
    let cancelled = false;
    async function loadGraph() {
      try {
        setGraphLoading(true);
        setGraphError(null);
        const data = await fetchGraph();
        if (!cancelled) {
          setWarehouses(data.warehouses);
          setStaticEdges(data.edges);
          setLiveEdges(data.edges); // temporary until OSRM enriches
          setGraphLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load graph:", err);
          setGraphError(err.message);
          setGraphLoading(false);
        }
      }
    }
    loadGraph();
    return () => { cancelled = true; };
  }, []);

  // Enrich edges with real road data once graph is loaded
  useEffect(() => {
    if (staticEdges.length === 0 || Object.keys(warehouseMap).length === 0) return;

    let cancelled = false;
    async function loadRoadData() {
      setEdgesLoading(true);
      const enriched = await enrichEdgesWithRoadData(staticEdges, warehouseMap);
      if (!cancelled) {
        setLiveEdges(enriched);
        setEdgesLoading(false);
      }
    }
    loadRoadData();
    return () => { cancelled = true; };
  }, [staticEdges, warehouseMap]);

  // --- single-route state ---
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");
  const [singleResult, setSingleResult] = useState(null);
  const [singleError, setSingleError] = useState(false);
  const [singleLoading, setSingleLoading] = useState(false);

  // Set default source/destination once warehouses load
  useEffect(() => {
    if (warehouses.length >= 2) {
      setSource((prev) => prev || warehouses[0].id);
      setDestination((prev) => prev || warehouses[1].id);
    }
  }, [warehouses]);

  const handleCalculateSingle = useCallback(async () => {
    try {
      setSingleLoading(true);
      setSingleError(false);
      const outcome = await calculateShortest(source, destination);
      setSingleResult(outcome);
    } catch {
      setSingleResult(null);
      setSingleError(true);
    } finally {
      setSingleLoading(false);
    }
  }, [source, destination]);

  const handleResetSingle = useCallback(() => {
    if (warehouses.length >= 2) {
      setSource(warehouses[0].id);
      setDestination(warehouses[1].id);
    }
    setSingleResult(null);
    setSingleError(false);
  }, [warehouses]);

  const handleSourceChange = useCallback((id) => {
    setSource(id);
    setSingleResult(null);
    setSingleError(false);
  }, []);

  const handleDestinationChange = useCallback((id) => {
    setDestination(id);
    setSingleResult(null);
    setSingleError(false);
  }, []);

  // --- multi-stop state ---
  const [multiStart, setMultiStart] = useState("");
  const [selectedStops, setSelectedStops] = useState([]);
  const [multiResult, setMultiResult] = useState(null);
  const [multiError, setMultiError] = useState(false);
  const [multiLoading, setMultiLoading] = useState(false);

  // Set default multi-start once warehouses load
  useEffect(() => {
    if (warehouses.length >= 1) {
      setMultiStart((prev) => prev || warehouses[0].id);
    }
  }, [warehouses]);

  const handleStartChange = useCallback((id) => {
    setMultiStart(id);
    setSelectedStops((prev) => prev.filter((s) => s !== id));
    setMultiResult(null);
    setMultiError(false);
  }, []);

  const handleToggleStop = useCallback((id) => {
    setSelectedStops((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
    setMultiResult(null);
    setMultiError(false);
  }, []);

  const handleCalculateMulti = useCallback(async () => {
    try {
      setMultiLoading(true);
      setMultiError(false);
      const outcome = await calculateMultiStop(multiStart, selectedStops);
      setMultiResult(outcome);
    } catch {
      setMultiResult(null);
      setMultiError(true);
    } finally {
      setMultiLoading(false);
    }
  }, [multiStart, selectedStops]);

  const handleResetMulti = useCallback(() => {
    if (warehouses.length >= 1) {
      setMultiStart(warehouses[0].id);
    }
    setSelectedStops([]);
    setMultiResult(null);
    setMultiError(false);
  }, [warehouses]);

  // --- derived path passed to the map, depending on active mode ---
  const highlightedPath = useMemo(() => {
    if (mode === "single") return singleResult?.path ?? null;
    return multiResult?.path ?? null;
  }, [mode, singleResult, multiResult]);

  // --- loading state while graph is being fetched ---
  if (graphLoading) {
    return (
      <div className="flex items-center justify-center w-screen h-screen bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-8 w-8 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin mb-4" />
          <p className="text-gray-600 text-sm">Loading warehouse network…</p>
        </div>
      </div>
    );
  }

  if (graphError) {
    return (
      <div className="flex items-center justify-center w-screen h-screen bg-gray-50">
        <div className="text-center max-w-md">
          <p className="text-red-600 font-medium mb-2">Failed to load graph data</p>
          <p className="text-gray-500 text-sm mb-4">{graphError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      <MapVisualizer
        highlightedPath={highlightedPath}
        edges={liveEdges}
        warehouses={warehouses}
        warehouseMap={warehouseMap}
      />

      {/* Mode toggle, floating top-right */}
      <div className="absolute top-4 right-4 z-10 flex rounded-xl bg-white/90 backdrop-blur-md shadow-lg border border-gray-200 p-1 text-sm">
        <button
          onClick={() => setMode("single")}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
            mode === "single" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          Single Route
        </button>
        <button
          onClick={() => setMode("multi")}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
            mode === "multi" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          Multi-Stop
        </button>
      </div>

      {mode === "single" ? (
        <ControlPanel
          warehouses={warehouses}
          source={source}
          destination={destination}
          onSourceChange={handleSourceChange}
          onDestinationChange={handleDestinationChange}
          onCalculate={handleCalculateSingle}
          onReset={handleResetSingle}
          result={singleResult}
          hasError={singleError}
          isLoading={singleLoading}
          edgesLoading={edgesLoading}
        />
      ) : (
        <MultiStopPanel
          warehouses={warehouses}
          startId={multiStart}
          selectedStops={selectedStops}
          onStartChange={handleStartChange}
          onToggleStop={handleToggleStop}
          onCalculate={handleCalculateMulti}
          onReset={handleResetMulti}
          result={multiResult}
          hasError={multiError}
          isLoading={multiLoading}
          edgesLoading={edgesLoading}
        />
      )}
    </div>
  );
}