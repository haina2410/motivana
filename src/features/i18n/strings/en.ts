export const en = {
  'common.back.label': 'Back to Home',
  'common.back.hint': 'Returns to the wallpaper preview.',

  'home.eyebrow': 'MAKE YOUR FOCUS VISIBLE',
  'home.title': 'Motivana',
  'home.loading': 'Preparing your wallpaper',
  'home.customize.label': 'Customize wallpaper',
  'home.customize.hint': 'Choose a wallpaper preset.',
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
  'favorites.remove.label': 'Remove {text} from favorites',
  'favorites.remove.hint': 'Removes this quote from favorites.',
  'favorites.removed': 'Quote removed from favorites.',
  'favorites.remove.error':
    'Rotation uses saved quotes only, so the last one has to stay.',

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
  'automation.status.value': 'Status: {state}',
  'automation.state.disabled': 'disabled',
  'automation.state.scheduled': 'scheduled',
  'automation.state.running': 'running',
  'automation.state.succeeded': 'succeeded',
  'automation.state.failed': 'failed',
  'automation.capability.available': 'available',
  'automation.capability.unavailable': 'unavailable',
  'automation.targetName.home': 'Home screen',
  'automation.targetName.lock': 'Lock screen',
  'automation.targetName.both': 'both screens',
  'automation.recovery.emptyFavorites':
    'Rotation needs at least one saved favorite.',
  'automation.recovery.noEligibleQuotes':
    'Rotation has no eligible quotes. Use all quotes or save a favorite.',
  'automation.recovery.invalidConfiguration':
    'Rotation preferences need to be saved again.',
  'automation.recovery.lockUnsupported':
    'This device cannot apply rotation to that screen.',
  'automation.recovery.assetInvalid':
    'Rotation resources need attention. Review the rotation preferences.',
  'automation.recovery.fontMissing':
    'A required rotation font is unavailable. Review the rotation preferences.',
  'automation.recovery.assetIo':
    'Rotation resources are temporarily unavailable. Try again.',
  'automation.recovery.systemFailed':
    'Android could not finish the scheduled rotation. Try again.',
  'automation.recovery.renderFailed':
    'Android could not render the scheduled wallpaper. Try again.',
  'automation.recovery.applyFailed':
    'Android could not apply the scheduled wallpaper. Try again.',
  'automation.recovery.unknown':
    'Rotation did not complete. Review the rotation preferences and try again.',
  'automation.recovery.correct.label': 'Correct rotation preferences',
  'automation.recovery.correct.hint': 'Saves corrected rotation preferences.',
  'automation.recovery.retryNow.label': 'Retry rotation',
  'automation.recovery.retryNow.hint':
    'Runs the rotation immediately in this debug build.',
  'automation.recovery.reschedule.label': 'Reschedule rotation',
  'automation.recovery.reschedule.hint':
    'Saves the current rotation preferences so Android schedules a future run.',
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
  'settings.appLanguage.option': 'Interface language: {name}',
  'settings.contentLanguage.option': 'Quote language: {name}',
  'language.en': 'English',
  'language.vi': 'Tiếng Việt',

  'preview.item.hint': 'Applies this wallpaper style and returns to Home.',
  'preset.thumbnail.label': 'Use {name} preset',

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

  'tab.deck': 'Deck',
  'tab.deck.hint': 'Shows the wallpaper deck for today.',
  'tab.presets': 'Presets',
  'tab.presets.hint': 'Chooses a background, typeface and layout in one tap.',
  'tab.saved': 'Saved',
  'tab.saved.hint': 'Opens the quotes you saved.',
  'tab.rotate': 'Rotate',
  'tab.rotate.hint': 'Opens the automatic wallpaper schedule.',

  'home.today': 'Today',
  'home.restyle.label': 'Restyle',
  'home.restyle.hint': 'Opens the style controls for this wallpaper.',
  'home.set.label': 'Set wallpaper',
  'home.set.hint': 'Chooses which screen receives this wallpaper.',
  'home.save.label': 'Save',
  'home.font.label': 'Typeface: {name}',

  'style.title': 'Style',
  'style.close.label': 'Close style',
  'style.close.hint': 'Returns to the deck without a further change.',
  'style.done': 'Done',
  'style.done.hint': 'Returns to the deck.',
  'style.typeface.label': 'Typeface',
  'style.typeface.option': 'Set the typeface to {name}',
  'style.size.label': 'Size',
  'style.size.value': '{percent}% of the wallpaper width',
  'style.lineHeight.label': 'Line height',
  'style.lineHeight.note':
    '{value} — leaves room for stacked Vietnamese tone marks.',
  'style.alignment.label': 'Alignment',
  'style.alignment.left': 'Left aligned',
  'style.alignment.center': 'Centre aligned',
  'style.alignment.right': 'Right aligned',
  'style.readOnly':
    'Size, line height and alignment belong to the preset, so a scheduled wallpaper renders exactly like this preview.',
  'style.error': 'Could not change the typeface. Try again.',

  'presets.subtitle': 'Background, typeface and layout in one tap.',

  'saved.count': '{count} saved',
  'saved.rotate.label': 'Rotate through saved',
  'saved.rotate.hint': 'Opens rotation, where saved quotes can be the source.',

  'sheet.title': 'Where should it go?',
  'sheet.subtitle':
    'Applied directly through WallpaperManager. Nothing leaves the device.',
  'sheet.note':
    'Lock-screen targeting needs Android 8.0 or later. On an older build Motivana sets Home only and says so.',
  'sheet.apply': 'Apply',
  'sheet.apply.hint': 'Applies this wallpaper to the chosen screen.',
  'sheet.close.label': 'Close',
  'sheet.close.hint': 'Closes this sheet without applying a wallpaper.',
  'sheet.target.home': 'Home screen',
  'sheet.target.lock': 'Lock screen',
  'sheet.target.both': 'Both',
  'sheet.saveAlso': 'A copy also goes to your photos.',

  'rotation.interval.option': '{hours}h',
  'rotation.source.label': 'Source',
  'rotation.source.saved': 'Saved quotes',
  'rotation.source.all': 'All quotes',
  'rotation.runs.lastRun': 'Last run',
  'rotation.runs.nextRun': 'Next run',
  'rotation.runs.status': 'Status',
  'rotation.runs.pending': 'Not yet',
  'rotation.battery':
    'Battery optimisation can delay a run. Exclude Motivana to keep the timing exact.',
  'rotation.enable.description': 'Runs on the device through WorkManager.',

  'settings.offline.title': 'Fully offline',
  'settings.offline.message':
    'No account, no server, no analytics. Quotes, presets, fonts and exports stay on this device.',
  'settings.export.label': 'Export',
  'settings.resolution.label': 'Resolution',
  'settings.language.label': 'Language',
  'settings.saveToLibrary.label': 'Save to photo library',
  'settings.saveToLibrary.description':
    'Applying a wallpaper also keeps a copy in your photos.',
  'settings.saveToLibrary.updated': 'Photo library preference updated.',
  'settings.safeGuides.label': 'Show safe-area guides',
  'settings.safeGuides.description':
    'Draws the launcher clock and icon margins over the preview.',
  'settings.safeGuides.updated': 'Safe-area guide preference updated.',
  'settings.about.label': 'About',
  'settings.licences.label': 'Font licences · OFL',
  'settings.licences.hint':
    'Every bundled typeface ships under the SIL Open Font License.',
  'settings.version.label': 'Version',
  'settings.version.value': '{version} · offline',

  'preset.face.CormorantGaramond': 'Cormorant Garamond',
  'preset.face.BeVietnamPro': 'Be Vietnam Pro',
  'preset.face.DancingScript': 'Dancing Script',
  'preset.face.Lora': 'Lora',

  'preset.midnight-focus.name': 'Midnight',
  'preset.sunrise-drive.name': 'Sand',
  'preset.forest-discipline.name': 'Jade',
  'preset.violet-growth.name': 'Blush',
  'preset.paper-confidence.name': 'Linen',
  'preset.ocean-success.name': 'Slate',
  'preset.ember-action.name': 'Ember',
  'preset.mono-clarity.name': 'Paper',
} as const;
