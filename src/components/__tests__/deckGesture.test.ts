import {
  COMMIT_RATIO,
  EDGE_RESISTANCE,
  VELOCITY_PROJECTION,
  commitDirection,
  resistDrag,
} from '../deckGesture';

const HEIGHT = 800;
const THRESHOLD = HEIGHT * COMMIT_RATIO;

// Mutation caught: resisting a drag that has a card to reveal would make every
// swipe lag the finger by three quarters of its travel.
test('follows the finger exactly when the card being revealed exists', () => {
  expect(resistDrag(-120, true, true)).toBe(-120);
  expect(resistDrag(120, true, true)).toBe(120);
});

// Mutation caught: pinning the drag at 0 past an end of the trail reads as a
// lost touch, not as an end -- the deck stops answering the finger entirely.
test('gives a fraction of the travel past an end of the trail', () => {
  expect(resistDrag(-200, false, true)).toBe(-200 * EDGE_RESISTANCE);
  expect(resistDrag(200, true, false)).toBe(200 * EDGE_RESISTANCE);
});

// Mutation caught: resisting on the wrong sign holds the deck back on the one
// direction it can actually move in.
test('resists only the direction that has nothing to show', () => {
  expect(resistDrag(-200, true, false)).toBe(-200);
  expect(resistDrag(200, false, true)).toBe(200);
});

// Mutation caught: committing on distance alone refuses a fast, short flick,
// which is the gesture a reader who wants to move quickly actually makes.
test('commits a short flick on its speed', () => {
  const flick = -THRESHOLD / 2;
  expect(commitDirection(flick, 0, HEIGHT, true, true)).toBe('stay');
  expect(commitDirection(flick, -2000, HEIGHT, true, true)).toBe('next');
});

// Mutation caught: ignoring velocity's sign commits a drag the reader was
// pulling back from at the moment they let go.
test('refuses a drag the finger was already reversing', () => {
  const nearlyThere = -THRESHOLD * 1.1;
  const reversing = (THRESHOLD * 0.3) / VELOCITY_PROJECTION;
  expect(commitDirection(nearlyThere, reversing, HEIGHT, true, true)).toBe(
    'stay',
  );
});

// Mutation caught: a slow drag past the threshold is the plain deliberate
// swipe, and it has to commit with no speed at all behind it.
test('commits a slow drag past the threshold', () => {
  expect(commitDirection(-THRESHOLD - 1, 0, HEIGHT, true, true)).toBe('next');
  expect(commitDirection(THRESHOLD + 1, 0, HEIGHT, true, true)).toBe(
    'previous',
  );
});

// Mutation caught: committing towards a card that is not there leaves the
// stack parked a viewport away with nothing to swap in, and the deck freezes.
test('stays put when the card it would commit to is missing', () => {
  expect(commitDirection(-HEIGHT / 2, -3000, HEIGHT, false, true)).toBe('stay');
  expect(commitDirection(HEIGHT / 2, 3000, HEIGHT, true, false)).toBe('stay');
});

// Mutation caught: before layout the threshold is 0, so any travel at all --
// including the jitter of a tap -- would clear it and commit.
test('commits nothing before the viewport has been measured', () => {
  expect(commitDirection(-500, -3000, 0, true, true)).toBe('stay');
});
