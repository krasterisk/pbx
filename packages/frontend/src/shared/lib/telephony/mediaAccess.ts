/** A permission prompt can remain unanswered indefinitely. Never leave a call stuck there. */
export function boundedMediaStream(
  request: () => Promise<MediaStream>,
  timeoutMs = 15000,
  isActive: () => boolean = () => true,
): Promise<MediaStream> {
  return new Promise((resolve, reject) => {
    let expired = false;
    const timer = setTimeout(() => {
      expired = true;
      reject(new DOMException('Microphone access timed out', 'TimeoutError'));
    }, timeoutMs);
    Promise.resolve().then(request).then((stream) => {
      clearTimeout(timer);
      if (expired || !isActive()) {
        stream.getTracks().forEach((track) => track.stop());
        if (!expired) reject(new DOMException('Call was canceled before microphone access', 'AbortError'));
      } else resolve(stream);
    }, (error: unknown) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}
