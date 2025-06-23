import type { StyleProps } from "react-json-view-lite/dist/DataRenderer"

export const tailwindStyles: StyleProps = {
  container:
    "bg-base-100 whitespace-pre-wrap wrap-break-word text-sm p-4 rounded font-mono",
  basicChildStyle: "pl-4",
  childFieldsContainer: "",
  label: "text-green-400 font-semibold mr-1",
  clickableLabel: "cursor-pointer text-green-400 font-semibold mr-1",
  nullValue: "text-pink-500",
  undefinedValue: "text-pink-500",
  stringValue: "text-yellow-400",
  numberValue: "text-blue-400",
  booleanValue: "text-purple-400",
  otherValue: "text-gray-400",
  punctuation: "text-gray-500 font-bold",
  collapseIcon: "cursor-pointer text-white before:content-['▾'] mr-1",
  expandIcon: "cursor-pointer text-white before:content-['▸'] mr-1",
  collapsedContent:
    "cursor-pointer text-gray-400 before:content-['...'] text-xs",
  noQuotesForStringValues: false,
  quotesForFieldNames: false,
  ariaLables: {
    collapseJson: "collapse JSON",
    expandJson: "expand JSON",
  },
  stringifyStringValues: false,
}
