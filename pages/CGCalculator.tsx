import React, { useState, useEffect, useMemo } from 'react';
import { InputGroup } from '../components/InputGroup';
import { ResultCard } from '../components/ResultCard';
import { Icons } from '../constants';

// --- Types ---
interface WingPanel {
  id: number;
  tip: number;   // Tip Chord (cm)
  sweep: number; // Sweep distance (cm)
  span: number;  // Panel Span (cm)
}

interface SurfaceAnalysis {
  area: number;        // cm2 (full wing)
  span: number;        // cm (full wing)
  mac: number;         // cm
  macPosition: { x: number; y: number }; // coords relative to surface root LE
  acPosition: { x: number; y: number };  // Aerodynamic center relative to surface root LE
  aspectRatio: number;
  rootChord: number;
}

// --- Helper Components ---

const PanelInputRow: React.FC<{
  label: string;
  field: keyof WingPanel;
  panels: WingPanel[];
  onChange: (idx: number, field: keyof WingPanel, val: number) => void;
  onAdd: () => void;
  onRemove: () => void;
  unit?: string;
}> = ({ label, field, panels, onChange, onAdd, onRemove, unit }) => (
  <div className="flex items-center gap-2 mb-2">
    <div className="w-24 shrink-0 text-xs font-semibold text-slate-400 uppercase tracking-wider">
      {label}
    </div>
    <div className="flex flex-wrap gap-2 flex-grow">
      {panels.map((p, idx) => (
        <div key={p.id} className="relative w-20">
          <input
            type="number"
            value={p[field]}
            onChange={(e) => onChange(idx, field, parseFloat(e.target.value) || 0)}
            className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-xs rounded px-2 py-1.5 focus:ring-1 focus:ring-indigo-500"
          />
          {idx < panels.length - 1 && (
             <span className="absolute -right-2 top-1/2 -translate-y-1/2 text-slate-600">-</span>
          )}
        </div>
      ))}
      <div className="flex gap-1 ml-2">
        {panels.length < 5 && (
          <button onClick={onAdd} className="bg-slate-700 hover:bg-slate-600 text-slate-200 rounded px-2 text-xs font-bold" title="Add Panel">+</button>
        )}
        {panels.length > 1 && (
          <button onClick={onRemove} className="bg-slate-700 hover:bg-red-900/50 text-slate-200 rounded px-2 text-xs font-bold" title="Remove Panel">-</button>
        )}
      </div>
    </div>
    {unit && <span className="text-xs text-slate-500 w-8">{unit}</span>}
  </div>
);

// --- Math Helpers ---

const calculateSurface = (rootChord: number, panels: WingPanel[]): SurfaceAnalysis => {
  let totalArea = 0;
  let totalMacMoment = 0;
  let totalAcMomentX = 0; // Moment of AC location weighted by area
  let currentY = 0;
  let currentRootLE_X = 0; // X position of the current panel's root LE
  let totalSpan = 0;

  let currentRoot = rootChord;

  panels.forEach(panel => {
    // Trapezoid geometry
    const root = currentRoot;
    const tip = panel.tip;
    const h = panel.span; // height of trapezoid (spanwise)
    const sweep = panel.sweep; // geometric sweep of LE (x offset of tip LE relative to root LE)

    const area = (root + tip) * h / 2;
    
    // Panel MAC length
    const mac = (2 / 3) * (root + tip - (root * tip) / (root + tip));
    
    // Panel MAC Y position (relative to panel root)
    const macY_local = (h / 3) * ((root + 2 * tip) / (root + tip));
    
    // Panel MAC LE X position (relative to panel root LE)
    // Geometric interpolation along the Leading Edge
    // The LE is a straight line from (0,0) to (h, sweep) in local panel coords
    const macLE_X_local = (macY_local / h) * sweep;

    // Aerodynamic Center of Panel (approx at 25% of MAC)
    // Global coords (relative to Surface Root LE)
    const panelRootLE_Y = currentY;
    
    // AC Location in Global Coords for this panel
    const absMacLE_X = currentRootLE_X + macLE_X_local;
    // const absMacCenter_Y = currentY + macY_local; // Not needed for X moment? Actually need Y for spanwise distribution but we simplify to finding the Mean Geometric Chord and its X location
    
    const ac_X = absMacLE_X + 0.25 * mac;

    totalArea += area;
    totalMacMoment += area * mac;
    totalAcMomentX += area * ac_X;
    totalSpan += h;

    // Prep for next panel
    currentY += h;
    currentRootLE_X += sweep;
    currentRoot = tip;
  });

  const meanMac = totalArea > 0 ? totalMacMoment / totalArea : 0;
  const meanAcX = totalArea > 0 ? totalAcMomentX / totalArea : 0;
  
  // Back-calculate the LE of the Mean Aerodynamic Chord
  const meanMacLE_X = meanAcX - 0.25 * meanMac;

  return {
    area: totalArea * 2, // Full wing (both sides)
    span: totalSpan * 2,
    mac: meanMac,
    macPosition: { x: meanMacLE_X, y: 0 }, // Y is less critical for long. stability but computed effectively
    acPosition: { x: meanAcX, y: 0 },
    aspectRatio: (totalSpan * 2) ** 2 / (totalArea * 2),
    rootChord: rootChord
  };
};

