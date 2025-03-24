import { App, PluginSettingTab, Setting } from "obsidian";
import MyPlugin from "../main";
import { FolderSuggestor } from "./suggestors/FolderSuggestor";

export interface MyPluginSettings {
	mySetting: string;
	outputFolder: string;
}

export const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default',
	outputFolder: ''
};

export class MyPluginSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();
		containerEl.createEl('h2', { text: this.plugin.manifest.name });

		this.addOutputFolderSetting();
		// this.addMiscSettings();
	}

	addOutputFolderSetting(): void {
		new Setting(this.containerEl)
			.setName('Output folder')
			.setDesc('Where to save your imported notes')
			.addSearch((cb) => {
				new FolderSuggestor(this.app, cb.inputEl);
				cb.setPlaceholder("Example: folder1/folder2")
					.setValue(this.plugin.settings.outputFolder)
					.onChange((newFolder) => {
						this.plugin.settings.outputFolder = newFolder;
						this.plugin.saveSettings();
					});
			});
	}

	// addMiscSettings(): void {
	// 	new Setting(this.containerEl)
	// 		.setName('Setting #1')
	// 		.setDesc('It\'s a secret')
	// 		.addText(text => text
	// 			.setPlaceholder('Enter your secret')
	// 			.setValue(this.plugin.settings.mySetting)
	// 			.onChange(async (value) => {
	// 				this.plugin.settings.mySetting = value;
	// 				await this.plugin.saveSettings();
	// 			}));
	// }
} 
