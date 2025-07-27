import { useEffect, useState } from "react"

const breakpoints = {
  base: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
}

export const useBreakpoint = () => {
  const [breakpoint, setBreakpoint] = useState<keyof typeof breakpoints>("base")

  useEffect(() => {
    const calcBreakpoint = () => {
      const width = window.innerWidth
      if (width < breakpoints.sm) return setBreakpoint("base")
      if (width < breakpoints.md) return setBreakpoint("sm")
      if (width < breakpoints.lg) return setBreakpoint("md")
      if (width < breakpoints.xl) return setBreakpoint("lg")
      if (width < breakpoints["2xl"]) return setBreakpoint("xl")
      return setBreakpoint("2xl")
    }

    calcBreakpoint()
    window.addEventListener("resize", calcBreakpoint)
    return () => window.removeEventListener("resize", calcBreakpoint)
  }, [])

  return breakpoint
}
