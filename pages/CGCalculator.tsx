
import React, { useState, useEffect, useMemo } from 'react';
import { InputGroup } from '../components/InputGroup';
import { Icons } from '../constants';

// --- Types ---
interface WingPanel {
  id: number;
  tip: number;   // Tip Chord (cm)
  sweep: number; // Sweep distance (cm) - X offset of tip LE relative to root LE
  span: number;  // Panel Span (cm)
}

interface SurfaceAnalysis {
  area: number;        // cm2 (total both sides)
  span: number;        // cm (total)
  mac: number;         // cm (Mean Aerodynamic Chord)
  acX: number;         // cm (Aerodynamic Center X relative to Surface Root LE)
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
  let currentRoot = rootChord;
  let currentX_LE = 0; // X position of LE at start of panel (relative to surface root)
  
  // Accumulators
  let sumArea = 0;
  let sumAreaMac = 0; // Area * MAC
  let sumAreaAcX = 0; // Area * AC_X_Global
  let totalSpanHalf = 0;

  panels.forEach(panel => {
    const Cr = currentRoot;
    const Ct = panel.tip;
    const b = panel.span; // Panel Span
    const sweep = panel.sweep; // X offset of tip LE from root LE

    // 1. Panel Area (Si)
    const Si = ((Cr + Ct) / 2) * b;

    // 2. Taper Ratio (lambda)
    // Avoid division by zero
    const lambda = Cr > 0 ? Ct / Cr : 1;

    // 3. Panel MAC Length (MACi)
    const MACi = (2/3) * Cr * ((1 + lambda + Math.pow(lambda, 2)) / (1 + lambda));

    // 4. Panel MAC Spanwise Position (Y_mac_i) relative to panel root
    const Y_mac_i = (b / 6) * ((1 + 2 * lambda) / (1 + lambda));

    // 5. Panel MAC LE X Position (X_LE_mac_i) relative to panel root LE
    // Interpolate sweep along span: X = Y * (sweep / b)
    const X_LE_mac_i_local = b > 0 ? Y_mac_i * (sweep / b) : 0;
    
    // Absolute X relative to Surface Root
    const X_LE_mac_i_global = currentX_LE + X_LE_mac_i_local;

    // 6. Panel AC Position (X_AC_i)
    // AC is typically at 25% of MAC
    const X_AC_i = X_LE_mac_i_global + (0.25 * MACi);

    // Accumulate weighted values
    sumArea += Si;
    sumAreaMac += Si * MACi;
    sumAreaAcX += Si * X_AC_i;
    totalSpanHalf += b;

    // Prepare for next panel
    currentRoot = Ct;
    currentX_LE += sweep;
  });

  const totalArea = sumArea * 2; // Both sides
  const globalMAC = sumArea > 0 ? sumAreaMac / sumArea : 0;
  const globalAcX = sumArea > 0 ? sumAreaAcX / sumArea : 0;

