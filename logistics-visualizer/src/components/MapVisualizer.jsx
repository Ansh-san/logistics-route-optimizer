// MapVisualizer.jsx
import { useEffect, useRef, useState, useMemo, memo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const INDIA_CENTER = [22.3511, 78.6677];
const DEFAULT_ZOOM = 5;
const ANIMATION_DURATION_MS = 900;

// Tile configurations
const TILE_LIGHT = {
  url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
};
const TILE_DARK = {
  url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  attribution: '&copy; OpenStreetMap contributors &copy; <a href="https://carto.com/">CARTO</a>',
};

// Distinct colors for each compared path
const COMPARISON_COLORS = [
  { stroke: "#2563eb", weight: 5, opacity: 0.9 }, // Route 1 — blue
  { stroke: "#7c3aed", weight: 5, opacity: 0.9 }, // Route 2 — purple
];

// ── Truck DivIcon ──────────────────────────────────────────────────────────────

const TRUCK_ICON = L.divIcon({
  className: "",
  html: `<div style="
    font-size: 28px;
    line-height: 1;
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
    transform: translate(-50%, -50%);
    pointer-events: none;
    user-select: none;
  ">🚚</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Builds a flat array of [lat, lng] points by walking the path node-by-node
 * and appending each edge's road geometry (or straight fallback).
 */
function buildFullGeometry(path, edges, warehouseMap) {
  if (!path || path.length < 2) return [];

  const points = [];
  for (let i = 0; i < path.length - 1; i++) {
    const nodeId = path[i];
    const nextId = path[i + 1];

    const matchingEdge = edges.find(
      (e) =>
        (e.source === nodeId && e.target === nextId) ||
        (e.source === nextId && e.target === nodeId)
    );

    let segment;
    if (matchingEdge?.geometry) {
      segment =
        matchingEdge.source === nodeId
          ? matchingEdge.geometry
          : [...matchingEdge.geometry].reverse();
    } else {
      const src = warehouseMap[nodeId];
      const tgt = warehouseMap[nextId];
      segment = [
        [src.lat, src.lng],
        [tgt.lat, tgt.lng],
      ];
    }

    // Avoid duplicating the junction point between consecutive segments
    if (i === 0) {
      points.push(...segment);
    } else {
      points.push(...segment.slice(1));
    }
  }
  return points;
}

/**
 * Linearly interpolates a position along a polyline geometry at a given
 * fraction [0–1] of its total length.
 */
function interpolateAlongGeometry(geometry, fraction) {
  if (!geometry || geometry.length === 0) return null;
  if (geometry.length === 1) return geometry[0];
  if (fraction <= 0) return geometry[0];
  if (fraction >= 1) return geometry[geometry.length - 1];

  // Compute cumulative segment lengths
  const lengths = [0];
  for (let i = 1; i < geometry.length; i++) {
    const [lat1, lng1] = geometry[i - 1];
    const [lat2, lng2] = geometry[i];
    const dl = Math.sqrt((lat2 - lat1) ** 2 + (lng2 - lng1) ** 2);
    lengths.push(lengths[i - 1] + dl);
  }
  const totalLen = lengths[lengths.length - 1];
  const target = fraction * totalLen;

  for (let i = 1; i < lengths.length; i++) {
    if (lengths[i] >= target) {
      const segStart = lengths[i - 1];
      const segEnd = lengths[i];
      const t = segEnd === segStart ? 0 : (target - segStart) / (segEnd - segStart);
      const [lat1, lng1] = geometry[i - 1];
      const [lat2, lng2] = geometry[i];
      return [lat1 + t * (lat2 - lat1), lng1 + t * (lng2 - lng1)];
    }
  }
  return geometry[geometry.length - 1];
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function FitBoundsOnPath({ pathNodeIds, comparisonPaths, warehouseMap }) {
  const map = useMap();

  useEffect(() => {
    // Single highlighted path
    if (pathNodeIds && pathNodeIds.length > 0) {
      const latLngs = pathNodeIds.map((id) => {
        const w = warehouseMap[id];
        return [w.lat, w.lng];
      });
      map.fitBounds(latLngs, { padding: [60, 60] });
      return;
    }

    // Comparison paths: fit all nodes across all routes
    if (comparisonPaths && comparisonPaths.length > 0) {
      const latLngs = comparisonPaths.flatMap((route) =>
        route.path.map((id) => {
          const w = warehouseMap[id];
          return [w.lat, w.lng];
        })
      );
      if (latLngs.length > 0) {
        map.fitBounds(latLngs, { padding: [60, 60] });
      }
    }
  }, [pathNodeIds, comparisonPaths, map, warehouseMap]);

  return null;
}

/** Swaps TileLayer URL in-place without re-mounting the map */
function DynamicTileLayer({ isDark, onTileError, onTileLoad }) {
  const tile = isDark ? TILE_DARK : TILE_LIGHT;
  return (
    <TileLayer
      key={tile.url} // key change forces Leaflet to reload tiles on theme swap
      attribution={tile.attribution}
      url={tile.url}
      eventHandlers={{
        tileerror: onTileError,
        tileload: onTileLoad,
      }}
    />
  );
}

/**
 * Progressively reveals the highlighted path's polyline segments,
 * rather than snapping the full route in at once.
 * Returns { visibleCount, progress } so callers can derive vehicle position.
 */
function useAnimatedPath(pathNodeIds) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [progress, setProgress] = useState(0);
  const frameRef = useRef(null);

  useEffect(() => {
    if (!pathNodeIds || pathNodeIds.length < 2) {
      setVisibleCount(0);
      setProgress(0);
      return;
    }

    const totalSegments = pathNodeIds.length - 1;
    const start = performance.now();

    const step = (now) => {
      const elapsed = now - start;
      const p = Math.min(elapsed / ANIMATION_DURATION_MS, 1);
      setProgress(p);
      setVisibleCount(Math.ceil(p * totalSegments));
      if (p < 1) {
        frameRef.current = requestAnimationFrame(step);
      }
    };

    setVisibleCount(0);
    setProgress(0);
    frameRef.current = requestAnimationFrame(step);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [pathNodeIds]);

  return { visibleCount, progress };
}

// ── Main component ─────────────────────────────────────────────────────────────

function MapVisualizer({
  highlightedPath,
  vehiclePath,   // path used to drive the truck icon (= highlightedPath or compare route 0)
  comparisonPaths,
  edges,
  warehouses,
  warehouseMap,
  isDark,
}) {
  const [tileError, setTileError] = useState(false);

  const { visibleCount: visibleSegs } = useAnimatedPath(highlightedPath);
  const { progress: animProgress } = useAnimatedPath(vehiclePath);

  // Full flattened geometry of the vehicle path (for truck interpolation)
  const vehicleGeometry = useMemo(
    () => buildFullGeometry(vehiclePath, edges, warehouseMap),
    [vehiclePath, edges, warehouseMap]
  );

  // Current truck position along the vehicle geometry
  const truckPosition = useMemo(() => {
    if (!vehiclePath || vehiclePath.length < 2) return null;
    if (vehicleGeometry.length === 0) return null;
    return interpolateAlongGeometry(vehicleGeometry, animProgress);
  }, [vehicleGeometry, animProgress, vehiclePath]);

  const pathEdgeKeys = useMemo(() => {
    const keys = new Set();
    if (highlightedPath && highlightedPath.length > 1) {
      for (let i = 0; i < highlightedPath.length - 1; i++) {
        keys.add(`${highlightedPath[i]}-${highlightedPath[i + 1]}`);
        keys.add(`${highlightedPath[i + 1]}-${highlightedPath[i]}`);
      }
    }
    return keys;
  }, [highlightedPath]);

  // Build a set of edge keys that are in any comparison path (for dimming others)
  const comparisonEdgeKeys = useMemo(() => {
    const keys = new Set();
    if (comparisonPaths && comparisonPaths.length > 0) {
      for (const route of comparisonPaths) {
        for (let i = 0; i < route.path.length - 1; i++) {
          keys.add(`${route.path[i]}-${route.path[i + 1]}`);
          keys.add(`${route.path[i + 1]}-${route.path[i]}`);
        }
      }
    }
    return keys;
  }, [comparisonPaths]);

  const inCompareMode = comparisonPaths !== null && comparisonPaths !== undefined;

  return (
    <div className="absolute inset-0 z-0">
      {tileError && (
        <div className="absolute top-4 right-4 z-20 rounded-lg bg-amber-50 border border-amber-300 px-3 py-2 text-xs text-amber-800 shadow-md">
          Map tiles failed to load. Check your network connection.
        </div>
      )}

      <MapContainer
        center={INDIA_CENTER}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom={true}
        className="w-full h-full"
      >
        <DynamicTileLayer
          isDark={isDark}
          onTileError={() => setTileError(true)}
          onTileLoad={() => setTileError(false)}
        />

        {edges.map((edge) => {
          const source = warehouseMap[edge.source];
          const target = warehouseMap[edge.target];
          if (!source || !target) return null;
          const isHighlighted = pathEdgeKeys.has(`${edge.source}-${edge.target}`);
          const isCompared = comparisonEdgeKeys.has(`${edge.source}-${edge.target}`);

          // Use road geometry if available, otherwise straight line
          const positions = edge.geometry || [
            [source.lat, source.lng],
            [target.lat, target.lng],
          ];

          return (
            <Polyline
              key={`${edge.source}-${edge.target}`}
              positions={positions}
              pathOptions={{
                color: isHighlighted ? "#2563eb" : "#9ca3af",
                weight: isHighlighted ? 2 : 1.5,
                opacity: inCompareMode
                  ? isCompared ? 0.35 : 0.2
                  : isHighlighted ? 0.25 : 0.5,
              }}
            />
          );
        })}

        {highlightedPath &&
          highlightedPath.length > 1 &&
          highlightedPath.slice(0, -1).map((nodeId, i) => {
            if (i >= visibleSegs) return null;
            const nextId = highlightedPath[i + 1];

            // Find the matching edge to use its road geometry
            const matchingEdge = edges.find(
              (e) =>
                (e.source === nodeId && e.target === nextId) ||
                (e.source === nextId && e.target === nodeId)
            );

            let positions;
            if (matchingEdge?.geometry) {
              // If the edge is reversed relative to the path direction, reverse the geometry
              positions =
                matchingEdge.source === nodeId
                  ? matchingEdge.geometry
                  : [...matchingEdge.geometry].reverse();
            } else {
              const src = warehouseMap[nodeId];
              const tgt = warehouseMap[nextId];
              positions = [
                [src.lat, src.lng],
                [tgt.lat, tgt.lng],
              ];
            }

            return (
              <Polyline
                key={`highlight-${nodeId}-${nextId}`}
                positions={positions}
                pathOptions={{ color: "#2563eb", weight: 5, opacity: 0.9 }}
              />
            );
          })}

        {warehouses.map((w) => (
          <Marker key={w.id} position={[w.lat, w.lng]}>
            <Popup>
              <strong>{w.name}</strong>
              <br />
              Warehouse Node
            </Popup>
          </Marker>
        ))}

        {/* Comparison paths: draw each route in its own color */}
        {inCompareMode &&
          comparisonPaths.map((route, routeIdx) => {
            const colorOpts = COMPARISON_COLORS[routeIdx] ?? COMPARISON_COLORS[0];
            return route.path.slice(0, -1).map((nodeId, i) => {
              const nextId = route.path[i + 1];

              const matchingEdge = edges.find(
                (e) =>
                  (e.source === nodeId && e.target === nextId) ||
                  (e.source === nextId && e.target === nodeId)
              );

              let positions;
              if (matchingEdge?.geometry) {
                positions =
                  matchingEdge.source === nodeId
                    ? matchingEdge.geometry
                    : [...matchingEdge.geometry].reverse();
              } else {
                const src = warehouseMap[nodeId];
                const tgt = warehouseMap[nextId];
                positions = [
                  [src.lat, src.lng],
                  [tgt.lat, tgt.lng],
                ];
              }

              return (
                <Polyline
                  key={`compare-${routeIdx}-${nodeId}-${nextId}`}
                  positions={positions}
                  pathOptions={{
                    color: colorOpts.stroke,
                    weight: colorOpts.weight,
                    opacity: colorOpts.opacity,
                  }}
                />
              );
            });
          })}

        {/* Animated truck icon along the route */}
        {truckPosition && (
          <Marker
            key="truck"
            position={truckPosition}
            icon={TRUCK_ICON}
            zIndexOffset={1000}
          />
        )}

        <FitBoundsOnPath
          pathNodeIds={highlightedPath}
          comparisonPaths={comparisonPaths}
          warehouseMap={warehouseMap}
        />
      </MapContainer>
    </div>
  );
}

export default memo(MapVisualizer);