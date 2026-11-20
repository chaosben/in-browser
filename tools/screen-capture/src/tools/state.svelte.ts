/**
 * The open side panel: `PanelRail` binds it (and keeps it as `screen-capture:panel`); others open one, e.g. the media
 * after an import or the library after saving to it
 */
class PanelState {
	open = $state<string | null>(null);
}

export const panelState = new PanelState();
