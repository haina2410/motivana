import { deckLayers, fadeToBackground } from '../deckLayers';
import { getPresetById } from '../presetRepository';
import { colors } from '../../../theme/colors';

describe('fadeToBackground', () => {
  it('keeps the colour when nothing fades', () => {
    expect(fadeToBackground('#D8B487', 0)).toBe('#d8b487');
  });

  it('reaches the background when the fade is complete', () => {
    expect(fadeToBackground('#D8B487', 1)).toBe(
      colors.background.toLowerCase(),
    );
  });

  it('falls back to the raised surface for an unreadable colour', () => {
    expect(fadeToBackground('not-a-colour', 0.5)).toBe(colors.surfaceRaised);
  });
});

describe('deckLayers', () => {
  it('pushes each layer further right and down than the one before', () => {
    const layers = deckLayers(getPresetById('midnight-focus'));
    expect(layers).toHaveLength(2);
    expect(layers[1]!.shift).toBeGreaterThan(layers[0]!.shift);
    expect(layers[1]!.opacity).toBeLessThan(layers[0]!.opacity);
  });

  it('carries the preset colour rather than a grey placeholder', () => {
    const midnight = deckLayers(getPresetById('midnight-focus'));
    const sunrise = deckLayers(getPresetById('sunrise-drive'));
    expect(midnight[0]!.color).not.toBe(sunrise[0]!.color);
  });

  it('still draws a stack without a preset', () => {
    expect(deckLayers(undefined)).toHaveLength(2);
  });
});
