import FontAwesome6 from '@expo/vector-icons/FontAwesome6';

/**
 * The redesign board draws its chrome with Font Awesome 6 solid. Listing the
 * names the application actually uses turns a typo into a type error instead of
 * an empty square on the screen.
 */
export const iconNames = [
  'align-center',
  'align-left',
  'align-right',
  'arrow-down',
  'chevron-left',
  'chevron-right',
  'chevron-up',
  'circle-check',
  'circle-info',
  'clock-rotate-left',
  'clone',
  'download',
  'font',
  'gear',
  'heart',
  'house',
  'layer-group',
  'lock',
  'mobile-screen',
  'palette',
  'rotate-right',
  'shield-halved',
  'shuffle',
  'sliders',
  'swatchbook',
  'triangle-exclamation',
  'wand-magic-sparkles',
  'xmark',
] as const;

export type IconName = (typeof iconNames)[number];

interface IconProps {
  name: IconName;
  size: number;
  color: string;
}

export function Icon({ name, size, color }: IconProps) {
  return (
    <FontAwesome6
      name={name}
      size={size}
      color={color}
      iconStyle="solid"
      // The glyph is decoration; the pressable around it carries the label.
      accessible={false}
    />
  );
}
