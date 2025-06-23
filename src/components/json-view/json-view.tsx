import { allExpanded, JsonView } from "react-json-view-lite"
import { tailwindStyles } from "./json-styles"

type Props = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: object | any[]
}

export function JSONView({ data }: Props) {
  return (
    <JsonView
      data={data}
      shouldExpandNode={allExpanded}
      clickToExpandNode={true}
      style={tailwindStyles}
    />
  )
}