export const CGCalculator: React.FC = () => {
  // --- State ---
  const [isFlyingWing, setIsFlyingWing] = useState(false);

  // Wing
  const [wingRoot, setWingRoot] = useState(25);
  const [wingPanels, setWingPanels] = useState<WingPanel[]>([
    { id: 1, tip: 18, sweep: 4, span: 40 },
    { id: 2, tip: 10, sweep: 8, span: 30 }
  ]);

  // Tail
  const [tailRoot, setTailRoot] = useState(12);
  const [tailPanels, setTailPanels] = useState<WingPanel[]>([
    { id: 1, tip: 8, sweep: 3, span: 25 }
  ]);

  // Config
  const [distWingTail, setDistWingTail] = useState(65); // LE Wing to LE Tail
  const [staticMargin, setStaticMargin] = useState(10); // %
  const [tailEff, setTailEff] = useState(0.9); // Tail Efficiency

  // Fuselage
  const [fuseWidth, setFuseWidth] = useState(8);
  const [fuseLength, setFuseLength] = useState(90);
  const [fuseNose, setFuseNose] = useState(20); // Nose overhang from Wing LE

  // --- Calculations ---
  const results = useMemo(() => {
    const wing = calculateSurface(wingRoot, wingPanels);
    
    let tail: SurfaceAnalysis;
    let npPosition: number;
    let vBar = 0;
    let lTail = 0;

    if (isFlyingWing) {
      // Flying Wing Mode: Ignore tail and fuselage moments for basic calc
      // NP is effectively the Wing's AC
      // Create a zeroed tail for type safety
      tail = { area: 0, span: 0, mac: 0, macPosition: {x:0,y:0}, acPosition: {x:0,y:0}, aspectRatio: 0, rootChord: 0 };
      npPosition = wing.acPosition.x;
    } else {
      // Conventional Mode
      tail = calculateSurface(tailRoot, tailPanels);
      
      // Adjust Tail X positions by Distance D
      const tailAcX_Global = tail.acPosition.x + distWingTail;
      
      const numerator = (wing.acPosition.x * wing.area) + (tailAcX_Global * tail.area * tailEff);
      const denominator = wing.area + (tail.area * tailEff);
      npPosition = denominator > 0 ? numerator / denominator : 0;

      // Stabilizer Volume
      lTail = tailAcX_Global - wing.acPosition.x;
      vBar = (wing.area > 0 && wing.mac > 0) ? (tail.area * lTail) / (wing.area * wing.mac) : 0;
    }

    // CG Calculation
    // CG = NP - (StaticMargin/100 * MAC_wing)
    const cgPosition = npPosition - ((staticMargin / 100) * wing.mac);

    return {
      wing,
      tail,
      npPosition,
      cgPosition,
      vBar,
      lTail
    };
  }, [wingRoot, wingPanels, tailRoot, tailPanels, distWingTail, staticMargin, tailEff, isFlyingWing]);

  // --- Handlers ---
  const updatePanel = (
    setPanels: React.Dispatch<React.SetStateAction<WingPanel[]>>, 
    idx: number, 
    field: keyof WingPanel, 
    val: number
  ) => {
    setPanels(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
  };

  const addPanel = (setPanels: React.Dispatch<React.SetStateAction<WingPanel[]>>) => {
    setPanels(prev => {
      if (prev.length >= 5) return prev;
      const last = prev[prev.length - 1];
      return [...prev, { id: Date.now(), tip: last.tip * 0.8, sweep: 0, span: 20 }];
    });
  };

  const removePanel = (setPanels: React.Dispatch<React.SetStateAction<WingPanel[]>>) => {
    setPanels(prev => prev.length > 1 ? prev.slice(0, -1) : prev);
  };

  // --- Visualization Helpers ---
  const svgWidth = 600;
  const svgHeight = 400;
  const padding = 40;
  
  // Calculate bounding box for scaling
  const maxSpan = Math.max(results.wing.span, isFlyingWing ? 0 : results.tail.span);
  
  // Calculate max length for scaling Y
  let maxLen = 0;
  if (isFlyingWing) {
      // Just the wing depth
      // Need to find max depth of wing
      let currentY = 0;
      let maxY = 0;
      // Rough approx: sum of chords + sweeps? No, just max Y coord of TE relative to origin
      // Just use mac + some buffer for now, or trace nodes
      let y = 0;
      wingPanels.forEach(p => y += p.sweep);
      maxLen = y + wingPanels[wingPanels.length-1].tip + 10;
  } else {
      maxLen = Math.max(fuseLength, distWingTail + results.tail.mac + 20);
  }

  const scaleX = (svgWidth - padding * 2) / (maxSpan || 10);
  const scaleY = (svgHeight - padding * 2) / (maxLen || 10);
  const scale = Math.min(scaleX, scaleY);
  
  const originX = svgWidth / 2;
  // If flying wing, center vertically a bit more
  const originY = isFlyingWing ? padding : padding + (fuseNose * scale);

  const renderHalfWing = (root: number, panels: WingPanel[], startY: number, side: 1 | -1) => {
     let d = `M ${originX} ${startY} `; // Root LE
     let x = 0; 
     let y = 0;
     
     // LE
     panels.forEach(p => {
         x += p.span;
         y += p.sweep;
         d += `L ${originX + (x * scale * side)} ${startY + y * scale} `;
     });
     
     // Tip Chord
     const tipChord = panels[panels.length-1].tip;
     d += `L ${originX + (x * scale * side)} ${startY + (y + tipChord) * scale} `;
     
     // TE back to root
     for (let i = panels.length - 1; i >= 0; i--) {
         const p = panels[i];
         x -= p.span;
         y -= p.sweep;
         const chord = i === 0 ? root : panels[i-1].tip;
         d += `L ${originX + (x * scale * side)} ${startY + (y + chord) * scale} `;
     }
     
     d += "Z";
     return d;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-20">
      {/* --- Left Column: Inputs --- */}
      <div className="lg:col-span-5 space-y-6">
        
        {/* Type Selection */}
        <div className="bg-slate-800/50 p-1 rounded-xl border border-slate-700 flex">
           <button 
             onClick={() => setIsFlyingWing(false)}
             className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${!isFlyingWing ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
           >
             Conventional
           </button>
           <button 
             onClick={() => setIsFlyingWing(true)}
             className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${isFlyingWing ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
           >
             Flying Wing
           </button>
        </div>

        {/* Wing Configuration */}
        <div className="bg-slate-800/50 p-5 rounded-xl border border-slate-700">
           <div className="flex items-center gap-3 mb-4 border-b border-slate-700 pb-2">
             <Icons.Plane className="text-indigo-400" />
             <h2 className="text-lg font-bold text-white">Main Wing</h2>
           </div>
           
           <div className="flex items-center justify-between mb-4">
               <label className="text-xs font-semibold text-slate-400 uppercase">Root Chord [R]</label>
               <div className="flex items-center gap-2">
                 <input 
                   type="number" 
                   value={wingRoot} 
                   onChange={(e) => setWingRoot(parseFloat(e.target.value) || 0)}
                   className="w-24 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded px-2 py-1.5 focus:ring-1 focus:ring-indigo-500"
                 />
                 <span className="text-xs text-slate-500">cm</span>
               </div>
           </div>

           <PanelInputRow 
             label="Tip Chord" field="tip" panels={wingPanels} 
             onChange={(i,f,v) => updatePanel(setWingPanels, i, f, v)} 
             onAdd={() => addPanel(setWingPanels)} onRemove={() => removePanel(setWingPanels)} unit="cm"
           />
           <PanelInputRow 
             label="Sweep" field="sweep" panels={wingPanels} 
             onChange={(i,f,v) => updatePanel(setWingPanels, i, f, v)} 
             onAdd={() => addPanel(setWingPanels)} onRemove={() => removePanel(setWingPanels)} unit="cm"
           />
           <PanelInputRow 
             label="Panel Span" field="span" panels={wingPanels} 
             onChange={(i,f,v) => updatePanel(setWingPanels, i, f, v)} 
             onAdd={() => addPanel(setWingPanels)} onRemove={() => removePanel(setWingPanels)} unit="cm"
           />
        </div>

        {/* Tail Configuration - Conditional */}
        {!isFlyingWing && (
          <div className="bg-slate-800/50 p-5 rounded-xl border border-slate-700 animate-fade-in">
             <div className="flex items-center gap-3 mb-4 border-b border-slate-700 pb-2">
               <Icons.Plane className="text-sky-400 rotate-180" />
               <h2 className="text-lg font-bold text-white">Stabilizer (Tail)</h2>
             </div>
             
             <div className="flex items-center justify-between mb-4">
                 <label className="text-xs font-semibold text-slate-400 uppercase">Root Chord [R]</label>
                 <div className="flex items-center gap-2">
                   <input 
                     type="number" 
                     value={tailRoot} 
                     onChange={(e) => setTailRoot(parseFloat(e.target.value) || 0)}
                     className="w-24 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded px-2 py-1.5 focus:ring-1 focus:ring-indigo-500"
                   />
                   <span className="text-xs text-slate-500">cm</span>
                 </div>
             </div>

             <PanelInputRow 
               label="Tip Chord" field="tip" panels={tailPanels} 
               onChange={(i,f,v) => updatePanel(setTailPanels, i, f, v)} 
               onAdd={() => addPanel(setTailPanels)} onRemove={() => removePanel(setTailPanels)} unit="cm"
             />
             <PanelInputRow 
               label="Sweep" field="sweep" panels={tailPanels} 
               onChange={(i,f,v) => updatePanel(setTailPanels, i, f, v)} 
               onAdd={() => addPanel(setTailPanels)} onRemove={() => removePanel(setTailPanels)} unit="cm"
             />
             <PanelInputRow 
               label="Panel Span" field="span" panels={tailPanels} 
               onChange={(i,f,v) => updatePanel(setTailPanels, i, f, v)} 
               onAdd={() => addPanel(setTailPanels)} onRemove={() => removePanel(setTailPanels)} unit="cm"
             />
          </div>
        )}

        {/* Global Config */}
        <div className="bg-slate-800/50 p-5 rounded-xl border border-slate-700">
          <h2 className="text-lg font-bold text-white mb-4">Configuration</h2>
          
          {!isFlyingWing && (
             <InputGroup label="Distance LE Wing to Tail [D]" value={distWingTail} onChange={setDistWingTail} unit="cm" />
          )}
          
          <div className="grid grid-cols-2 gap-4">
             <InputGroup 
               label="Static Margin" 
               value={staticMargin} 
               onChange={setStaticMargin} 
               unit="%" 
               step={0.5} 
               helpText={isFlyingWing ? "Recommended: 5-10%" : "Recommended: 10-15%"}
             />
             {!isFlyingWing && (
               <InputGroup label="Tail Efficiency" value={tailEff} onChange={setTailEff} step={0.05} max={1.2} />
             )}
          </div>

          {!isFlyingWing && (
            <div className="mt-4 pt-4 border-t border-slate-700 animate-fade-in">
               <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Fuselage</label>
               <div className="grid grid-cols-3 gap-2">
                  <InputGroup label="Length" value={fuseLength} onChange={setFuseLength} unit="cm" />
                  <InputGroup label="Width" value={fuseWidth} onChange={setFuseWidth} unit="cm" />
                  <InputGroup label="Nose Ov." value={fuseNose} onChange={setFuseNose} unit="cm" helpText="Wing LE to Nose" />
               </div>
            </div>
          )}
        </div>
      </div>

      {/* --- Right Column: Results & Viz --- */}
      <div className="lg:col-span-7 space-y-6">
        
        {/* Main Results */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-xl border bg-indigo-900/20 border-indigo-500/50">
             <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-2">Aircraft CG (Center of Gravity)</h3>
             <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-white">{results.cgPosition.toFixed(2)} cm</span>
                <span className="text-sm text-indigo-300">from Wing LE</span>
             </div>
             <p className="text-xs text-indigo-400 mt-1">
               @ {((results.cgPosition - results.wing.macPosition.x) / results.wing.mac * 100).toFixed(1)}% MAC
             </p>
          </div>
          
          <div className="p-5 rounded-xl border bg-slate-800 border-slate-700">
             <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Neutral Point (NP)</h3>
             <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-white">{results.npPosition.toFixed(2)} cm</span>
             </div>
             <p className="text-xs text-slate-500 mt-1">
               Limit of stability (SM = 0%)
             </p>
          </div>
        </div>

        {/* Detailed Stats Table */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden text-sm">
           <div className={`grid ${isFlyingWing ? 'grid-cols-2' : 'grid-cols-3'} bg-slate-900/50 p-3 font-semibold text-slate-400 border-b border-slate-700`}>
             <div>Metric</div>
             <div>Wing</div>
             {!isFlyingWing && <div>Tail</div>}
           </div>
           
           <div className={`grid ${isFlyingWing ? 'grid-cols-2' : 'grid-cols-3'} p-3 border-b border-slate-700/50 hover:bg-slate-700/30`}>
             <div className="text-slate-400">Area</div>
             <div>{Math.round(results.wing.area)} cm²</div>
             {!isFlyingWing && <div>{Math.round(results.tail.area)} cm²</div>}
           </div>
           
           <div className={`grid ${isFlyingWing ? 'grid-cols-2' : 'grid-cols-3'} p-3 border-b border-slate-700/50 hover:bg-slate-700/30`}>
             <div className="text-slate-400">Span</div>
             <div>{Math.round(results.wing.span)} cm</div>
             {!isFlyingWing && <div>{Math.round(results.tail.span)} cm</div>}
           </div>

           <div className={`grid ${isFlyingWing ? 'grid-cols-2' : 'grid-cols-3'} p-3 border-b border-slate-700/50 hover:bg-slate-700/30`}>
             <div className="text-slate-400">MAC Length</div>
             <div>{results.wing.mac.toFixed(1)} cm</div>
             {!isFlyingWing && <div>{results.tail.mac.toFixed(1)} cm</div>}
           </div>

           <div className={`grid ${isFlyingWing ? 'grid-cols-2' : 'grid-cols-3'} p-3 border-b border-slate-700/50 hover:bg-slate-700/30`}>
             <div className="text-slate-400">Aspect Ratio</div>
             <div>{results.wing.aspectRatio.toFixed(1)}</div>
             {!isFlyingWing && <div>{results.tail.aspectRatio.toFixed(1)}</div>}
           </div>
           
           {!isFlyingWing && (
            <div className="grid grid-cols-3 p-3 bg-slate-900/30">
                <div className="text-slate-400">Stabilizer Vol (Vbar)</div>
                <div className="col-span-2 font-mono text-indigo-300">{results.vBar.toFixed(2)}</div>
            </div>
           )}
        </div>

        {/* Visualizer */}
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col items-center">
            <h3 className="text-xs font-bold text-slate-400 uppercase w-full mb-4">Geometry Visualization</h3>
            <div className="relative w-full border border-slate-700/50 rounded bg-[#131b2e] overflow-hidden" style={{ height: svgHeight }}>
                {/* Grid Background */}
                <div className="absolute inset-0 opacity-10" 
                     style={{ backgroundImage: 'linear-gradient(#475569 1px, transparent 1px), linear-gradient(90deg, #475569 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
                </div>

                <svg width="100%" height="100%" viewBox={`0 0 ${svgWidth} ${svgHeight}`} preserveAspectRatio="xMidYMin meet">
                    {/* Fuselage - Only if conventional */}
                    {!isFlyingWing && (
                        <rect 
                        x={originX - (fuseWidth/2)*scale} 
                        y={originY - fuseNose*scale} 
                        width={fuseWidth*scale} 
                        height={fuseLength*scale} 
                        rx={fuseWidth*scale*0.2}
                        fill="#334155"
                        stroke="#475569"
                        />
                    )}

                    {/* Wing Right */}
                    <path d={renderHalfWing(wingRoot, wingPanels, originY, 1)} fill="rgba(255, 255, 255, 0.1)" stroke="#cbd5e1" strokeWidth="1.5" />
                    {/* Wing Left */}
                    <path d={renderHalfWing(wingRoot, wingPanels, originY, -1)} fill="rgba(255, 255, 255, 0.1)" stroke="#cbd5e1" strokeWidth="1.5" />

                    {/* Tail - Only if conventional */}
                    {!isFlyingWing && (
                        <>
                            <path d={renderHalfWing(tailRoot, tailPanels, originY + distWingTail*scale, 1)} fill="rgba(255, 255, 255, 0.1)" stroke="#cbd5e1" strokeWidth="1.5" />
                            <path d={renderHalfWing(tailRoot, tailPanels, originY + distWingTail*scale, -1)} fill="rgba(255, 255, 255, 0.1)" stroke="#cbd5e1" strokeWidth="1.5" />
                        </>
                    )}

                    {/* Markers Group */}
                    <g>
                       {/* Wing MAC Line */}
                       <line 
                         x1={originX - (results.wing.span/2)*scale} 
                         y1={originY + results.wing.macPosition.x*scale} 
                         x2={originX + (results.wing.span/2)*scale} 
                         y2={originY + results.wing.macPosition.x*scale} 
                         stroke="#3b82f6" 
                         strokeWidth="1" 
                         strokeDasharray="4 2" 
                         opacity="0.5"
                       />

                       {/* NP Marker */}
                       <circle cx={originX} cy={originY + results.npPosition*scale} r="4" fill="#22c55e" />
                       <text x={originX + 10} y={originY + results.npPosition*scale + 4} fill="#22c55e" fontSize="10" fontWeight="bold">NP</text>

                       {/* CG Marker */}
                       <circle cx={originX} cy={originY + results.cgPosition*scale} r="5" fill="#ef4444" stroke="white" strokeWidth="2" />
                       <line 
                         x1={originX - 40} 
                         y1={originY + results.cgPosition*scale} 
                         x2={originX + 40} 
                         y2={originY + results.cgPosition*scale} 
                         stroke="#ef4444" 
                         strokeWidth="2" 
                         strokeDasharray="4 4"
                       />
                       <text x={originX - 55} y={originY + results.cgPosition*scale + 3} fill="#ef4444" fontSize="12" fontWeight="bold">CG</text>
                    </g>
                </svg>
            </div>
            <div className="w-full flex justify-between text-xs text-slate-500 mt-2 px-2">
               <span>Origin: Wing Root LE</span>
               <span>{isFlyingWing ? "Flying Wing Mode" : "Conventional Configuration"}</span>
            </div>
        </div>

      </div>
    </div>
  );
};
