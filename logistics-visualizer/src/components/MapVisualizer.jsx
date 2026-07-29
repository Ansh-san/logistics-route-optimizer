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

function FitBoundsOnPath({ pathNodeIds, warehouseMap }) {
  const map = useMap();

  useEffect(() => {
    if (!pathNodeIds || pathNodeIds.length === 0) return;
    const latLngs = pathNodeIds.map((id) => {
      const w = warehouseMap[id];
      return [w.lat, w.lng];
    });
    map.fitBounds(latLngs, { padding: [60, 60] });
  }, [pathNodeIds, map, warehouseMap]);

  return null;
}

/**
 * Progressively reveals the highlighted path's polyline segments,
 * rather than snapping the full route in at once.
 */
function useAnimatedPath(pathNodeIds) {
  const [visibleCount, setVisibleCount] = useState(0);
  const frameRef = useRef(null);

  useEffect(() => {
    if (!pathNodeIds || pathNodeIds.length < 2) {
      setVisibleCount(0);
      return;
    }

    const totalSegments = pathNodeIds.length - 1;
    const start = performance.now();

    const step = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / ANIMATION_DURATION_MS, 1);
      setVisibleCount(Math.ceil(progress * totalSegments));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step);
      }
    };

    setVisibleCount(0);
    frameRef.current = requestAnimationFrame(step);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [pathNodeIds]);

  return visibleCount;
}

function MapVisualizer({ highlightedPath, edges, warehouses, warehouseMap }) {
  const [tileError, setTileError] = useState(false);
  const visibleSegments = useAnimatedPath(highlightedPath);

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
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          eventHandlers={{
            tileerror: () => setTileError(true),
            tileload: () => setTileError(false),
          }}
        />

        {edges.map((edge) => {
          const source = warehouseMap[edge.source];
          const target = warehouseMap[edge.target];
          if (!source || !target) return null;
          const isHighlighted = pathEdgeKeys.has(`${edge.source}-${edge.target}`);

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
                opacity: isHighlighted ? 0.25 : 0.5,
              }}
            />
          );
        })}

        {highlightedPath &&
          highlightedPath.length > 1 &&
          highlightedPath.slice(0, -1).map((nodeId, i) => {
            if (i >= visibleSegments) return null;
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

        <FitBoundsOnPath pathNodeIds={highlightedPath} warehouseMap={warehouseMap} />
      </MapContainer>
    </div>
  );
}

export default memo(MapVisualizer);