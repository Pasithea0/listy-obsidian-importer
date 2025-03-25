import { App, PluginSettingTab, Setting } from "obsidian";
import MyPlugin from "../main";
import { FolderSuggestor } from "./suggestors/FolderSuggestor";

export interface MyPluginSettings {
	mySetting: string;
	outputFolder: string;
	consolidateToDoLists: boolean;
}

export const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default',
	outputFolder: '',
	consolidateToDoLists: true
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
		this.addConsolidateToDoListsSetting();
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
	
	addConsolidateToDoListsSetting(): void {
		new Setting(this.containerEl)
			.setName('Consolidate To Do lists')
			.setDesc('Create a single note for To Do lists instead of individual notes for each item')
			.addToggle(toggle => {
				toggle
					.setValue(this.plugin.settings.consolidateToDoLists)
					.onChange(async (value) => {
						this.plugin.settings.consolidateToDoLists = value;
						await this.plugin.saveSettings();
					});
			});
	}
}
