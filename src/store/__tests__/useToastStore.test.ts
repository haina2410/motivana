import { useToastStore } from '../useToastStore';

beforeEach(() => {
  useToastStore.setState({ toast: undefined });
});

test('raises the message the caller asked for', () => {
  useToastStore.getState().showToast('Saved');

  expect(useToastStore.getState().toast).toMatchObject({
    message: 'Saved',
    tone: 'default',
  });
});

test('carries the error tone when the caller reports a failure', () => {
  useToastStore.getState().showToast('Could not save', 'error');

  expect(useToastStore.getState().toast?.tone).toBe('error');
});

// Mutation caught: reusing one id would let the previous toast's hide timer
// dismiss the message that replaced it, so the second result would flash.
test('gives every toast its own id, including a repeat of the same text', () => {
  useToastStore.getState().showToast('Saved');
  const first = useToastStore.getState().toast!;
  useToastStore.getState().showToast('Saved');
  const second = useToastStore.getState().toast!;

  expect(second.id).not.toBe(first.id);
});

test('hides the toast the caller names', () => {
  useToastStore.getState().showToast('Saved');
  const { id } = useToastStore.getState().toast!;

  useToastStore.getState().hideToast(id);

  expect(useToastStore.getState().toast).toBeUndefined();
});

// Mutation caught: hiding without checking the id lets a late timer from the
// dismissed toast wipe the one on screen now.
test('keeps the toast on screen when an older id asks to hide', () => {
  useToastStore.getState().showToast('First');
  const stale = useToastStore.getState().toast!.id;
  useToastStore.getState().showToast('Second');

  useToastStore.getState().hideToast(stale);

  expect(useToastStore.getState().toast?.message).toBe('Second');
});
