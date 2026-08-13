export const S = 50 // пикселей в одном метре
export const MIN_W = 300
export const maxW = () => Math.max(MIN_W, Math.round(window.innerWidth * 0.6))
export const clampW = (w: number) => Math.max(MIN_W, Math.min(maxW(), Math.round(w)))
