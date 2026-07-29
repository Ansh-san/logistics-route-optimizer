// ControlPanel.jsx
import { memo } from "react";

function ControlPanel({
  warehouses,
  source,
  destination,
  onSourceChange,
  onDestinationChange,
  onCalculate,
  onReset,
  result,
  hasError,
  isLoading,
  edgesLoading,
}) {
  return (
    <div className="absolute top-4 left-4 z-10 w-80 rounded-2xl bg-white/90 backdrop-blur-md shadow-xl border border-gray-200 p-5">
      <h1 className="text-lg font-semibold text-gray-800 mb-1">Route Optimizer</h1>
      <p className="text-xs text-gray-500 mb-4">Shortest path across the warehouse network</p>

      {edgesLoading && (
        <div className="mb-3 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-xs text-gray-500 flex items-center gap-2">
          <span className="inline-block h-3 w-3 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
          Fetching real road distances…
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Source</label>
          <select
            value={source}
            onChange={(e) => onSourceChange(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Destination</label>
          <select
            value={destination}
            onChange={(e) => onDestinationChange(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onCalculate}
            disabled={source === destination || isLoading}
            className="flex-1 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 transition-colors"
          >
            {isLoading ? "Computing…" : "Calculate Optimal Route"}
          </button>
          <button
            onClick={onReset}
            className="rounded-lg border border-gray-300 hover:bg-gray-100 text-gray-600 text-sm font-medium px-3 transition-colors"
            title="Reset selection"
          >
            Reset
          </button>
        </div>
      </div>

      {hasError && (
        <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          No route found between these warehouses.
        </div>
      )}

      {result && !hasError && (
        <div className="mt-4 rounded-lg bg-blue-50 border border-blue-200 px-3 py-3 text-sm">
          <div className="flex justify-between text-gray-700">
            <span>Total Distance</span>
            <span className="font-semibold text-blue-700">{result.distance.toLocaleString()} km</span>
          </div>
          <div className="mt-1 text-xs text-gray-500 truncate">{result.path.join(" → ")}</div>
        </div>
      )}
    </div>
  );
}

export default memo(ControlPanel);