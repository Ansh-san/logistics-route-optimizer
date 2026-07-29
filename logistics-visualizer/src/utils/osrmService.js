// osrmService.js
// Thin wrapper around the public OSRM demo API.
// Kept isolated so it's a single file to swap out if you later
// self-host OSRM or move to a paid routing provider (Mapbox, HERE, etc.)

const OSRM_BASE_URL = "https://router.project-osrm.org/route/v1/driving";

/**
 * Fetches real road-network route between two lat/lng points.
 * @param {{lat: number, lng: number}} from
 * @param {{lat: number, lng: number}} to
 * @returns {Promise<{distanceKm: number, durationMin: number, geometry: [number, number][]} | null>}
 *          geometry is an array of [lat, lng] pairs for the actual road path.
 */
export async function fetchRoadRoute(from, to) {
  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const url = `${OSRM_BASE_URL}/${coords}?overview=full&geometries=geojson`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error("OSRM request failed:", response.status);
      return null;
    }

    const data = await response.json();
    if (data.code !== "Ok" || !data.routes?.length) {
      console.error("OSRM returned no route:", data.code);
      return null;
    }

    const route = data.routes[0];

    // GeoJSON coords are [lng, lat] — flip to [lat, lng] for Leaflet
    const geometry = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

    return {
      distanceKm: Math.round(route.distance / 1000),
      durationMin: Math.round(route.duration / 60),
      geometry,
    };
  } catch (err) {
    console.error("OSRM fetch error:", err);
    return null;
  }
}

/**
 * Fetches road routes for every edge in the graph, in parallel.
 * Returns edges enriched with real distance + road geometry.
 * Falls back to the original static distance/straight line if a
 * particular OSRM call fails, so the app never fully breaks.
 */
export async function enrichEdgesWithRoadData(edges, warehouseMap) {
  const results = await Promise.all(
    edges.map(async (edge) => {
      const source = warehouseMap[edge.source];
      const target = warehouseMap[edge.target];
      const road = await fetchRoadRoute(source, target);

      if (!road) {
        return {
          ...edge,
          geometry: [[source.lat, source.lng], [target.lat, target.lng]],
          durationMin: null,
          isFallback: true,
        };
      }

      return {
        ...edge,
        distance: road.distanceKm, // overwrite static estimate with real road km
        geometry: road.geometry,
        durationMin: road.durationMin,
        isFallback: false,
      };
    })
  );

  return results;
}