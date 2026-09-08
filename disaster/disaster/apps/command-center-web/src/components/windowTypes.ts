export type WindowId =
  | 'commandAI'
  | 'inspector'
  | 'comms'
  | 'media'
  | 'incident'
  | 'grid'
  | 'alertFeed'
  | 'resourceBoard';

export interface WindowState {
  id: WindowId;
  title: string;
  icon: string;
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
}

export const DEFAULT_WINDOWS: Record<WindowId, WindowState> = {
  commandAI: {
    id: 'commandAI',
    title: '🤖 Command AI & Local LLM',
    icon: '🤖',
    isOpen: true,
    isMinimized: false,
    isMaximized: false,
    x: 420,
    y: 70,
    width: 440,
    height: 480,
    zIndex: 2010,
  },
  alertFeed: {
    id: 'alertFeed',
    title: '🚨 Live Disaster Alert Feed',
    icon: '🚨',
    isOpen: true,
    isMinimized: false,
    isMaximized: false,
    x: 870,
    y: 70,
    width: 420,
    height: 480,
    zIndex: 2020,
  },
  resourceBoard: {
    id: 'resourceBoard',
    title: '📋 Resource Allocation & Dispatch',
    icon: '📋',
    isOpen: false,
    isMinimized: false,
    isMaximized: false,
    x: 300,
    y: 110,
    width: 600,
    height: 460,
    zIndex: 2030,
  },
  inspector: {
    id: 'inspector',
    title: '🔎 Entity Inspector',
    icon: '🔎',
    isOpen: false,
    isMinimized: false,
    isMaximized: false,
    x: 880,
    y: 110,
    width: 360,
    height: 460,
    zIndex: 2040,
  },
  comms: {
    id: 'comms',
    title: '📡 Emergency Comms Center',
    icon: '📡',
    isOpen: false,
    isMinimized: false,
    isMaximized: false,
    x: 280,
    y: 120,
    width: 460,
    height: 420,
    zIndex: 2050,
  },
  media: {
    id: 'media',
    title: '📷 Drone & Field Visuals',
    icon: '📷',
    isOpen: false,
    isMinimized: false,
    isMaximized: false,
    x: 350,
    y: 100,
    width: 520,
    height: 440,
    zIndex: 2060,
  },
  incident: {
    id: 'incident',
    title: '🚨 Incident Tactical Command',
    icon: '🚨',
    isOpen: false,
    isMinimized: false,
    isMaximized: false,
    x: 320,
    y: 80,
    width: 500,
    height: 460,
    zIndex: 2070,
  },
  grid: {
    id: 'grid',
    title: '📊 Grid Asset Intelligence',
    icon: '📊',
    isOpen: false,
    isMinimized: false,
    isMaximized: false,
    x: 250,
    y: 90,
    width: 680,
    height: 480,
    zIndex: 2080,
  },
};
