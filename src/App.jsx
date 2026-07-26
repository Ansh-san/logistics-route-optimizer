// App.jsx
import { useState, useMemo, useCallback, useEffect } from "react";
import "leaflet/dist/leaflet.css";
import MapVisualizer from "./components/MapVisualizer";
import ControlPanel from "./components/ControlPanel";
import MultiStopPanel from "./components/MultiStopPanel";
import { warehouses, edges as staticEdges, warehouseMap } from "./data/data";
import { findShortestPath, solveMultiStopRoute } from "./utils/routingUtils";
import { enrichEdgesWithRoadData } from "./utils/osrmService";

export default function App() {
  const [mode, setMode] = useState("single"); // "single" | "multi"

  // --- shared road-data loading ---
  const [liveEdges, setLiveEdges] = useState(staticEdges);
  const [edgesLoading, setEdgesLoading] = useState(true);

  useEffect(() => {
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
    return () => {
      cancelled = true;
    };
  }, []);

  // --- single-route state ---
  const [source, setSource] = useState(warehouses[0].id);
  const [destination, setDestination] = useState(warehouses[1].id);
  const [singleResult, setSingleResult] = useState(null);
  const [singleError, setSingleError] = useState(false);

  const handleCalculateSingle = useCallback(() => {
    const outcome = findShortestPath(warehouses, liveEdges, source, destination);
    if (!outcome) {
      setSingleResult(null);
      setSingleError(true);
      return;
    }
    setSingleError(false);
    setSingleResult(outcome);
  }, [source, destination, liveEdges]);

  const handleResetSingle = useCallback(() => {
    setSource(warehouses[0].id);
    setDestination(warehouses[1].id);
    setSingleResult(null);
    setSingleError(false);
  }, []);

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
  const [multiStart, setMultiStart] = useState(warehouses[0].id);
  const [selectedStops, setSelectedStops] = useState([]);
  const [multiResult, setMultiResult] = useState(null);
  const [multiError, setMultiError] = useState(false);

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

  const handleCalculateMulti = useCallback(() => {
    const outcome = solveMultiStopRoute(warehouses, liveEdges, multiStart, selectedStops);
    if (!outcome) {
      setMultiResult(null);
      setMultiError(true);
      return;
    }
    setMultiError(false);
    setMultiResult(outcome);
  }, [multiStart, selectedStops, liveEdges]);

  const handleResetMulti = useCallback(() => {
    setMultiStart(warehouses[0].id);
    setSelectedStops([]);
    setMultiResult(null);
    setMultiError(false);
  }, []);

  // --- derived path passed to the map, depending on active mode ---
  const highlightedPath = useMemo(() => {
    if (mode === "single") return singleResult?.path ?? null;
    return multiResult?.path ?? null;
  }, [mode, singleResult, multiResult]);

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      <MapVisualizer highlightedPath={highlightedPath} edges={liveEdges} />

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
          source={source}
          destination={destination}
          onSourceChange={handleSourceChange}
          onDestinationChange={handleDestinationChange}
          onCalculate={handleCalculateSingle}
          onReset={handleResetSingle}
          result={singleResult}
          hasError={singleError}
          edgesLoading={edgesLoading}
        />
      ) : (
        <MultiStopPanel
          startId={multiStart}
          selectedStops={selectedStops}
          onStartChange={handleStartChange}
          onToggleStop={handleToggleStop}
          onCalculate={handleCalculateMulti}
          onReset={handleResetMulti}
          result={multiResult}
          hasError={multiError}
          edgesLoading={edgesLoading}
        />
      )}
    </div>
  );
}