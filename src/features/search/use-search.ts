import { useDeferredValue, useMemo, useState } from "react"
import type { ParsedRequest } from "../network/types"
import Fuse from "fuse.js"

type Props = {
  parsedRequests: ParsedRequest[]
}

export function useSearch({ parsedRequests }: Props) {
  const [searchPattern, setSearchPattern] = useState("")
  const deferredSearchPattern = useDeferredValue(searchPattern)
  const [newestFirst, setNewestFirst] = useState(true)

  const results = useMemo(() => {
    // shallow clone
    let tempResults = parsedRequests.slice()

    // search
    if (deferredSearchPattern.trim()) {
      const fuse = new Fuse(tempResults, {
        keys: ["operationName"],
        threshold: 0.4,
        // skip sort by score
        shouldSort: false,
      })
      const fuseResults = fuse.search(deferredSearchPattern.trim())
      tempResults = fuseResults.map((res) => res.item)
    }

    // sort
    tempResults.sort(
      (a, b) =>
        (newestFirst ? -1 : 1) *
        (a.startDateTime.getTime() - b.startDateTime.getTime())
    )

    return tempResults
  }, [parsedRequests, deferredSearchPattern, newestFirst])

  return {
    results,
    setSearchPattern,
    newestFirst,
    setNewestFirst,
  }
}
