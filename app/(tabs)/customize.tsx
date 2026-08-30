import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  FlatList,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionMessage } from '../../src/components/ActionMessage';
import { AppButton } from '../../src/components/AppButton';
import { FilterChip } from '../../src/components/FilterChip';
import { PresetThumbnail } from '../../src/components/PresetThumbnail';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { getQuoteById } from '../../src/features/quotes/quoteRepository';
import { getAllTemplates } from '../../src/features/wallpaper/presetRepository';
import {
  ALL_FILTER,
  PLAIN_FILTER,
  filterTemplates,
  templateFilters,
} from '../../src/features/wallpaper/templateFilters';
import {
  GRID_GAP,
  gridColumns,
} from '../../src/features/wallpaper/gridColumns';
import { useTranslate } from '../../src/features/i18n/useTranslate';
import type { StringKey } from '../../src/features/i18n/t';
import { useAppStore } from '../../src/store/useAppStore';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

const HORIZONTAL_PADDING = spacing.x2 + 2;

/** Screen 1f of the board: the curated presets and every photographic background. */
export default function CustomizeScreen() {
  const state = useAppStore();
  const translate = useTranslate();
  const { width } = useWindowDimensions();
  const [pendingPresetId, setPendingPresetId] = useState<string>();
  const [failedPresetId, setFailedPresetId] = useState<string>();
  const [filter, setFilter] = useState<string>(ALL_FILTER);
  const selectPreset = async (presetId: string) => {
    if (pendingPresetId !== undefined) return;
    setPendingPresetId(presetId);
    setFailedPresetId(undefined);
    const selected = await state.selectPreset(presetId);
    setPendingPresetId(undefined);
    if (selected) {
      router.navigate('/');
      return;
    }
    setFailedPresetId(presetId);
  };
  const templates = getAllTemplates();
  const filters = useMemo(() => templateFilters(templates), [templates]);
  const shown = useMemo(
    () => filterTemplates(templates, filter),
    [templates, filter],
  );
  const columns = gridColumns(width - HORIZONTAL_PADDING * 2);
  const quote = getQuoteById(state.currentQuoteId);
  if (!quote) return null;

  const filterLabel = (id: string): string => {
    if (id === ALL_FILTER) return translate('filter.all');
    if (id === PLAIN_FILTER) return translate('filter.plain');
    return translate(`category.${id}` as StringKey);
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <View style={styles.body}>
        <ScreenHeader
          title={translate('customize.title')}
          subtitle={translate('presets.subtitle')}
        />
        {failedPresetId ? (
          <View style={styles.feedback}>
            <ActionMessage
              tone="error"
              message={translate('customize.error')}
            />
            <AppButton
              hint={translate('customize.retry.hint')}
              icon="rotate-right"
              label={translate('customize.retry.label')}
              onPress={() => void selectPreset(failedPresetId)}
              variant="outline"
            />
          </View>
        ) : null}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
          style={styles.filterRow}
        >
          {filters.map((entry) => (
            <FilterChip
              key={entry.id}
              accessibilityHint={translate('filter.chip.hint', {
                name: filterLabel(entry.id),
              })}
              count={entry.count}
              label={filterLabel(entry.id)}
              onPress={() => setFilter(entry.id)}
              selected={filter === entry.id}
            />
          ))}
        </ScrollView>
        <FlatList
          // Remounting on a column change is what makes numColumns safe to vary.
          key={columns}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.grid}
          data={shown}
          // Without virtualisation every card would mount a Skia canvas at once.
          initialNumToRender={columns * 4}
          keyExtractor={(preset) => preset.id}
          numColumns={columns}
          removeClippedSubviews
          renderItem={({ item }) => (
            <View style={styles.slot}>
              <PresetThumbnail
                preset={item}
                quote={quote}
                locale={state.contentLocale}
                selected={state.selectedPresetId === item.id}
                disabled={pendingPresetId !== undefined}
                onPress={() => void selectPreset(item.id)}
              />
            </View>
          )}
          showsVerticalScrollIndicator={false}
          windowSize={5}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  body: {
    flex: 1,
    gap: spacing.x1 + 4,
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: spacing.x1,
  },
  feedback: { gap: spacing.x1 },
  // The row scrolls edge to edge: it cancels the body's padding and carries
  // it inside instead, so the first chip still lines up with the grid while a
  // chip that runs off the screen reads as "there is more" rather than as a
  // chip clipped by the page margin.
  filterRow: { flexGrow: 0, marginHorizontal: -HORIZONTAL_PADDING },
  filters: {
    gap: spacing.x1,
    paddingHorizontal: HORIZONTAL_PADDING,
  },
  grid: { gap: GRID_GAP, paddingBottom: spacing.x3 },
  row: { gap: GRID_GAP },
  slot: { flex: 1 },
});
