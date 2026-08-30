import { Tabs } from 'expo-router/js-tabs';

import { DeckTabBar } from '../../src/components/DeckTabBar';
import { colors } from '../../src/theme/colors';

/**
 * The four home directions of the board sit side by side, not on top of one
 * another. A tab navigator turns every move between them into a jump, so the
 * back stack cannot grow into a chain the reader has to unwind — which a stack
 * of four sibling routes did, whatever the caller asked for.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
      }}
      tabBar={(props) => <DeckTabBar {...props} />}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="customize" />
      <Tabs.Screen name="favorites" />
      <Tabs.Screen name="automation" />
    </Tabs>
  );
}
