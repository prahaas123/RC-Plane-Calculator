
export enum Page {
  OVERALL = 'OVERALL',
  PROP = 'PROP',
  CG = 'CG'
}

export interface MotorConfig {
  kv: number;
  resistance: number;
  idleCurrent: number;
  maxCurrent: number;
  weight: number;
}

export interface BatteryConfig {
  cells: number;
  capacity: number; // mAh
  cRating: number;
  weight: number;
}

export interface PropConfig {
  diameter: number;
  pitch: number;
  blades: number;
}

export interface AircraftConfig {
  motor: MotorConfig;
  battery: BatteryConfig;
  prop: PropConfig;
  escRating: number;
  totalWeight: number; // g
}

export interface AircraftRequirements {
  // Airplane
  wingType: string;
  weight: number; // g
  span: number; // mm
  wingArea: number; // dm2
  cl: number;
  cooling: string;
  
  // Performance
  mission: string;
  speed: number; // km/h
  thrust: number; // g
  flightTime: number; // min
  
  // Battery
  cells: number;
  batteryType: string; // label
  
  // General
  temp: number; // C
  elevation: number; // m
  
  // Motor
  motorCount: number;
  gearRatio: number;
  maxMotorWeightPct: number;
  
  // Prop
  maxPropDiameter: number; // inch
  propPitch: number; // inch
  blades: number;
}

export interface WingConfig {
  rootChord: number;
  tipChord: number;
  sweepDistance: number;
  span: number; // Semi-span usually for calcs, but UI might ask for full
}

export interface GeminiAnalysisResponse {
  analysis: string;
  recommendations: string[];
  safetyRating: 'SAFE' | 'WARNING' | 'DANGER';
}
