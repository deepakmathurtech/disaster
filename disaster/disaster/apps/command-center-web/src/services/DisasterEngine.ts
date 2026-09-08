// Simulation engine for Yamuna Flash Flood — Delhi NCR
// Emits real-time disaster timeline events and state changes

export interface SimEvent {
  id: string;
  simTimeMinutes: number; // e.g. 0, 15, 30, 45, 60...
  title: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'INFO';
  category: 'WATER' | 'INFRASTRUCTURE' | 'EVACUATION' | 'SHELTER' | 'POWER' | 'MEDICAL';
  description: string;
  affectedEntityId?: string;
  suggestedAction: string;
  commsMessage?: {
    callsign: string;
    channel: string;
    text: string;
    type: 'SOS' | 'FIELD' | 'COMMAND';
  };
}

export interface SimState {
  isRunning: boolean;
  isPaused: boolean;
  speed: 1 | 10 | 60;
  elapsedSeconds: number;
  simTimeMinutes: number; // 0 to 360 (6 hours)
  waterLevelMeters: number; // base 205.33m, danger 205.33, peak 208.65
  waterRiseRateCmHr: number;
  evacuatedCount: number;
  atRiskCount: number;
  totalCasualties: number;
  activeAlertCount: number;
  currentPhase: 'WARNING' | 'SURGE' | 'PEAK' | 'RECEDING';
}

export const SCRIPTED_TIMELINE: SimEvent[] = [
  {
    id: 'ev-001',
    simTimeMinutes: 5,
    title: 'Yamuna Water Level Reaches Warning Mark',
    severity: 'MEDIUM',
    category: 'WATER',
    description: 'Gauge at Old Yamuna Bridge reads 204.50m (Warning Mark: 204.50m). Discharge from Hathnikund Barrage increased to 2.5 lakh cusecs.',
    affectedEntityId: 'water-yamuna',
    suggestedAction: 'Issue Flood Watch for low-lying sectors (Monastery Market, Yamuna Bazaar).',
    commsMessage: {
      callsign: 'Hydrology-Obs-1',
      channel: '#TACTICAL-ALPHA',
      text: 'ATTN EOC: Hathnikund barrage release increased to 2.5L cusecs. Water level at 204.50m and rising.',
      type: 'FIELD',
    },
  },
  {
    id: 'ev-002',
    simTimeMinutes: 15,
    title: 'Danger Mark Breached — Old Railway Bridge',
    severity: 'HIGH',
    category: 'WATER',
    description: 'Yamuna water level crosses 205.33m Danger Mark. Inundation started in Yamuna Bazaar and Monastery Market.',
    affectedEntityId: 'water-yamuna',
    suggestedAction: 'Initiate Tier-1 Evacuation of 1,200 residents in Yamuna Bazaar.',
    commsMessage: {
      callsign: 'Unit-01 (Delhi EOC)',
      channel: '#EMERGENCY-SOS',
      text: 'FLASH: Yamuna crossed 205.33m danger mark. Water entering Yamuna Bazaar streets. Initiating Tier-1 Evacuation.',
      type: 'SOS',
    },
  },
  {
    id: 'ev-003',
    simTimeMinutes: 30,
    title: 'Structural Crack Detected — Old Yamuna Bridge (Loha Pul)',
    severity: 'CRITICAL',
    category: 'INFRASTRUCTURE',
    description: 'Pier 4 underwater sensor flags structural vibration exceedance. Bridge B12 at immediate risk of failure.',
    affectedEntityId: 'bridge-delhi-01',
    suggestedAction: 'Close Loha Pul to all vehicular and pedestrian traffic immediately. Divert via Geeta Colony Bridge.',
    commsMessage: {
      callsign: 'Unit-17 (Alpha Eng)',
      channel: '#TACTICAL-ALPHA',
      text: 'URGENT: Pier 4 structural displacement detected on Loha Pul. Immediate closure recommended!',
      type: 'SOS',
    },
  },
  {
    id: 'ev-004',
    simTimeMinutes: 45,
    title: 'Grid Substation Submerged — Sector 4 Power Loss',
    severity: 'CRITICAL',
    category: 'POWER',
    description: 'Kashmere Gate 220kV Substation flooded. Emergency shutdown triggered to prevent electrocution.',
    affectedEntityId: 'grid-sec4',
    suggestedAction: 'Dispatch diesel backup generators to Civil Lines Trauma Center and LNJP Hospital.',
    commsMessage: {
      callsign: 'Delhi-Discom-Ctrl',
      channel: '#FIELD-DISPATCH',
      text: 'Substation Kashmere Gate flooded. Power cut to Sector 4 & Civil Lines. Emergency generators required.',
      type: 'FIELD',
    },
  },
  {
    id: 'ev-005',
    simTimeMinutes: 65,
    title: 'Shelter Alpha Overcrowded — Redirection Needed',
    severity: 'HIGH',
    category: 'SHELTER',
    description: 'Community Relief Camp Alpha reached 108% capacity (540/500 evacuees). Supply shortage reported.',
    affectedEntityId: 'shelter-alpha',
    suggestedAction: 'Divert incoming evacuation buses to Relief Camp Beta (Shastri Park School).',
    commsMessage: {
      callsign: 'Unit-04 (Relief)',
      channel: '#FIELD-DISPATCH',
      text: 'Shelter Alpha FULL (540 evacuees). Diverting secondary influx to Relief Camp Beta.',
      type: 'FIELD',
    },
  },
  {
    id: 'ev-006',
    simTimeMinutes: 90,
    title: 'Mass Evacuation Triggered — Ring Road Inundated',
    severity: 'CRITICAL',
    category: 'EVACUATION',
    description: 'Water breaches Ring Road Outer Corridor near ISBT Kashmere Gate. 3,500 civilians stranded.',
    affectedEntityId: 'road-ring-01',
    suggestedAction: 'Deploy NDRF inflatable motorboats for water rescue near ISBT.',
    commsMessage: {
      callsign: 'NDRF-Batalion-8',
      channel: '#EMERGENCY-SOS',
      text: 'MAYDAY: ISBT Kashmere Gate under 3ft water. Approx 350 civilians trapped on high platforms. Requesting extra motorboats.',
      type: 'SOS',
    },
  },
  {
    id: 'ev-007',
    simTimeMinutes: 120,
    title: 'Peak Flood Gauge Reached — 208.65m',
    severity: 'CRITICAL',
    category: 'WATER',
    description: 'Yamuna level peaks at 208.65m — highest recorded flood in Delhi history. Emergency declared.',
    affectedEntityId: 'water-yamuna',
    suggestedAction: 'Maintain full emergency mobilization. Request Armed Forces backup for breach containment.',
    commsMessage: {
      callsign: 'EOC Command',
      channel: '#TACTICAL-ALPHA',
      text: 'ALL UNITS: Yamuna peaked at 208.65m. All units hold tactical positions and prioritize life-safety rescues.',
      type: 'COMMAND',
    },
  },
];
