import { AfterViewInit, Component, ElementRef, OnChanges, OnDestroy, SimpleChanges, input, signal, viewChild } from '@angular/core';
import type { TrackingEvent } from '../tracking.model';
import { environment } from '../../../environments/environment';

type Position = [number, number];
interface GeoJsonLine {
  type: 'Feature';
  geometry: { type: 'LineString'; coordinates: Position[] };
  properties: Record<string, never>;
}
interface GeoJsonCollection {
  type: 'FeatureCollection';
  features: GeoJsonLine[];
}
interface GeoJsonSource { setData(data: GeoJsonCollection): void; }
interface MapboxMap {
  on(event: 'load', callback: () => void): void;
  addSource(id: string, source: { type: 'geojson'; data: GeoJsonCollection }): void;
  addLayer(layer: Record<string, unknown>): void;
  getSource(id: string): GeoJsonSource | undefined;
  flyTo(options: { center: Position; zoom?: number; essential?: boolean }): void;
  fitBounds(bounds: { extend(position: Position): unknown }, options: { padding: number; maxZoom: number }): void;
  remove(): void;
  addControl(control: unknown, position?: string): void;
}
interface MapboxMarker {
  setLngLat(position: Position): MapboxMarker;
  addTo(map: MapboxMap): MapboxMarker;
  remove(): void;
}
interface MapboxGlobal {
  accessToken: string;
  Map: new (options: Record<string, unknown>) => MapboxMap;
  Marker: new (options?: Record<string, unknown>) => MapboxMarker;
  NavigationControl: new () => unknown;
  LngLatBounds: new () => { extend(position: Position): unknown };
}
declare global { interface Window { mapboxgl?: MapboxGlobal; } }

@Component({
  selector: 'app-live-order-map',
  template: `
    <div class="live-map" #mapContainer role="region" aria-label="Interactive live delivery map"></div>
    @if (mapError()) {
      <p class="live-map__message" role="status">{{ mapError() }}</p>
    }
  `,
  styles: [`
    :host { display: block; }
    .live-map { width: 100%; height: 420px; min-height: 280px; border-radius: .6rem; overflow: hidden; background: #edf3ee; }
    .live-map__message { margin: .55rem 0 0; color: #626b63; font-size: .82rem; }
    @media (max-width: 560px) { .live-map { height: 320px; } }
  `],
})
export class LiveOrderMap implements AfterViewInit, OnChanges, OnDestroy {
  readonly events = input<TrackingEvent[]>([]);
  protected readonly mapError = signal<string | null>(null);
  private readonly mapContainer = viewChild.required<ElementRef<HTMLDivElement>>('mapContainer');
  private map: MapboxMap | null = null;
  private marker: MapboxMarker | null = null;
  private initialized = false;
  private lastLocationKey = '';

  ngAfterViewInit(): void {
    const mapbox = window.mapboxgl;
    const token = environment.mapboxAccessToken?.trim();
    if (!mapbox || !token) {
      this.mapError.set('The interactive Mapbox map could not be loaded. Check the Mapbox connection and token.');
      return;
    }
    mapbox.accessToken = token;
    this.map = new mapbox.Map({
      container: this.mapContainer().nativeElement,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [36.8219, -1.2921],
      zoom: 9,
    });
    this.map.addControl(new mapbox.NavigationControl(), 'top-right');
    this.map.on('load', () => {
      this.map?.addSource('delivery-route', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      this.map?.addLayer({
        id: 'delivery-route-line', type: 'line', source: 'delivery-route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#16803c', 'line-width': 5, 'line-opacity': 0.85 },
      });
      this.initialized = true;
      this.updateRoute();
    });
  }

  ngOnChanges(_changes: SimpleChanges): void {
    this.updateRoute();
  }

  ngOnDestroy(): void {
    this.marker?.remove();
    this.map?.remove();
  }

  private updateRoute(): void {
    if (!this.initialized || !this.map) return;
    const points = this.events()
      .filter((event) => event.latitude != null && event.longitude != null
        && Number.isFinite(event.latitude) && Number.isFinite(event.longitude)
        && Math.abs(event.latitude) <= 90 && Math.abs(event.longitude) <= 180)
      .sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime());
    const coordinates = points.map((event): Position => [event.longitude!, event.latitude!]);
    this.map.getSource('delivery-route')?.setData({
      type: 'FeatureCollection',
      features: coordinates.length > 1
        ? [{ type: 'Feature', geometry: { type: 'LineString', coordinates }, properties: {} }]
        : [],
    });
    const latest = points.at(-1);
    if (!latest) return;
    const position: Position = [latest.longitude!, latest.latitude!];
    if (!this.marker) {
      this.marker = new window.mapboxgl!.Marker({ color: '#0d5632' }).setLngLat(position).addTo(this.map);
    } else {
      this.marker.setLngLat(position);
    }
    const locationKey = `${latest.id}:${latest.latitude}:${latest.longitude}`;
    if (locationKey !== this.lastLocationKey) {
      this.lastLocationKey = locationKey;
      if (coordinates.length > 1) {
        const bounds = new window.mapboxgl!.LngLatBounds();
        coordinates.forEach((coordinate) => bounds.extend(coordinate));
        this.map.fitBounds(bounds, { padding: 64, maxZoom: 14 });
      } else {
        this.map.flyTo({ center: position, zoom: 14, essential: true });
      }
    }
  }
}
