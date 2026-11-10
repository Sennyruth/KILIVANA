export interface DispatchCoordinates {
  latitude: number;
  longitude: number;
}

export function hasValidDispatchCoordinates(location: {
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}): boolean {
  return Boolean(location.address?.trim())
    && location.latitude != null
    && Number.isFinite(location.latitude)
    && Math.abs(location.latitude) <= 90
    && location.longitude != null
    && Number.isFinite(location.longitude)
    && Math.abs(location.longitude) <= 180;
}

export function getCurrentCoordinates(): Promise<DispatchCoordinates> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Location is not available in this browser. Enter coordinates manually.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      () => reject(new Error('Could not access your location. Check browser permissions or enter coordinates manually.')),
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 15_000 },
    );
  });
}
