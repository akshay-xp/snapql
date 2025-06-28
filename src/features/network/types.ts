export type ParsedRequest = {
  id: string | number | null | undefined
  startDateTime: Date
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any
  response: object
}