  return {
    area: totalArea,
    span: totalSpanHalf * 2,
    mac: globalMAC,
    acX: globalAcX,
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

  // Fuselage (Standard Tube approx)
  const [fuseWidth, setFuseWidth] = useState(8);
  const [fuseLength, setFuseLength] = useState(90);
  const [fuseNose, setFuseNose] = useState(20); // Nose overhang from Wing LE

  // --- Calculations ---
  const results = useMemo(() => {
    // Step A: Main Wing
    const wing = calculateSurface(wingRoot, wingPanels);

    let tail: SurfaceAnalysis;
    let npPosition = 0; // Neutral Point X relative to Wing LE
    let vBar = 0; // Tail Volume Coeff
    let fuselagePenalty = 0;

    if (isFlyingWing) {
       // Flying Wing: NP is just the Wing's AC
       tail = { area: 0, span: 0, mac: 0, acX: 0, rootChord: 0 };
       npPosition = wing.acX;
    } else {
       // Step B: Horizontal Tail
       tail = calculateSurface(tailRoot, tailPanels);
       
       // Tail AC X Global = Dist + Tail AC Local
       const tailAcX_Global = distWingTail + tail.acX;

       // Step D: Neutral Point (Simplified Formula)
       // X_NP = [ (X_AC_w * Sw) + (X_AC_t * St * eta) ] / [ Sw + (St * eta) ]
       const numerator = (wing.acX * wing.area) + (tailAcX_Global * tail.area * tailEff);
       const denominator = wing.area + (tail.area * tailEff);
       
       const npWingTail = denominator > 0 ? numerator / denominator : 0;
       
       // Step C: Fuselage Effect (Penalty)
       // Shift NP forward by approx 1.5% of MAC for standard layout
       fuselagePenalty = wing.mac * 0.015;
       npPosition = npWingTail - fuselagePenalty;

       // Tail Volume (Vbar)
       // Vbar = (St * l_tail) / (Sw * MAC_w) where l_tail is distance between ACs
       const lTail = tailAcX_Global - wing.acX;
       vBar = (wing.area > 0 && wing.mac > 0) ? (tail.area * lTail) / (wing.area * wing.mac) : 0;
    }

    // Step E: Final CG
    // CG = NP - (SM% * MAC)
    const cgPosition = npPosition - ((staticMargin / 100) * wing.mac);

    return {
      wing,
      tail,
      npPosition,
      cgPosition,
      vBar,
      fuselagePenalty
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
  const svgWidth = 800;
  const svgHeight = 500;
  const padding = 60;
  
  // Scale Calculation
  const maxSpanHalf = Math.max(results.wing.span/2, isFlyingWing ? 0 : results.tail.span/2);
  // Total Length needed: From Nose (negative X) to Tail TE (positive X)
  // Max X is Tail Root LE + Tail Total Sweep + Tail Tip Chord
  let maxLen = 0;
  let minLen = 0; // Negative X (Nose)
  
  // Calculate Wing Max Depth (X)
  let wingMaxX = 0;
  let curX = 0;
  wingPanels.forEach(p => { curX += p.sweep; });
  wingMaxX = curX + wingPanels[wingPanels.length-1].tip;

  if (isFlyingWing) {
     maxLen = wingMaxX;
     minLen = 0;
  } else {
     let tailMaxX = 0;
     let tX = 0;
     tailPanels.forEach(p => { tX += p.sweep; });
     tailMaxX = distWingTail + tX + tailPanels[tailPanels.length-1].tip;
     
     maxLen = Math.max(fuseLength - fuseNose, tailMaxX);
     minLen = -fuseNose;
  }
  
  // Determine Scale Factor
  const availableWidth = svgWidth - (padding * 2);
  const availableHeight = svgHeight - (padding * 2);
  
  const totalGeoWidth = maxSpanHalf * 2.2; // A bit of buffer
  const totalGeoHeight = (maxLen - minLen) * 1.2;
  
  const scaleX = availableWidth / totalGeoWidth;
  const scaleY = availableHeight / totalGeoHeight;
  const scale = Math.min(scaleX, scaleY);
  
  const originX = svgWidth / 2; // Screen Center X (Spanwise center)
  // Screen Y origin (Datum 0,0) needs to be positioned such that Nose fits
  const originY = padding + (Math.abs(minLen) * scale); 

  const renderHalfWingPath = (root: number, panels: WingPanel[], startY: number, side: 1 | -1) => {
     let d = `M ${originX} ${startY} `; // Root LE (0,0 relative to startY)
     let x_span = 0; 
     let y_long = 0;
     
     // Leading Edge
     panels.forEach(p => {
         x_span += p.span;
         y_long += p.sweep;
         // Screen X = originX + (span * side)
         // Screen Y = originY + sweep
         d += `L ${originX + (x_span * scale * side)} ${startY + y_long * scale} `;
     });
     
     // Tip Chord
     const tipChord = panels[panels.length-1].tip;
     d += `L ${originX + (x_span * scale * side)} ${startY + (y_long + tipChord) * scale} `;
     
     // Trailing Edge back to root
     for (let i = panels.length - 1; i >= 0; i--) {
         const p = panels[i];
         x_span -= p.span;
         y_long -= p.sweep;
         const chord = i === 0 ? root : panels[i-1].tip;
         d += `L ${originX + (x_span * scale * side)} ${startY + (y_long + chord) * scale} `;
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
               <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Fuselage (Approx)</label>
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
             <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-2">Center of Gravity (CG)</h3>
             <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-white">{results.cgPosition.toFixed(1)} cm</span>
             </div>
             <p className="text-sm font-medium text-indigo-200 mt-1">
               from Wing Leading Edge
             </p>
             <p className="text-xs text-indigo-400 mt-2">
               @ {((results.cgPosition / results.wing.mac) * 100).toFixed(1)}% MAC
             </p>
          </div>
          
          <div className="p-5 rounded-xl border bg-slate-800 border-slate-700">
             <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Neutral Point (NP)</h3>
             <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-white">{results.npPosition.toFixed(1)} cm</span>
             </div>
             <p className="text-xs text-slate-500 mt-1">
               Limit of stability (SM = 0%)
             </p>
             {!isFlyingWing && (
               <p className="text-xs text-slate-600 mt-2">
                 Includes ~{results.fuselagePenalty.toFixed(1)}cm fuselage penalty
               </p>
             )}
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
             <div className="text-slate-400">Total Span</div>
             <div>{Math.round(results.wing.span)} cm</div>
             {!isFlyingWing && <div>{Math.round(results.tail.span)} cm</div>}
           </div>

           <div className={`grid ${isFlyingWing ? 'grid-cols-2' : 'grid-cols-3'} p-3 border-b border-slate-700/50 hover:bg-slate-700/30`}>
             <div className="text-slate-400">MAC Length</div>
             <div>{results.wing.mac.toFixed(1)} cm</div>
             {!isFlyingWing && <div>{results.tail.mac.toFixed(1)} cm</div>}
           </div>
           
           <div className={`grid ${isFlyingWing ? 'grid-cols-2' : 'grid-cols-3'} p-3 border-b border-slate-700/50 hover:bg-slate-700/30`}>
             <div className="text-slate-400">AC Position (Local)</div>
             <div>{results.wing.acX.toFixed(1)} cm</div>
             {!isFlyingWing && <div>{results.tail.acX.toFixed(1)} cm</div>}
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
                    {/* Datum Line */}
                    <line x1="0" y1={originY} x2={svgWidth} y2={originY} stroke="#f43f5e" strokeWidth="1" strokeDasharray="5 5" opacity="0.5" />
                    <text x="10" y={originY - 5} fill="#f43f5e" fontSize="10" opacity="0.7">DATUM (0,0) - WING ROOT LE</text>

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
                    <path d={renderHalfWingPath(wingRoot, wingPanels, originY, 1)} fill="rgba(59, 130, 246, 0.1)" stroke="#60a5fa" strokeWidth="1.5" />
                    {/* Wing Left */}
                    <path d={renderHalfWingPath(wingRoot, wingPanels, originY, -1)} fill="rgba(59, 130, 246, 0.1)" stroke="#60a5fa" strokeWidth="1.5" />

                    {/* Tail - Only if conventional */}
                    {!isFlyingWing && (
                        <>
                            <path d={renderHalfWingPath(tailRoot, tailPanels, originY + distWingTail*scale, 1)} fill="rgba(255, 255, 255, 0.1)" stroke="#94a3b8" strokeWidth="1.5" />
                            <path d={renderHalfWingPath(tailRoot, tailPanels, originY + distWingTail*scale, -1)} fill="rgba(255, 255, 255, 0.1)" stroke="#94a3b8" strokeWidth="1.5" />
                        </>
                    )}

                    {/* Markers Group */}
                    <g>
                       {/* Wing MAC Line (Approximation drawn at center span) */}
                       {/* We visualize the MAC length at the MAC spanwise position? Too complex for 2D. Just draw markers on center line. */}

                       {/* Wing AC Marker */}
                       <circle cx={originX} cy={originY + results.wing.acX*scale} r="3" fill="#60a5fa" />
                       <text x={originX + 6} y={originY + results.wing.acX*scale + 3} fill="#60a5fa" fontSize="9">ACw</text>

                       {/* NP Marker */}
                       <circle cx={originX} cy={originY + results.npPosition*scale} r="4" fill="#22c55e" />
                       <text x={originX + 8} y={originY + results.npPosition*scale + 4} fill="#22c55e" fontSize="10" fontWeight="bold">NP</text>

                       {/* CG Marker */}
                       <circle cx={originX} cy={originY + results.cgPosition*scale} r="6" fill="#ef4444" stroke="white" strokeWidth="2" />
                       {/* CG Crosshair */}
                       <line 
                         x1={originX - 60} 
                         y1={originY + results.cgPosition*scale} 
                         x2={originX + 60} 
                         y2={originY + results.cgPosition*scale} 
                         stroke="#ef4444" 
                         strokeWidth="2" 
                         strokeDasharray="4 4"
                       />
                       <text x={originX - 75} y={originY + results.cgPosition*scale + 4} fill="#ef4444" fontSize="14" fontWeight="bold">CG</text>
                    </g>
                </svg>
            </div>
            <div className="w-full flex justify-between text-xs text-slate-500 mt-2 px-2">
               <span>Origin: Wing Root Leading Edge</span>
               <span>{isFlyingWing ? "Flying Wing Mode" : "Conventional Configuration"}</span>
            </div>
        </div>

      </div>
    </div>
  );
};
