// Writes the curated icon selection of each set (src/lib/icons/curated/<set>.ts), in the same categories.
// Run after changing the lists: npm run icons -w apps/screen-capture

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/** Per set: Iconify package and icon names per category (names differ between sets) */
const SETS = {
	material: {
		pkg: '@iconify-json/material-symbols',
		categories: {
			arrows:
				'arrow-forward arrow-back arrow-upward arrow-downward arrow-outward north-east south-east south-west north-west arrow-right-alt arrow-left-alt arrow-forward-ios arrow-back-ios chevron-right chevron-left expand-more expand-less double-arrow keyboard-double-arrow-right keyboard-double-arrow-left keyboard-double-arrow-up keyboard-double-arrow-down trending-up trending-down trending-flat subdirectory-arrow-right turn-right turn-left u-turn-left redo undo refresh sync swap-horiz swap-vert open-in-new call-made call-received arrow-circle-right arrow-circle-left arrow-circle-up arrow-circle-down',
			notices:
				'info info-outline warning warning-outline error error-outline check-circle check-circle-outline cancel cancel-outline help help-outline lightbulb lightbulb-outline priority-high report report-outline new-releases campaign notifications notifications-outline emergency-home emergency-home-outline block do-not-disturb-on',
			status:
				'check close add remove done-all thumb-up thumb-up-outline thumb-down thumb-down-outline star star-outline favorite favorite-outline bookmark bookmark-outline flag flag-outline verified verified-outline lock lock-outline lock-open lock-open-outline visibility visibility-outline visibility-off visibility-off-outline schedule hourglass-empty pending pending-outline radio-button-checked radio-button-unchecked check-box check-box-outline-blank toggle-on toggle-off',
			input:
				'mouse mouse-outline left-click right-click touch-app touch-app-outline pan-tool pan-tool-outline back-hand back-hand-outline keyboard keyboard-outline keyboard-return keyboard-tab keyboard-capslock keyboard-command-key keyboard-option-key keyboard-control-key space-bar backspace backspace-outline drag-pan drag-indicator ads-click ads-click-outline arrow-selector-tool arrow-selector-tool-outline swipe gesture',
			objects:
				'settings settings-outline search home home-outline folder folder-outline description description-outline mail mail-outline call chat chat-outline forum forum-outline calendar-today calendar-month download upload cloud cloud-outline link attach-file edit edit-outline delete delete-outline content-copy content-paste save save-outline print share menu more-vert more-horiz filter-list sort tune shopping-cart shopping-cart-outline credit-card language public wifi bluetooth battery-full power-settings-new photo-camera photo-camera-outline mic mic-outline videocam videocam-outline play-arrow pause stop volume-up volume-off computer smartphone tablet desktop-windows terminal code bug-report bug-report-outline database dns rocket rocket-launch rocket-launch-outline bolt key',
			people:
				'person person-outline group group-outline account-circle account-circle-outline face face-outline sentiment-satisfied sentiment-dissatisfied sentiment-neutral sentiment-very-satisfied mood waving-hand waving-hand-outline handshake handshake-outline support-agent school school-outline work work-outline celebration celebration-outline'
		}
	},
	tabler: {
		pkg: '@iconify-json/tabler',
		categories: {
			arrows:
				'arrow-right arrow-left arrow-up arrow-down arrow-up-right arrow-down-right arrow-down-left arrow-up-left arrow-narrow-right arrow-narrow-left arrow-narrow-up arrow-narrow-down arrow-big-right arrow-big-left arrow-big-up arrow-big-down arrow-big-right-filled arrow-big-left-filled chevron-right chevron-left chevron-up chevron-down chevrons-right chevrons-left chevrons-up chevrons-down trending-up trending-down arrow-forward-up arrow-back-up arrow-curve-right arrow-curve-left corner-down-right arrow-rotary-right refresh repeat switch-horizontal switch-vertical external-link arrow-guide circle-arrow-right circle-arrow-left circle-arrow-up circle-arrow-down circle-arrow-right-filled',
			notices:
				'info-circle info-circle-filled alert-triangle alert-triangle-filled alert-circle alert-circle-filled circle-check circle-check-filled circle-x circle-x-filled help-circle help-circle-filled bulb bulb-filled exclamation-mark alert-octagon alert-octagon-filled rosette-discount-check speakerphone bell bell-filled bell-ringing urgent ban hand-stop info-square-rounded',
			status:
				'check x plus minus checks thumb-up thumb-up-filled thumb-down thumb-down-filled star star-filled heart heart-filled bookmark bookmark-filled flag flag-filled rosette-discount-check-filled lock lock-filled lock-open eye eye-filled eye-off clock hourglass dots-circle-horizontal circle-dot circle square-check square-check-filled square toggle-right toggle-left progress loader',
			input:
				'mouse mouse-filled click pointer pointer-filled hand-click hand-finger hand-move hand-grab hand-three-fingers keyboard keyboard-filled arrow-back command option keyboard-show backspace backspace-filled space corner-down-left arrow-big-up-lines drag-drop grip-vertical grip-horizontal hand-two-fingers swipe hand-finger-right',
			objects:
				'settings settings-filled search home home-filled folder folder-filled file-text file-text-filled mail mail-filled phone message message-filled messages calendar calendar-event download upload cloud cloud-filled link paperclip pencil edit trash trash-filled copy clipboard device-floppy printer share menu-2 dots-vertical dots filter sort-ascending adjustments shopping-cart credit-card language world wifi bluetooth battery-4 power camera camera-filled microphone microphone-filled video video-filled player-play player-play-filled player-pause player-stop volume volume-off device-desktop device-mobile device-tablet terminal-2 code bug bug-filled database server rocket bolt bolt-filled key',
			people:
				'user user-filled users users-group user-circle mood-smile mood-smile-filled mood-sad mood-empty mood-happy mood-heart hand-love-you heart-handshake headset school briefcase briefcase-filled confetti confetti-filled user-check user-plus'
		}
	},
	ph: {
		pkg: '@iconify-json/ph',
		categories: {
			arrows:
				'arrow-right arrow-left arrow-up arrow-down arrow-up-right arrow-down-right arrow-down-left arrow-up-left arrow-right-bold arrow-left-bold arrow-fat-right arrow-fat-left arrow-fat-up arrow-fat-down arrow-fat-right-fill arrow-fat-left-fill caret-right caret-left caret-up caret-down caret-double-right caret-double-left caret-double-up caret-double-down trend-up trend-down arrow-bend-up-right arrow-bend-up-left arrow-elbow-down-right arrow-u-up-left arrow-clockwise arrow-counter-clockwise arrows-clockwise arrows-left-right arrows-down-up arrow-square-out arrow-circle-right arrow-circle-left arrow-circle-up arrow-circle-down arrow-circle-right-fill',
			notices:
				'info info-fill warning warning-fill warning-circle warning-circle-fill check-circle check-circle-fill x-circle x-circle-fill question question-fill lightbulb lightbulb-fill exclamation-mark warning-octagon warning-octagon-fill seal-check megaphone bell bell-fill bell-ringing siren prohibit hand-palm seal-warning',
			status:
				'check x plus minus checks thumbs-up thumbs-up-fill thumbs-down thumbs-down-fill star star-fill heart heart-fill bookmark-simple bookmark-simple-fill flag flag-fill seal-check-fill lock lock-fill lock-open eye eye-fill eye-slash clock hourglass dots-three-circle radio-button circle check-square check-square-fill square toggle-right toggle-left spinner circle-notch',
			input:
				'mouse mouse-fill mouse-left-click mouse-right-click cursor cursor-fill cursor-click hand-pointing hand-grabbing hand hand-fist hand-swipe-right keyboard keyboard-fill key-return command option control backspace backspace-fill arrow-fat-line-up selection hand-tap dots-six-vertical dots-six hand-swipe-left',
			objects:
				'gear gear-fill magnifying-glass house house-fill folder folder-fill file-text file-text-fill envelope envelope-fill phone chat chat-fill chats calendar calendar-dots download-simple upload-simple cloud cloud-fill link paperclip pencil-simple pencil-simple-fill trash trash-fill copy clipboard floppy-disk printer share-network list dots-three-vertical dots-three funnel sort-ascending sliders shopping-cart credit-card translate globe wifi-high bluetooth battery-full power camera camera-fill microphone microphone-fill video-camera video-camera-fill play play-fill pause stop speaker-high speaker-x desktop device-mobile device-tablet terminal-window code bug bug-fill database hard-drives rocket rocket-launch lightning lightning-fill key',
			people:
				'user user-fill users users-three user-circle smiley smiley-fill smiley-sad smiley-meh smiley-wink hand-waving hand-waving-fill handshake headset graduation-cap briefcase briefcase-fill confetti confetti-fill user-check user-plus'
		}
	}
};

