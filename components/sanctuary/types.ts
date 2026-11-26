export type AtmosphereMode = 'sunset' | 'night';

export type ViewpointId = 'overview' | 'observatory' | 'bridge' | 'waterfall';

export interface ViewpointConfig {
  id: ViewpointId;
  label: string;
  position: [number, number, number];
  target: [number, number, number];
}

export const VIEWPOINTS: ViewpointConfig[] = [
  {
    id: 'overview',
    label: 'Sanctuary',
    position: [13.5, 7.6, 17.5],
    target: [0.0, 0.8, 0.2],
  },
  {
    id: 'observatory',
    label: 'Observatory',
    position: [-8.6, 7.4, 7.2],
    target: [-2.1, 4.9, -1.5],
  },
  {
    id: 'bridge',
    label: 'Bridge',
    position: [6.4, 3.6, 8.8],
    target: [0.25, 1.15, 2.2],
  },
  {
    id: 'waterfall',
    label: 'Waterfall',
    position: [7.8, -0.6, 15.2],
    target: [0.6, -1.6, 5.2],
  },
];

export interface SharedAtmosphereState {
  nightFactor: number;
  targetNight: number;
}
