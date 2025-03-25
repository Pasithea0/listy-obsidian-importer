import { App, PluginSettingTab, Setting } from "obsidian";
import MyPlugin from "../main";
import { FolderSuggestor } from "./suggestors/FolderSuggestor";

export interface MyPluginSettings {
	mySetting: string;
	outputFolder: string;
	consolidateToDoLists: boolean;
	includeTags: boolean;
	escapeDescriptionTags: boolean;
}

export const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default',
	outputFolder: 'Listy',
	consolidateToDoLists: true,
	includeTags: false,
	escapeDescriptionTags: true
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
		this.addIncludeTagsSetting();
		this.addEscapeDescriptionTagsSetting();
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

	addIncludeTagsSetting(): void {
		new Setting(this.containerEl)
			.setName('Include tags')
			.setDesc('Convert listy tags to Obsidian tags in the frontmatter')
			.addToggle(toggle => {
				toggle
					.setValue(this.plugin.settings.includeTags)
					.onChange(async (value) => {
						this.plugin.settings.includeTags = value;
						await this.plugin.saveSettings();
					});
			});
	}

	addEscapeDescriptionTagsSetting(): void {
		new Setting(this.containerEl)
			.setName('Escape hashtags in descriptions')
			.setDesc('Prevent hashtags in descriptions from becoming Obsidian tags')
			.addToggle(toggle => {
				toggle
					.setValue(this.plugin.settings.escapeDescriptionTags)
					.onChange(async (value) => {
						this.plugin.settings.escapeDescriptionTags = value;
						await this.plugin.saveSettings();
					});
			});
	}
}
