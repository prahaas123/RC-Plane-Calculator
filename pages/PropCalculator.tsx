
import React, { useState, useEffect } from 'react';
import { InputGroup } from '../components/InputGroup';
import { ResultCard } from '../components/ResultCard';
import { Icons } from '../constants';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export const PropCalculator: React.FC = () => {
  // --- Inputs ---
  const [propDiam, setPropDiam] = useState(10);     // Prop_Diameter_in
  const [propPitch, setPropPitch] = useState(6);    // Prop_Pitch_in
  const [blades, setBlades] = useState(2);          // Num_Blades (2, 3, 4)
  const [kv, setKv] = useState(1000);               // Motor_Kv
  const [escRating, setEscRating] = useState(40);   // ESC_Rating_A
  const [battCells, setBattCells] = useState(3);    // Battery_Cells (S)
  const [battCapacity, setBattCapacity] = useState(2200); // Battery_Capacity_mAh
  const [battType, setBattType] = useState<'LiPo' | 'Li-ion'>('LiPo'); // Battery_Type
  
  // Helpers for total system (User Convenience, maps to physics inputs)
  const [numMotors, setNumMotors] = useState(1);
  const [battParallel, setBattParallel] = useState(1); // Used to calculate total Capacity

  // --- Results State ---
  const [results, setResults] = useState({
    staticThrust: 0, 
    maxRpm: 0,
    pitchSpeed: 0,
    tipMach: 0,
    totalPower: 0,
    totalCurrent: 0,
    flightTime: 0,
    thrustPerMotor: 0
  });

  const [warnings, setWarnings] = useState({
    escOverload: false,
    transonic: false,
    rpmHigh: false
  });

  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    // --- 2. Constants & Physics Definitions ---
    const RHO = 1.225;
    const PI = 3.14159;
    const SPEED_OF_SOUND = 343;
    const MOTOR_EFFICIENCY = 0.80;
    const BATTERY_DISCHARGE_SAFETY = 0.80;
    
    const V_CELL = battType === 'LiPo' ? 3.7 : 3.6;

    // --- 3. Calculation Logic ---

    // Step A: Geometry Conversions
    const diamM = propDiam * 0.0254;
    const pitchM = propPitch * 0.0254;

    // Step B: Electrical State (Motor RPM)
    const voltageNominal = battCells * V_CELL;
    const rpmUnloaded = kv * voltageNominal;
    const rpmLoaded = rpmUnloaded * MOTOR_EFFICIENCY;
    const rps = rpmLoaded / 60;

    // Step C: Aerodynamic Coefficients (Heuristics)
    let bf = 1.0;
    if (blades === 3) bf = 1.3;
    if (blades === 4) bf = 1.5;

    const cp = (propPitch / propDiam) * 0.045 * bf;
    const ct = 0.10 * bf;

    // Step D: Thrust & Power Calculations
    const tNewtons = ct * RHO * Math.pow(rps, 2) * Math.pow(diamM, 4);
    const tGrams = tNewtons * 101.97;

    const powerWatts = cp * RHO * Math.pow(rps, 3) * Math.pow(diamM, 5);
    const currentAmps = powerWatts / voltageNominal;

    // Step E: Flight Metrics
    const vPitchMs = rps * pitchM;
    const vPitchKmh = vPitchMs * 3.6;

    const tipSpeed = PI * diamM * rps;
    const mach = tipSpeed / SPEED_OF_SOUND;

    // Flight Time (Mixed Throttle)
    const totalSystemCapacity = battCapacity * battParallel;
    // Formula uses System Capacity and System Current (or Single/Single ratio, same result)
    // To match formula strictly: Time = (Capacity / 1000 * 0.8) / (Current * 0.5) * 60
    // We'll use total system values to handle multi-motor/multi-battery setups correctly
    const totalSystemCurrent = currentAmps * numMotors;
    const timeMin = totalSystemCurrent > 0 
      ? ((totalSystemCapacity / 1000) * BATTERY_DISCHARGE_SAFETY) / (totalSystemCurrent * 0.5) * 60 
      : 0;

    // --- Dynamic Thrust (Chart) ---
    // Formula: T_v = T_static * (1 - (v / V_pitch))
    const chartPoints = [];
    // Plotting 0 to 15 m/s to cover the "10 m/s" requirement check and show trend
    for (let v = 0; v <= 15; v += 1) {
      let ratio = 1 - (v / vPitchMs);
      if (ratio < 0) ratio = 0;
      const tDynGrams = (tNewtons * ratio) * 101.97 * numMotors; // Total Thrust
      chartPoints.push({
        windSpeed: v,
        thrust: Math.round(tDynGrams)
      });
    }

    // --- 4. Safety Constraints & Warnings ---
    // Check per-motor current against ESC rating
    const escOverload = currentAmps > escRating;
    const transonic = mach > 0.80;
    const rpmHigh = rpmLoaded > 30000;

    setWarnings({ escOverload, transonic, rpmHigh });

    setResults({
      staticThrust: Math.round(tGrams * numMotors),
      maxRpm: Math.round(rpmLoaded),
      pitchSpeed: Math.round(vPitchKmh),
      tipMach: parseFloat(mach.toFixed(2)),
      totalPower: Math.round(powerWatts * numMotors),
      totalCurrent: parseFloat(totalSystemCurrent.toFixed(1)),
      flightTime: parseFloat(timeMin.toFixed(1)),
      thrustPerMotor: Math.round(tGrams)
    });

    setChartData(chartPoints);

  }, [propDiam, propPitch, blades, kv, escRating, battCells, battCapacity, battParallel, battType, numMotors]);

  const downloadCSV = () => {
    if (chartData.length === 0) return;
    const headers = ["Wind Speed (m/s)", "Total Thrust (g)"];
    const rows = chartData.map(row => [row.windSpeed, row.thrust].join(","));
    const csvContent = [headers.join(","), ...rows].join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "dynamic_thrust_data.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-20">
      
      {/* --- Section 1: Inputs (Top) --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Propeller Config */}
        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 h-full">
          <div className="flex items-center gap-3 mb-6">
            <Icons.Propeller className="text-indigo-400" />
            <h2 className="text-xl font-bold text-white">Propeller</h2>
          </div>
          <InputGroup label="Diameter" value={propDiam} onChange={setPropDiam} unit="in" min={1} max={40} step={0.5} />
          <InputGroup label="Pitch" value={propPitch} onChange={setPropPitch} unit="in" min={1} max={30} step={0.5} />
          <div className="mb-4">
             <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Blades</label>
             <div className="flex bg-slate-800 rounded-md p-1 border border-slate-700">
               {[2, 3, 4].map(b => (
                 <button 
                  key={b}
                  onClick={() => setBlades(b)}
                  className={`flex-1 py-1.5 rounded text-sm font-bold transition-all ${blades === b ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                 >
                   {b}
                 </button>
               ))}
             </div>
          </div>
        </div>

        {/* Motor & ESC */}
        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 h-full">
          <div className="flex items-center gap-3 mb-6">
            <Icons.Cpu className="text-sky-400" />
            <h2 className="text-xl font-bold text-white">Motor & ESC</h2>
          </div>
          <InputGroup label="Motor KV" value={kv} onChange={setKv} unit="rpm/v" min={100} max={10000} step={10} />
          <InputGroup label="ESC Rating" value={escRating} onChange={setEscRating} unit="A" min={5} max={300} />
          <InputGroup label="# of Motors" value={numMotors} onChange={setNumMotors} min={1} max={16} step={1} helpText="Multirotor or Multi-engine" />
        </div>

        {/* Battery */}
        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 h-full">
          <div className="flex items-center gap-3 mb-6">
             {/* Battery Icon */}
             <div className="w-6 h-6 rounded bg-green-500/20 text-green-400 flex items-center justify-center font-bold text-xs">Li</div>
             <h2 className="text-xl font-bold text-white">Battery</h2>
          </div>
          
          <div className="mb-4">
             <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Type</label>
             <div className="flex bg-slate-800 rounded-md p-1 border border-slate-700">
               {(['LiPo', 'Li-ion'] as const).map(t => (
                 <button 
                  key={t}
                  onClick={() => setBattType(t)}
                  className={`flex-1 py-1.5 rounded text-sm font-bold transition-all ${battType === t ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                 >
                   {t}
                 </button>
               ))}
             </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <InputGroup label="Series (S)" value={battCells} onChange={setBattCells} min={1} max={16} />
            <InputGroup label="Parallel (P)" value={battParallel} onChange={setBattParallel} min={1} max={8} />
          </div>
          <InputGroup label="Pack Capacity" value={battCapacity} onChange={setBattCapacity} unit="mAh" step={50} helpText="Capacity of one pack" />
        </div>

      </div>

      {/* --- Section 2: Results (Middle) --- */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <ResultCard label="Static Thrust" value={results.staticThrust} unit="g" highlight />
          <ResultCard label="Total Power" value={results.totalPower} unit="W" />
          <ResultCard label="Pitch Speed" value={results.pitchSpeed} unit="km/h" />
          <ResultCard 
            label="Tip Mach" 
            value={results.tipMach} 
            unit="M" 
            subtext={warnings.transonic ? "Warning: > 0.80 M" : "Good"} 
            highlight={warnings.transonic}
          />
        
          <ResultCard 
            label="Max RPM" 
            value={results.maxRpm} 
            unit="rpm" 
            subtext={warnings.rpmHigh ? "Warning: > 30k" : ""}
            highlight={warnings.rpmHigh}
          />
          <ResultCard 
            label="Total Current" 
            value={results.totalCurrent} 
            unit="A" 
            subtext={warnings.escOverload ? "WARNING: Exceeds ESC" : "Within Limits"}
            highlight={warnings.escOverload}
          />
          <ResultCard label="Flight Time" value={results.flightTime} unit="min" subtext="Mixed Flying (50%)" />
          <ResultCard label="Thrust/Motor" value={results.thrustPerMotor} unit="g" />
        </div>
      </div>

      {/* --- Section 3: Graph (Bottom) --- */}
      <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 h-[32rem] flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Dynamic Thrust vs Wind Speed</h3>
            <span className="text-xs text-slate-500">Total Thrust (g)</span>
          </div>
          <div className="flex-grow w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis 
                  dataKey="windSpeed" 
                  stroke="#94a3b8" 
                  fontSize={12} 
                  label={{ value: 'Wind Speed (m/s)', position: 'insideBottom', offset: -10, fill: '#94a3b8' }} 
                />
                <YAxis 
                  stroke="#94a3b8" 
                  fontSize={12} 
                  width={60}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#f1f5f9' }}
                  itemStyle={{ color: '#818cf8' }}
                  formatter={(value: number) => [`${value} g`, 'Thrust']}
                  labelFormatter={(label) => `${label} m/s`}
                />
                <Legend verticalAlign="top" height={36}/>
                <Line 
                  type="monotone" 
                  dataKey="thrust" 
                  name="Total Thrust"
                  stroke="#818cf8" 
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#818cf8', strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: '#c7d2fe' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 flex justify-end">
             <button 
               onClick={downloadCSV}
               className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold py-2 px-4 rounded transition-colors flex items-center gap-2 border border-slate-600"
             >
               <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
               Download CSV
             </button>
          </div>
      </div>

    </div>
  );
};
