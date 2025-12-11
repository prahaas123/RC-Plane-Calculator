
import React, { useState, useEffect } from 'react';
import { Icons } from '../constants';
import { AircraftRequirements } from '../types';
import { analyzeAircraftSetup } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';

// --- Helper Components ---

const DualUnitInput = ({ 
  value, 
  onChange, 
  unit1, 
  unit2, 
  conversionFactor, // unit1 * factor = unit2
  label,
  step = 1,
  readOnly = false
}: { 
  value: number; 
  onChange: (val: number) => void; 
  unit1: string; 
  unit2: string; 
  conversionFactor: number;
  label?: string;
  step?: number;
  readOnly?: boolean;
}) => {
  const val1 = value;
  const val2 = value * conversionFactor;

  const handleVal1Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(parseFloat(e.target.value) || 0);
  };

  const handleVal2Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v2 = parseFloat(e.target.value) || 0;
    onChange(v2 / conversionFactor);
  };

  return (
    <div className="flex flex-col">
      {label && <label className="text-xs font-semibold text-slate-400 mb-1">{label}</label>}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="number"
            step={step}
            value={parseFloat(val1.toFixed(2))}
            onChange={handleVal1Change}
            readOnly={readOnly}
            className={`w-full bg-slate-100 text-slate-900 border border-slate-300 text-sm rounded-md px-2 py-1 focus:ring-2 focus:ring-indigo-500 focus:outline-none ${readOnly ? 'opacity-80 cursor-default' : ''}`}
          />
          <span className="absolute right-2 top-1.5 text-xs text-slate-500 font-bold">{unit1}</span>
        </div>
        <div className="relative flex-1">
          <input
            type="number"
            step={step === 1 ? 0.01 : step}
            value={parseFloat(val2.toFixed(2))}
            onChange={handleVal2Change}
            readOnly={readOnly}
            className={`w-full bg-slate-100 text-slate-900 border border-slate-300 text-sm rounded-md px-2 py-1 focus:ring-2 focus:ring-indigo-500 focus:outline-none ${readOnly ? 'opacity-80 cursor-default' : ''}`}
          />
          <span className="absolute right-2 top-1.5 text-xs text-slate-500 font-bold">{unit2}</span>
        </div>
      </div>
    </div>
  );
};

const SectionHeader = ({ title }: { title: string }) => (
  <div className="bg-rose-100/10 px-4 py-2 border-b border-rose-200/20">
    <h3 className="text-sm font-bold text-rose-100/90">{title}</h3>
  </div>
);

