import type { StyleProps } from "react-json-view-lite/dist/DataRenderer"

export const tailwindStyles: StyleProps = {
  container:
    "bg-base-100 whitespace-pre-wrap wrap-break-word text-sm rounded font-mono",
  basicChildStyle: "pl-4",
  childFieldsContainer: "",
  label: "text-primary font-semibold mr-1",
  clickableLabel: "cursor-pointer text-primary font-semibold mr-1",
  nullValue: "text-secondary",
  undefinedValue: "text-secondary",
  stringValue: "text-secondary",
  numberValue: "text-secondary",
  booleanValue: "text-secondary",
  otherValue: "text-secondary",
  punctuation: "text-accent font-bold",
  collapseIcon: "cursor-pointer text-base-content before:content-['▾'] mr-1",
  expandIcon: "cursor-pointer text-base-content before:content-['▸'] mr-1",
  collapsedContent:
    "cursor-pointer text-base-content before:content-['...'] text-xs",
  noQuotesForStringValues: false,
  quotesForFieldNames: false,
  ariaLables: {
    collapseJson: "collapse JSON",
    expandJson: "expand JSON",
  },
  stringifyStringValues: false,
}
