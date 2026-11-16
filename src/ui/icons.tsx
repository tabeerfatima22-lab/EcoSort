import type { BinId } from "../core/bins";

const common = { fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** One pictogram per bin, so the bins differ by shape as well as colour. */
export function BinIcon({ bin, size = 28 }: { bin: BinId | "uncertain"; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" {...common}>
      {bin === "general" && (
        <>
          <path d="M6 10h20M12 10V6h8v4M9 10l1.5 16h11L23 10" />
          <path d="M14 15v7M18 15v7" />
        </>
      )}
      {bin === "plastic" && (
        <>
          <path d="M13 3h6v4l3 5v14a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2V12l3-5z" />
          <path d="M10 17h12" />
        </>
      )}
      {bin === "paper" && (
        <>
          <path d="M8 4h11l5 5v19H8z" />
          <path d="M19 4v5h5M12 15h8M12 20h8" />
        </>
      )}
      {bin === "other" && (
        <>
          <path d="M5 9c0-2 2.5-3 5-3s5 1 5 3v16c0 2-2.5 3-5 3s-5-1-5-3z" />
          <path d="M5 10c0 2 2.5 3 5 3s5-1 5-3" />
          <path d="M21 4h4v6l2 4v13a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1V14l2-4z" />
        </>
      )}
      {bin === "uncertain" && (
        <>
          <path d="M16 4 29 27H3z" />
          <path d="M16 13v7M16 23.5v.5" />
        </>
      )}
    </svg>
  );
}
