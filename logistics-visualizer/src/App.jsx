// App.jsx
import { useState, useMemo, useCallback, useEffect } from "react";
import "leaflet/dist/leaflet.css";
import MapVisualizer from "./components/MapVisualizer";
import ControlPanel from "./components/ControlPanel";
import MultiStopPanel from "./components/MultiStopPanel";
import ComparisonPanel from "./components/ComparisonPanel";
import { fetchGraph, calculateShortest, calculateMultiStop, compareRoutes } from "./services/api";
import { enrichEdgesWithRoadData } from "./utils/osrmService";

// ── helpers ────────────────────────────────────────────────────────────────────

/** Sum durationMin for every hop in `path` using liveEdges. Returns null if any hop is unknown. */
function computePathDuration(path, liveEdges) {
  if (!path || path.length < 2 || !liveEdges || liveEdges.length === 0) return null;
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const edge = liveEdges.find(
      (e) => (e.source === a && e.target === b) || (e.target === a && e.source === b)
    );
    if (!edge || edge.durationMin == null) return null;
    total += edge.durationMin;
  }
  return total;
}

// ── main component ─────────────────────────────────────────────────────────────

export default function App() {
  const [mode, setMode] = useState("single"); // "single" | "multi" | "compare"

  // --- dark mode ---
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

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

  // Compute ETA for single result whenever result or liveEdges change
  const singleDuration = useMemo(
    () => singleResult ? computePathDuration(singleResult.path, liveEdges) : null,
    [singleResult, liveEdges]
  );

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

  // --- compare-routes state ---
  const [compareSource, setCompareSource] = useState("");
  const [compareDest, setCompareDest] = useState("");
  const [compareResults, setCompareResults] = useState(null); // Array<{path, distance}>
  const [compareError, setCompareError] = useState(false);
  const [compareLoading, setCompareLoading] = useState(false);

  // Set default compare source/destination once warehouses load
  useEffect(() => {
    if (warehouses.length >= 2) {
      setCompareSource((prev) => prev || warehouses[0].id);
      setCompareDest((prev) => prev || warehouses[1].id);
    }
  }, [warehouses]);

  const handleCompareSourceChange = useCallback((id) => {
    setCompareSource(id);
    setCompareResults(null);
    setCompareError(false);
  }, []);

  const handleCompareDestChange = useCallback((id) => {
    setCompareDest(id);
    setCompareResults(null);
    setCompareError(false);
  }, []);

  const handleCompare = useCallback(async () => {
    try {
      setCompareLoading(true);
      setCompareError(false);
      const outcome = await compareRoutes(compareSource, compareDest);
      setCompareResults(outcome.routes);
    } catch {
      setCompareResults(null);
      setCompareError(true);
    } finally {
      setCompareLoading(false);
    }
  }, [compareSource, compareDest]);

  const handleResetCompare = useCallback(() => {
    if (warehouses.length >= 2) {
      setCompareSource(warehouses[0].id);
      setCompareDest(warehouses[1].id);
    }
    setCompareResults(null);
    setCompareError(false);
  }, [warehouses]);

  // Enrich compareResults with per-route durationMin from liveEdges
  const compareResultsWithDuration = useMemo(() => {
    if (!compareResults) return null;
    return compareResults.map((r) => ({
      ...r,
      durationMin: computePathDuration(r.path, liveEdges),
    }));
  }, [compareResults, liveEdges]);

  // --- derived path passed to the map, depending on active mode ---
  const highlightedPath = useMemo(() => {
    if (mode === "single") return singleResult?.path ?? null;
    if (mode === "multi") return multiResult?.path ?? null;
    return null; // compare mode uses comparisonPaths instead
  }, [mode, singleResult, multiResult]);

  // In compare mode, highlight Route 1 (recommended) for the vehicle animation
  const vehiclePath = useMemo(() => {
    if (mode === "compare" && compareResults && compareResults.length > 0) {
      return compareResults[0].path;
    }
    return highlightedPath;
  }, [mode, compareResults, highlightedPath]);

  // --- comparison paths for the map (only in compare mode) ---
  const comparisonPaths = useMemo(() => {
    if (mode === "compare") return compareResults ?? null;
    return null;
  }, [mode, compareResults]);

  // --- loading state while graph is being fetched ---
  if (graphLoading) {
    return (
      <div className="flex items-center justify-center w-screen h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="inline-block h-8 w-8 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin mb-4" />
          <p className="text-gray-600 dark:text-gray-300 text-sm">Loading warehouse network…</p>
        </div>
      </div>
    );
  }

  if (graphError) {
    return (
      <div className="flex items-center justify-center w-screen h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center max-w-md">
          <p className="text-red-600 font-medium mb-2">Failed to load graph data</p>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">{graphError}</p>
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
        vehiclePath={vehiclePath}
        comparisonPaths={comparisonPaths}
        edges={liveEdges}
        warehouses={warehouses}
        warehouseMap={warehouseMap}
        isDark={isDark}
      />

      {/* Top-right controls row: dark-mode toggle + mode tabs */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        {/* Dark mode toggle */}
        <button
          onClick={() => setIsDark((d) => !d)}
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/90 dark:bg-gray-800/90 backdrop-blur-md shadow-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          {isDark ? (
            // Sun icon
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zm11.893-7.393a.75.75 0 011.06 1.06l-1.59 1.591a.75.75 0 11-1.06-1.06l1.59-1.591zm-14.786 0a.75.75 0 010 1.06L3.016 7.258a.75.75 0 01-1.06-1.06l1.59-1.591a.75.75 0 011.061 0zM21 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H20.25A.75.75 0 0121 12zM3.75 12a.75.75 0 01-.75.75H.75a.75.75 0 010-1.5H3a.75.75 0 01.75.75zm15.803 7.393a.75.75 0 01-1.06-1.06l1.59-1.59a.75.75 0 011.06 1.06l-1.59 1.59zM4.197 19.393a.75.75 0 010-1.06l1.59-1.59a.75.75 0 011.061 1.06l-1.59 1.59a.75.75 0 01-1.06 0zM12 18a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18z" />
            </svg>
          ) : (
            // Moon icon
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd" />
            </svg>
          )}
        </button>

        {/* Mode tabs */}
        <div className="flex rounded-xl bg-white/90 dark:bg-gray-800/90 backdrop-blur-md shadow-lg border border-gray-200 dark:border-gray-700 p-1 text-sm">
          <button
            onClick={() => setMode("single")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              mode === "single" ? "bg-blue-600 text-white" : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
          >
            Single Route
          </button>
          <button
            onClick={() => setMode("multi")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              mode === "multi" ? "bg-blue-600 text-white" : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
          >
            Multi-Stop
          </button>
          <button
            onClick={() => setMode("compare")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              mode === "compare" ? "bg-indigo-600 text-white" : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
          >
            Compare Routes
          </button>
        </div>
      </div>

      {mode === "single" && (
        <ControlPanel
          warehouses={warehouses}
          source={source}
          destination={destination}
          onSourceChange={handleSourceChange}
          onDestinationChange={handleDestinationChange}
          onCalculate={handleCalculateSingle}
          onReset={handleResetSingle}
          result={singleResult}
          durationMin={singleDuration}
          hasError={singleError}
          isLoading={singleLoading}
          edgesLoading={edgesLoading}
          isDark={isDark}
        />
      )}
      {mode === "multi" && (
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
          isDark={isDark}
        />
      )}
      {mode === "compare" && (
        <ComparisonPanel
          warehouses={warehouses}
          source={compareSource}
          destination={compareDest}
          onSourceChange={handleCompareSourceChange}
          onDestinationChange={handleCompareDestChange}
          onCompare={handleCompare}
          onReset={handleResetCompare}
          routes={compareResultsWithDuration}
          hasError={compareError}
          isLoading={compareLoading}
          edgesLoading={edgesLoading}
          warehouseMap={warehouseMap}
          isDark={isDark}
        />
      )}
    </div>
  );
}