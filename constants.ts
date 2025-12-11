import React from 'react';

// Simplified icons as SVG components
export const Icons = {
  Propeller: (props: React.SVGProps<SVGSVGElement>) => React.createElement(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      width: "24",
      height: "24",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      ...props
    },
    React.createElement("path", { d: "M12 12c0-3 2.5-5.5 6-5.5 4 0 4.5 4.5 4.5 5.5s-.5 5.5-4.5 5.5c-3.5 0-6-2.5-6-5.5zm0 0c0 3-2.5 5.5-6 5.5-4 0-4.5-4.5-4.5-5.5s.5-5.5 4.5-5.5c3.5 0 6 2.5 6 5.5z" }),
    React.createElement("circle", { cx: "12", cy: "12", r: "2" })
  ),
  Plane: (props: React.SVGProps<SVGSVGElement>) => React.createElement(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      width: "24",
      height: "24",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      ...props
    },
    React.createElement("path", { d: "M2 12h20" }),
    React.createElement("path", { d: "M12 2l3 10-3 10-3-10z" })
  ),
  Scale: (props: React.SVGProps<SVGSVGElement>) => React.createElement(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      width: "24",
      height: "24",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      ...props
    },
    React.createElement("path", { d: "m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1z" }),
    React.createElement("path", { d: "m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1z" }),
    React.createElement("path", { d: "M7 21h10" }),
    React.createElement("path", { d: "M12 3v18" }),
    React.createElement("path", { d: "M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" })
  ),
  Cpu: (props: React.SVGProps<SVGSVGElement>) => React.createElement(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      width: "24",
      height: "24",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      ...props
    },
    React.createElement("rect", { x: "4", y: "4", width: "16", height: "16", rx: "2", ry: "2" }),
    React.createElement("rect", { x: "9", y: "9", width: "6", height: "6" }),
    React.createElement("path", { d: "M9 1v3" }),
    React.createElement("path", { d: "M15 1v3" }),
    React.createElement("path", { d: "M9 20v3" }),
    React.createElement("path", { d: "M15 20v3" }),
    React.createElement("path", { d: "M20 9h3" }),
    React.createElement("path", { d: "M20 14h3" }),
    React.createElement("path", { d: "M1 9h3" }),
    React.createElement("path", { d: "M1 14h3" })
  ),
  Alert: (props: React.SVGProps<SVGSVGElement>) => React.createElement(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      width: "24",
      height: "24",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      ...props
    },
    React.createElement("circle", { cx: "12", cy: "12", r: "10" }),
    React.createElement("line", { x1: "12", y1: "8", x2: "12", y2: "12" }),
    React.createElement("line", { x1: "12", y1: "16", x2: "12.01", y2: "16" })
  ),
  Check: (props: React.SVGProps<SVGSVGElement>) => React.createElement(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      width: "24",
      height: "24",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      ...props
    },
    React.createElement("polyline", { points: "20 6 9 17 4 12" })
  ),
  Info: (props: React.SVGProps<SVGSVGElement>) => React.createElement(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      width: "24",
      height: "24",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      ...props
    },
    React.createElement("circle", { cx: "12", cy: "12", r: "10" }),
    React.createElement("path", { d: "M12 16v-4" }),
    React.createElement("path", { d: "M12 8h.01" })
  )
};