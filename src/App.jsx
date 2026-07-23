// App.jsx
import { useState, useMemo } from "react";
import "leaflet/dist/leaflet.css";
import MapVisualizer from "./components/MapVisualizer";
import ControlPanel from "./components/ControlPanel";
import { warehouses, edges } from "./data/data";
import { findShortestPath } from "./utils/routingUtils";

export default function App() {
  const [source, setSource] = useState(warehouses[0].id);
  const [destination, setDestination] = useState(warehouses[1].id);
  const [result, setResult] = useState(null);
  const [hasError, setHasError] = useState(false);

  const handleCalculate = () => {
    const outcome = findShortestPath(warehouses, edges, source, destination);
    if (!outcome) {
      setResult(null);
      setHasError(true);
      return;
    }
    setHasError(false);
    setResult(outcome);
  };

  const handleReset = () => {
    setSource(warehouses[0].id);
    setDestination(warehouses[1].id);
    setResult(null);
    setHasError(false);
  };

  const highlightedPath = useMemo(() => result?.path ?? null, [result]);

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      <MapVisualizer highlightedPath={highlightedPath} />
      <ControlPanel
        source={source}
        destination={destination}
        onSourceChange={(id) => {
          setSource(id);
          setResult(null);
          setHasError(false);
        }}
        onDestinationChange={(id) => {
          setDestination(id);
          setResult(null);
          setHasError(false);
        }}
        onCalculate={handleCalculate}
        onReset={handleReset}
        result={result}
        hasError={hasError}
      />
    </div>
  );
}