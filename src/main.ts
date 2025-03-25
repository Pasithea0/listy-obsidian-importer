import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { MyPluginSettings, DEFAULT_SETTINGS, MyPluginSettingTab } from './settings/Settings';
import { ListyImportModal } from './modal/ListyImportModal';

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('list', 'Import Listy Lists', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new ListyImportModal(this.app, this.settings).open();
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('listy-importer-ribbon-class');

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Listy Importer');

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'import-listy-lists',
			name: 'Import Listy Lists',
			callback: () => {
				new ListyImportModal(this.app, this.settings).open();
			}
		});
		
		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new MyPluginSettingTab(this.app, this));

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
