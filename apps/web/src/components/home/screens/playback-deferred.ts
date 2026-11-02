export function playbackDeferred() {
  let complete!: (value: boolean) => void;
  // oxlint-disable-next-line promise/avoid-new -- Playback cancellation resolves from timer and visibility callbacks.
  const promise = new Promise<boolean>((resolve) => {
    complete = resolve;
  });
  return { promise, resolve: complete };
}
