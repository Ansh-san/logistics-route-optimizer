// ComparisonPanel.jsx
import { memo } from "react";

const ROUTE_COLORS = [
  { label: "Route 1", border: "border-blue-300 dark:border-blue-700", bg: "bg-blue-50 dark:bg-blue-900/30", badge: "bg-blue-600", text: "text-blue-700 dark:text-blue-300", dot: "#2563eb" },
  { label: "Route 2", border: "border-purple-300 dark:border-purple-700", bg: "bg-purple-50 dark:bg-purple-900/30", badge: "bg-purple-600", text: "text-purple-700 dark:text-purple-300", dot: "#7c3aed" },
];

/** Formats durationMin → "Xh Ym" */
function formatDuration(mins) {
  if (mins == null) return null;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function ComparisonPanel({
  warehouses,
  source,
  destination,
  onSourceChange,
  onDestinationChange,
  onCompare,
  onReset,
  routes,       // Array<{path: string[], distance: number, durationMin: number|null}> | null
  hasError,
  isLoading,
  edgesLoading,
  warehouseMap,
  isDark,
}) {
  return (
    <div className="absolute top-4 left-4 z-10 w-80 rounded-2xl bg-white/90 dark:bg-gray-800/90 backdrop-blur-md shadow-xl border border-gray-200 dark:border-gray-700 p-5 max-h-[calc(100vh-2rem)] overflow-y-auto">
      <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-1">Compare Routes</h1>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Top 2 alternate shortest paths between two cities</p>

      {edgesLoading && (
        <div className="mb-3 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 px-3 py-2 text-xs text-gray-500 dark:text-gray-300 flex items-center gap-2">
          <span className="inline-block h-3 w-3 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
          Fetching real road distances…
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Source</label>
          <select
            value={source}
            onChange={(e) => onSourceChange(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Destination</label>
          <select
            value={destination}
            onChange={(e) => onDestinationChange(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onCompare}
            disabled={source === destination || isLoading}
            className="flex-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 transition-colors"
          >
            {isLoading ? "Computing…" : "Compare Routes"}
          </button>
          <button
            onClick={onReset}
            className="rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm font-medium px-3 transition-colors"
            title="Reset selection"
          >
            Reset
          </button>
        </div>
      </div>

      {hasError && (
        <div className="mt-4 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          No routes found between these warehouses.
        </div>
      )}

      {routes && routes.length > 0 && !hasError && (
        <div className="mt-4 space-y-3">
          {/* Legend */}
          <div className="flex items-center gap-3 px-1">
            {routes.map((_, idx) => {
              const color = ROUTE_COLORS[idx];
              if (!color) return null;
              return (
                <div key={idx} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                  <span
                    className="inline-block w-4 h-1.5 rounded-full"
                    style={{ background: color.dot }}
                  />
                  {color.label}
                </div>
              );
            })}
          </div>

          {routes.map((route, idx) => {
            const color = ROUTE_COLORS[idx] ?? ROUTE_COLORS[0];
            const isRecommended = idx === 0;
            const cityNames = route.path.map((id) => warehouseMap[id]?.name ?? id);
            const eta = formatDuration(route.durationMin);

            return (
              <div
                key={idx}
                className={`rounded-xl border ${color.border} ${color.bg} px-3 py-3`}
              >
                {/* Header row */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-semibold text-white px-2 py-0.5 rounded-full ${color.badge}`}
                    >
                      {color.label}
                    </span>
                    {isRecommended && (
                      <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-300 dark:border-emerald-700 px-2 py-0.5 rounded-full">
                        ✓ Recommended
                      </span>
                    )}
                  </div>
                  <span className={`text-sm font-bold ${color.text}`}>
                    {route.distance.toLocaleString()} km
                  </span>
                </div>

                {/* Stats */}
                <div className="flex gap-3 text-xs text-gray-500 dark:text-gray-400 mb-2">
                  <span>{route.path.length - 1} hop{route.path.length !== 2 ? "s" : ""}</span>
                  <span>·</span>
                  <span>{route.path.length} cities</span>
                  {eta && (
                    <>
                      <span>·</span>
                      <span>~{eta}</span>
                    </>
                  )}
                </div>

                {/* Path */}
                <div className={`text-xs ${color.text} leading-relaxed break-words`}>
                  {cityNames.join(" → ")}
                </div>
              </div>
            );
          })}

          {routes.length === 1 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
              Only one distinct path exists between these cities.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(ComparisonPanel);
