/**
 * Utility to encode raw audio samples (Float32) into a standard WAV file.
 */
export class WavEncoder {
  static encode(samples: Float32Array, sampleRate: number): Blob {
    const blockAlign = 2; // 1 channel * 2 bytes per sample
    const dataSize = samples.length * blockAlign;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    // RIFF Header
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    this.writeString(view, 8, 'WAVE');

    // fmt Chunk
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);        // Subchunk1Size
    view.setUint16(20, 1, true);         // AudioFormat (PCM)
    view.setUint16(22, 1, true);         // NumChannels (Mono)
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true); // ByteRate
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);        // BitsPerSample

    // data Chunk
    this.writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // PCM Samples
    // Convert Float32 (-1.0 to 1.0) to Int16 (-32768 to 32767)
    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
        let s = Math.max(-1, Math.min(1, samples[i]));
        // Note: bitwise OR 0 is a fast way to truncate to integer
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        offset += 2;
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  private static writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }
}