/** Body and size of an icon; aliases without transformations resolve to their parent */
function icon(set, name) {
	const own = set.icons[name];
	if (own) return { name, body: own.body, width: own.width ?? set.width ?? 24, height: own.height ?? set.height ?? 24 };
	const alias = set.aliases?.[name];
	if (alias && !alias.rotate && !alias.hFlip && !alias.vFlip) return { ...icon(set, alias.parent), name };
	throw new Error(`Icon not found in ${set.prefix}: ${name}`);
}

const dir = new URL('../src/lib/icons/curated/', import.meta.url);
mkdirSync(dir, { recursive: true });
for (const [id, { pkg, categories: lists }] of Object.entries(SETS)) {
	const set = JSON.parse(readFileSync(require.resolve(`${pkg}/icons.json`), 'utf8'));
	const categories = Object.entries(lists).map(([category, list]) => ({
		id: category,
		icons: list.split(/\s+/).map((name) => icon(set, name))
	}));
	writeFileSync(
		new URL(`${id}.ts`, dir),
		`// Generated by scripts/icons.mjs from ${pkg} – do not edit by hand.

import type { IconCategoryGroup } from './types.js';

export const CURATED: IconCategoryGroup[] = [
${categories
	.map((c) => `\t{\n\t\tid: '${c.id}',\n\t\ticons: [\n${c.icons.map((i) => `\t\t\t${JSON.stringify(i)}`).join(',\n')}\n\t\t]\n\t}`)
	.join(',\n')}
];
`
	);
	console.log(`${id}: ${categories.reduce((n, c) => n + c.icons.length, 0)} icons written`);
}
