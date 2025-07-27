import { useId } from "react"

type Props = {
  title: string
  showHeaders: boolean
  setShowHeaders: (value: boolean) => void
}

export function PanelTabs({ title, showHeaders, setShowHeaders }: Props) {
  const id = useId()

  const handleRequestClick = () => {
    setShowHeaders(false)
  }

  const handleHeadersClick = () => {
    setShowHeaders(true)
  }

  return (
    <div className="tabs tabs-box tabs-xs flex-nowrap">
      <input
        type="radio"
        name={`header-tabs-${id}`}
        className="tab"
        aria-label={title}
        checked={!showHeaders}
        onChange={handleRequestClick}
      />
      <input
        type="radio"
        name={`header-tabs-${id}`}
        className="tab"
        aria-label="Headers"
        checked={showHeaders}
        onChange={handleHeadersClick}
      />
    </div>
  )
}
