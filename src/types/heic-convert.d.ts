declare module 'heic-convert' {
  type ConvertOptions = {
    buffer: ArrayBuffer | Buffer | Uint8Array
    format: 'JPEG' | 'PNG'
    quality?: number
  }
  function convert(options: ConvertOptions): Promise<ArrayBuffer>
  export default convert
}
