import { en } from './en';

export const vi: Record<keyof typeof en, string> = {
  'common.back.label': 'Back to Home',
  'common.back.hint': 'Returns to the wallpaper preview.',

  'home.eyebrow': 'MAKE YOUR FOCUS VISIBLE',
  'home.title': 'Motivana',
  'home.loading': 'Preparing your wallpaper',
  'home.customize.label': 'Customize wallpaper',
  'home.customize.hint': 'Choose a wallpaper preset.',
  'home.favorites.label': 'Open favorites',
  'home.favorites.hint': 'Browse favorite quotes.',
  'home.automation.label': 'Open automation',
  'home.automation.hint': 'Review wallpaper rotation preferences.',
  'home.settings.label': 'Open settings',
  'home.settings.hint': 'Change application preferences.',
  'home.previous.label': 'Previous quote',
  'home.previous.hint': 'Shows the previous motivational quote.',
  'home.next.label': 'Next quote',
  'home.next.hint': 'Shows a random motivational quote.',
  'home.favorite.hint': 'Adds or removes the current quote from favorites.',
  'home.favorite.add.label': 'Favorite quote',
  'home.favorite.remove.label': 'Unfavorite quote',
  'home.favorite.added': 'Quote added to favorites.',
  'home.favorite.removed': 'Quote removed from favorites.',
  'home.favorite.error': 'Could not update favorites for rotation. Try again.',
  'home.favorite.retry.label': 'Retry favorite update',
  'home.favorite.retry.hint':
    'Retries updating the favorite used by wallpaper rotation.',
  'home.preview.title': 'Wallpaper preview',
  'home.preview.error': 'Preview could not render.',
  'home.preview.retry.label': 'Retry preview',
  'home.preview.retry.hint': 'Tries to render the current wallpaper again.',

  'customize.eyebrow': 'YOUR VISUAL RHYTHM',
  'customize.title': 'Customize',
  'customize.error':
    'Could not update the preset used for rotation. Try again.',
  'customize.retry.label': 'Retry preset update',
  'customize.retry.hint':
    'Retries updating the preset used by wallpaper rotation.',

  'favorites.eyebrow': 'KEEP WHAT LANDS',
  'favorites.title': 'Favorites',
  'favorites.empty.title': 'No favorites yet',
  'favorites.empty.message': 'Favorite a quote from Home to use it here.',
  'favorites.item.hint': 'Uses this favorite quote on the Home wallpaper.',
  'favorites.item.label': 'Use {text}',

  'automation.eyebrow': 'AUTOMATION',
  'automation.title': 'Rotation',
  'automation.available.title': 'Wallpaper targets available',
  'automation.available.message':
    'Rotation runs at an approximate interval; Android may defer work to preserve battery.',
  'automation.attention.title': 'Rotation needs attention',
  'automation.enable.label': 'Enable automatic rotation',
  'automation.enable.description':
    'Apply a new wallpaper on the selected schedule.',
  'automation.interval.label': 'Every',
  'automation.interval.option': 'Every {hours} hours',
  'automation.target.label': 'Apply to',
  'automation.target.home': 'Apply to Home screen',
  'automation.target.lock': 'Apply to Lock screen',
  'automation.target.both': 'Apply to both screens',
  'automation.favoritesOnly.label': 'Use favorite quotes only',
  'automation.favoritesOnly.description':
    'Rotation will use only your saved quotes.',
  'automation.save': 'Save automation preferences',
  'automation.run': 'Run rotation now',
  'automation.lastQuote': 'Last quote: {text}',
  'automation.lastQuote.fallback': 'saved quote',
  'automation.status.label': 'Service status {state} {intervalHours} {target}',
  'automation.status.capability': 'Capability: {kind}',
  'automation.status.checking': 'Status: checking device support',
  'automation.status.schedule':
    'Approximate schedule: every {hours} hours on {target}.',
  'automation.status.lastApplied': 'Last applied: {date}',
  'automation.status.loading': 'loading',
  'automation.favoritesOnly.error':
    'Add a favorite before using favorites-only rotation.',
  'automation.save.error':
    'Could not update rotation. Review the preferences and retry.',
  'automation.save.enabled': 'Rotation scheduled.',
  'automation.save.disabled': 'Rotation disabled.',
  'automation.run.success': 'Rotation started.',
  'automation.run.error': 'Could not start rotation. Try again.',

  'settings.eyebrow': 'KEEP IT YOURS',
  'settings.title': 'Settings',
  'settings.preset.title': 'Current preset',
  'settings.preset.action': 'Customize preset',
  'settings.preset.hint':
    'Opens Customize to choose your preferred wallpaper preset.',
  'settings.randomize.label': 'Randomize preset',
  'settings.randomize.description':
    'Use a different curated style when rotation becomes available.',
  'settings.favoritesOnly.label': 'Use favorite quotes only',
  'settings.favoritesOnly.description':
    'Keep future rotation focused on saved quotes.',
  'settings.randomize.updated': 'Random preset preference updated.',
  'settings.favoritesOnly.updated': 'Favorite quote preference updated.',
  'settings.error': 'Could not update rotation preferences. Try again.',
  'settings.retry.label': 'Retry preference update',
  'settings.retry.hint':
    'Retries updating the preference used by wallpaper rotation.',
  'settings.about.title': 'About Motivana',
  'settings.about.message':
    'Create a focused wallpaper from a thought worth returning to.',
  'settings.appLanguage.label': 'Interface language',
  'settings.appLanguage.description':
    'Sets the language of buttons and labels.',
  'settings.contentLanguage.label': 'Quote language',
  'settings.contentLanguage.description':
    'Sets the language of the quotes you see.',
  'settings.language.updated': 'Language preference updated.',
  'settings.language.error': 'Could not update the language. Try again.',
  'language.en': 'English',
  'language.vi': 'Tiếng Việt',

  'preview.item.hint': 'Applies this wallpaper style and returns to Home.',
  'preset.thumbnail.label': 'Use {name} preset',
  'preset.thumbnail.selected': 'Selected',
  'preset.thumbnail.tapToUse': 'Tap to use',

  'actions.save.label': 'Save wallpaper',
  'actions.save.hint':
    'Exports the current wallpaper and saves it to your photos.',
  'actions.set.label': 'Set wallpaper',
  'actions.set.hint':
    'Choose which supported screen receives the current wallpaper.',
  'actions.retry.label': 'Retry wallpaper action',
  'actions.retry.hint':
    'Repeats the failed action using the same exported wallpaper.',
  'actions.appSettings.label': 'Open app settings',
  'actions.appSettings.hint':
    "Opens this app's Android settings so photo permission can be enabled.",
  'actions.export.failed': 'Export failed: {code}.',
  'actions.error.permissionDenied':
    'Photo permission is needed to save this wallpaper.',
  'actions.error.wallpaperNotAllowed':
    'This device does not allow changing the wallpaper.',
  'actions.error.lockUnsupported':
    'This device does not support setting the lock screen.',
  'actions.error.fileNotFound':
    'The exported wallpaper is unavailable. Render it again and retry.',
  'actions.error.decodeFailed': 'The exported wallpaper could not be opened.',
  'actions.error.saveFailed': 'Could not save the wallpaper.',
  'actions.error.default': 'Could not apply the wallpaper.',
  'actions.error.capabilitiesUnavailable':
    'Wallpaper controls are unavailable.',
  'actions.success.save': 'Wallpaper saved to your photos.',
  'actions.success.home': 'Wallpaper applied to your Home screen.',
  'actions.success.lock': 'Wallpaper applied to your Lock screen.',
  'actions.success.both': 'Wallpaper applied to your Home and Lock screens.',
  'actions.target.home': 'Set Home screen',
  'actions.target.lock': 'Set Lock screen',
  'actions.target.both': 'Set both screens',

  'preset.midnight-focus.name': 'Midnight Focus',
  'preset.sunrise-drive.name': 'Sunrise Drive',
  'preset.forest-discipline.name': 'Forest Discipline',
  'preset.violet-growth.name': 'Violet Growth',
  'preset.paper-confidence.name': 'Paper Confidence',
  'preset.ocean-success.name': 'Ocean Success',
  'preset.ember-action.name': 'Ember Action',
  'preset.mono-clarity.name': 'Mono Clarity',
} as const;