const Select = ({ 
  label, 
  value, 
  onChange, 
  options 
}: { 
  label: string; 
  value: string; 
  onChange: (val: string) => void; 
  options: string[] 
}) => (
  <div className="flex flex-col">
    <label className="text-xs font-semibold text-slate-400 mb-1">{label}</label>
    <select 
      value={value} 
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-slate-100 text-slate-900 border border-slate-300 text-sm rounded-md px-2 py-1 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
    >
      {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
    </select>
  </div>
);

// --- Main Component ---

export const OverallSetup: React.FC = () => {
  const [reqs, setReqs] = useState<AircraftRequirements>({
    wingType: 'Monoplane',
    weight: 400, // g
    span: 600, // mm
    wingArea: 0.8, // dm2
    cl: 1.0,
    cooling: 'good',
    mission: 'Racer - mild',
    speed: 100, // km/h
    thrust: 300, // g
    flightTime: 10, // min
    cells: 2,
    batteryType: 'LiPo - 3.7V',
    temp: 25, // C
    elevation: 500, // m
    motorCount: 1,
    gearRatio: 1,
    maxMotorWeightPct: 15, // %
    maxPropDiameter: 9, // inch
    propPitch: 6.0, // inch
    blades: 2
  });

  const [calcs, setCalcs] = useState({
    stallSpeedKmh: 0,
    stallSpeedMph: 0,
    maxMotorWeightG: 0,
    maxMotorWeightOz: 0
  });

  const [aiAnalysis, setAiAnalysis] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Update handlers
  const update = (field: keyof AircraftRequirements, value: any) => {
    setReqs(prev => ({ ...prev, [field]: value }));
  };

  // Real-time physics calculations
  useEffect(() => {
    // 1. Motor Weight Limit
    const motorG = reqs.weight * (reqs.maxMotorWeightPct / 100);
    const motorOz = motorG * 0.035274;

    // 2. Stall Speed (Vs)
    // Formula: Vs = sqrt( (2 * W * g) / (rho * S * CL) )
    // W in kg, S in m2.
    // rho at sea level = 1.225. Adjust for elevation roughly: rho = 1.225 * (1 - 2.256e-5 * h)^4.256
    const rho = 1.225 * Math.pow(1 - 2.256e-5 * reqs.elevation, 4.256);
    const weightKg = reqs.weight / 1000;
    const areaM2 = reqs.wingArea / 100; // dm2 to m2
    
    let vsMs = 0;
    if (areaM2 > 0 && reqs.cl > 0) {
      vsMs = Math.sqrt((2 * weightKg * 9.81) / (rho * areaM2 * reqs.cl));
    }
    const vsKmh = vsMs * 3.6;
    const vsMph = vsKmh * 0.621371;

    setCalcs({
      maxMotorWeightG: motorG,
      maxMotorWeightOz: motorOz,
      stallSpeedKmh: vsKmh,
      stallSpeedMph: vsMph
    });
  }, [reqs.weight, reqs.maxMotorWeightPct, reqs.elevation, reqs.wingArea, reqs.cl]);

  const handleAIAnalyze = async () => {
    setIsAnalyzing(true);
    setAiAnalysis("");
    const result = await analyzeAircraftSetup(reqs);
    setAiAnalysis(result);
    setIsAnalyzing(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-20">
      
      {/* --- FORM SECTION --- */}
      <div className="lg:col-span-8 space-y-4">
        
        {/* Row 1: Airplane */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <SectionHeader title="Airplane" />
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Select 
              label="Wing Type:" 
              value={reqs.wingType} 
              onChange={(v) => update('wingType', v)} 
              options={['Monoplane', 'Biplane', 'Flying Wing', 'Delta']} 
            />
            <DualUnitInput 
              label="All-Up-Weight:" 
              value={reqs.weight} 
              onChange={(v) => update('weight', v)} 
              unit1="g" unit2="oz" conversionFactor={0.035274} 
            />
            <DualUnitInput 
              label="Wingspan:" 
              value={reqs.span} 
              onChange={(v) => update('span', v)} 
              unit1="mm" unit2="inch" conversionFactor={0.03937} 
            />
            <div className="space-y-2">
               <DualUnitInput 
                label="Wing Area:" 
                value={reqs.wingArea} 
                onChange={(v) => update('wingArea', v)} 
                unit1="dm²" unit2="in²" conversionFactor={15.5} 
                step={0.1}
              />
              <span className="text-xs text-slate-500 block">Vs: {Math.round(calcs.stallSpeedKmh)}km/h - {Math.round(calcs.stallSpeedMph)}mph</span>
            </div>
            
             <Select 
                label="Cooling:" 
                value={reqs.cooling} 
                onChange={(v) => update('cooling', v)} 
                options={['good', 'medium', 'poor']} 
             />
          </div>
        </div>

        {/* Row 2: Performance */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <SectionHeader title="Desired Performance" />
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
              <div className="space-y-2">
                 <Select 
                    label="Flight Mission:" 
                    value={reqs.mission} 
                    onChange={(v) => update('mission', v)} 
                    options={['Racer - mild', 'Racer - extreme', 'Sport - Aerobatic', '3D', 'Trainer', 'Glider', 'Scale', 'UAV / Endurance']} 
                 />
                 <p className="text-[10px] text-slate-500">Factors: S x3, T x1.5, P x0.7</p>
              </div>
              
              <DualUnitInput 
                label="Speed:" 
                value={reqs.speed} 
                onChange={(v) => update('speed', v)} 
                unit1="km/h" unit2="mph" conversionFactor={0.621371} 
              />
              
              <DualUnitInput 
                label="Thrust:" 
                value={reqs.thrust} 
                onChange={(v) => update('thrust', v)} 
                unit1="g" unit2="oz" conversionFactor={0.035274} 
              />
              
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-slate-400 mb-1">Flight Time:</label>
                <div className="relative">
                  <input
                    type="number"
                    value={reqs.flightTime}
                    onChange={(e) => update('flightTime', parseFloat(e.target.value))}
                    className="w-full bg-slate-100 text-slate-900 border border-slate-300 text-sm rounded-md px-2 py-1 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  <span className="absolute right-2 top-1.5 text-xs text-slate-500 font-bold">min</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Row 3: Battery & General */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           {/* Battery */}
           <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
             <SectionHeader title="Battery Cell" />
             <div className="p-4 grid grid-cols-2 gap-4">
               <div className="flex flex-col">
                  <label className="text-xs font-semibold text-slate-400 mb-1">Configuration:</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={reqs.cells}
                      onChange={(e) => update('cells', parseFloat(e.target.value))}
                      className="w-full bg-slate-100 text-slate-900 border border-slate-300 text-sm rounded-md px-2 py-1 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    <span className="absolute right-2 top-1.5 text-xs text-slate-500 font-bold">S</span>
                  </div>
               </div>
               <Select 
                  label="Voltage:" 
                  value={reqs.batteryType} 
                  onChange={(v) => update('batteryType', v)} 
                  options={['LiPo - 3.7V', 'LiHV - 3.8V', 'LiIon - 3.6V', 'LiFe - 3.3V']} 
               />
             </div>
           </div>

           {/* General */}
           <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
             <SectionHeader title="General" />
             <div className="p-4 grid grid-cols-1 gap-4">
               <DualUnitInput 
                  label="Air Temperature:" 
                  value={reqs.temp} 
                  onChange={(v) => update('temp', v)} 
                  unit1="°C" unit2="°F" conversionFactor={1.8} 
                  readOnly={false}
               />
             </div>
           </div>
        </div>

        {/* Row 4: Motor & Propeller */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           {/* Motor */}
           <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
             <SectionHeader title="Motor" />
             <div className="p-4 grid grid-cols-2 gap-4">
               <div className="flex flex-col">
                  <label className="text-xs font-semibold text-slate-400 mb-1"># of Motors:</label>
                  <input
                    type="number"
                    value={reqs.motorCount}
                    onChange={(e) => update('motorCount', parseFloat(e.target.value))}
                    className="w-full bg-slate-100 text-slate-900 border border-slate-300 text-sm rounded-md px-2 py-1 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
               </div>
               <div className="flex flex-col">
                  <label className="text-xs font-semibold text-slate-400 mb-1">max. Weight:</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={reqs.maxMotorWeightPct}
                      onChange={(e) => update('maxMotorWeightPct', parseFloat(e.target.value))}
                      className="w-full bg-slate-100 text-slate-900 border border-slate-300 text-sm rounded-md px-2 py-1 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    <span className="absolute right-2 top-1.5 text-xs text-slate-500 font-bold">%</span>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1">= {Math.round(calcs.maxMotorWeightG)}g - {calcs.maxMotorWeightOz.toFixed(1)}oz</span>
               </div>
             </div>
           </div>

           {/* Propeller */}
           <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
             <SectionHeader title="Propeller" />
             <div className="p-4 grid grid-cols-3 gap-4">
               <div className="flex flex-col">
                  <label className="text-xs font-semibold text-slate-400 mb-1">max. Diameter:</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={reqs.maxPropDiameter}
                      onChange={(e) => update('maxPropDiameter', parseFloat(e.target.value))}
                      className="w-full bg-slate-100 text-slate-900 border border-slate-300 text-sm rounded-md px-2 py-1 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    <span className="absolute right-2 top-1.5 text-xs text-slate-500 font-bold">inch</span>
                  </div>
               </div>
               <div className="flex flex-col">
                  <label className="text-xs font-semibold text-slate-400 mb-1">Pitch:</label>
                  <div className="relative">
                    <input
                      type="number"
                      step={0.5}
                      value={reqs.propPitch}
                      onChange={(e) => update('propPitch', parseFloat(e.target.value))}
                      className="w-full bg-slate-100 text-slate-900 border border-slate-300 text-sm rounded-md px-2 py-1 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    <span className="absolute right-2 top-1.5 text-xs text-slate-500 font-bold">inch</span>
                  </div>
               </div>
               <div className="flex flex-col">
                  <label className="text-xs font-semibold text-slate-400 mb-1"># Blades:</label>
                  <input
                    type="number"
                    value={reqs.blades}
                    onChange={(e) => update('blades', parseFloat(e.target.value))}
                    className="w-full bg-slate-100 text-slate-900 border border-slate-300 text-sm rounded-md px-2 py-1 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
               </div>
             </div>
           </div>
        </div>

      </div>

      {/* --- RESULTS / AI SECTION --- */}
      <div className="lg:col-span-4 space-y-4">
        <div className="bg-indigo-900/20 p-6 rounded-lg border border-indigo-500/50 sticky top-24">
           <h2 className="text-xl font-bold text-white mb-4">Setup Recommendation</h2>
           <p className="text-slate-400 text-sm mb-6">
             Based on the requirements on the left, let our AI engine calculate the optimal component setup for your aircraft.
           </p>

           <button 
            onClick={handleAIAnalyze}
            disabled={isAnalyzing}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg shadow-lg transition-all flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mb-6"
          >
            {isAnalyzing ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Calculating...
              </>
            ) : (
              <>
                <Icons.Cpu className="w-5 h-5" /> Calculate Setup
              </>
            )}
          </button>

          {aiAnalysis ? (
             <div className="prose prose-invert prose-sm max-w-none text-slate-200 animate-fade-in">
                <ReactMarkdown>{aiAnalysis}</ReactMarkdown>
             </div>
          ) : (
             <div className="border border-dashed border-slate-700 rounded-lg p-8 text-center text-slate-600">
                <Icons.Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Results will appear here</p>
             </div>
          )}
        </div>
      </div>

    </div>
  );
};
