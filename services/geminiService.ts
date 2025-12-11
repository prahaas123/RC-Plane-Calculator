
import { GoogleGenAI, Type } from "@google/genai";
import { AircraftConfig, AircraftRequirements } from "../types";

const GEMINI_API_KEY = process.env.API_KEY || '';

export const analyzeAircraftSetup = async (config: AircraftConfig | AircraftRequirements): Promise<string> => {
  if (!GEMINI_API_KEY) {
    return "API Key not found. Please ensure the API_KEY environment variable is set.";
  }

  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    let prompt = '';

    // Check if it's the new Requirements type (has 'mission' property)
    if ('mission' in config) {
      prompt = `
        Act as an expert RC aircraft engineer. Recommend a specific power system setup (Motor, Propeller, ESC, Battery Capacity) for an airplane with the following REQUIREMENTS:
        
        Airplane:
        - Type: ${config.wingType}
        - AUW: ${config.weight}g
        - Span: ${config.span}mm
        - Wing Area: ${config.wingArea}dm²
        
        Target Performance:
        - Mission: ${config.mission}
        - Speed: ${config.speed} km/h
        - Thrust: ${config.thrust} g
        - Flight Time: ${config.flightTime} min
        
        Constraints:
        - Battery: ${config.cells}S ${config.batteryType}
        - Motor: Max weight ${config.weight * (config.maxMotorWeightPct/100)}g (${config.maxMotorWeightPct}%)
        - Prop: Max ${config.maxPropDiameter} inch, ${config.blades} blades
        - Environment: ${config.temp}°C, ${config.elevation}m elevation

        Please provide:
        1. Recommended Motor size (Stator) and KV rating.
        2. Recommended Propeller size (Diameter x Pitch).
        3. Required ESC rating (Amps).
        4. Recommended Battery Capacity (mAh) to achieve flight time.
        5. Estimated current draw and performance summary.
        
        Format as concise Markdown.
      `;
    } else {
      // Existing Config Analysis
      prompt = `
        Act as an expert RC (Remote Control) aircraft engineer. Analyze the following electric aircraft setup configuration:

        Motor:
        - KV: ${config.motor.kv}
        - Resistance: ${config.motor.resistance} Ohms
        - Weight: ${config.motor.weight}g
        - Max Current: ${config.motor.maxCurrent}A

        Battery:
        - Cells: ${config.battery.cells}S (LiPo)
        - Capacity: ${config.battery.capacity}mAh
        - C-Rating: ${config.battery.cRating}C
        - Weight: ${config.battery.weight}g

        Propeller:
        - Diameter: ${config.prop.diameter} inches
        - Pitch: ${config.prop.pitch} inches
        - Blades: ${config.prop.blades}

        ESC Rating: ${config.escRating}A
        Total Estimated Weight: ${config.totalWeight}g

        Please provide:
        1. A brief summary of expected performance (thrust-to-weight ratio, estimated flight time type).
        2. Any potential red flags (e.g., motor over-amping, battery C-rating too low, propeller too large for KV).
        3. A suitability rating for typical flying styles (Trainer, Sport, 3D, Speed).
        
        Format the output in clear Markdown. Keep it concise but technical.
      `;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: "You are a helpful, precise, and safety-conscious aerodynamics expert assistant.",
      }
    });

    return response.text || "No analysis could be generated.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "An error occurred while contacting the analysis service. Please try again later.";
  }
};
