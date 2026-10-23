export type Frame = { trailers: boolean; compressed: boolean; data: Uint8Array }

// Each frame: 1 flag byte (0x80 trailers, 0x01 compressed), 4-byte big-endian length.
export function readFrames(body: Uint8Array): Frame[] {
  const view = new DataView(body.buffer, body.byteOffset, body.byteLength)
  const frames: Frame[] = []
  for (let at = 0; at < body.length; ) {
    const flag = view.getUint8(at)
    const end = at + 5 + view.getUint32(at + 1)
    if (end > body.length) throw new RangeError("frame runs past the end")
    frames.push({
      trailers: (flag & 0x80) !== 0,
      compressed: (flag & 1) !== 0,
      data: body.subarray(at + 5, end),
    })
    at = end
  }
  return frames
}
