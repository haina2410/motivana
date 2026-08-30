/**
 * The two decisions the deck's pan gesture makes, as plain functions. They run
 * inside worklets on the UI thread, where a test cannot reach them: the
 * gesture-handler mock dispatches no real pan. Kept here they are ordinary
 * arithmetic with a test each.
 */

/** A drag past this fraction of the viewport commits, whatever the speed. */
export const COMMIT_RATIO = 0.22;

/**
 * A flick is projected this many seconds past where the finger left off.
 * Distance alone would refuse a fast, short flick, which is the gesture a
 * reader who wants to move quickly actually makes.
 */
export const VELOCITY_PROJECTION = 0.15;

/** Past an end of the trail the stack follows the finger at this rate. */
export const EDGE_RESISTANCE = 0.25;

export type DeckCommit = 'next' | 'previous' | 'stay';

/**
 * How far the stack moves for a drag of `raw`. Dragging towards a card that
 * is not there returns a fraction of the travel, so the deck gives a little
 * and springs back. Pinning it at 0 instead reads as a lost touch rather than
 * as the end of the trail.
 */
export function resistDrag(
  raw: number,
  hasNext: boolean,
  hasPrevious: boolean,
): number {
  'worklet';
  // Up is negative: a negative offset pulls the next card into view.
  if (raw < 0 && !hasNext) return raw * EDGE_RESISTANCE;
  if (raw > 0 && !hasPrevious) return raw * EDGE_RESISTANCE;
  return raw;
}

/** Which card the deck settles on when the finger lifts. */
export function commitDirection(
  offset: number,
  velocityY: number,
  height: number,
  hasNext: boolean,
  hasPrevious: boolean,
): DeckCommit {
  'worklet';
  // Before layout there is no viewport to measure a drag against, so nothing
  // the finger did can mean anything yet.
  if (height <= 0) return 'stay';
  // Where the card would come to rest if the finger's speed carried it on.
  const projected = offset + velocityY * VELOCITY_PROJECTION;
  const threshold = height * COMMIT_RATIO;
  if (projected < -threshold) return hasNext ? 'next' : 'stay';
  if (projected > threshold) return hasPrevious ? 'previous' : 'stay';
  return 'stay';
}
