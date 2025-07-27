type Props = {
  headers: chrome.devtools.network.Request["request"]["headers"]
}

export function HeadersTable({ headers }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="table table-sm table-zebra">
        <thead>
          <tr>
            <th className="min-w-36">Name</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {headers.map((header) => (
            <tr>
              <th>{header.name}</th>
              <td>{header.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
