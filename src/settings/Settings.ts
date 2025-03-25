import { App, PluginSettingTab, Setting } from "obsidian";
import ListyImporter from "../main";
import { FolderSuggestor } from "./suggestors/FolderSuggestor";
import { FileSuggestor } from "./suggestors/FileSuggestor";

export interface ListyImporterSettings {
	mySetting: string;
	outputFolder: string;
	consolidateToDoLists: boolean;
	includeTags: boolean;
	tagReplacement: string;
	enableNoteLocking: boolean;
	templateFile: string;
	maxTitleLength: number;
}

export const DEFAULT_SETTINGS: ListyImporterSettings = {
	mySetting: 'default',
	outputFolder: 'Listy',
	consolidateToDoLists: true,
	includeTags: false,
	tagReplacement: '',
	enableNoteLocking: false,
	templateFile: '',
	maxTitleLength: 105
};

export class ListyImporterSettingTab extends PluginSettingTab {
	plugin: ListyImporter;

	constructor(app: App, plugin: ListyImporter) {
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
		this.addTagReplacementSetting();
		this.addMaxTitleLengthSetting();
		this.addEnableNoteLockingSetting();
		this.addTemplateFileSetting();
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

	addTagReplacementSetting(): void {
		new Setting(this.containerEl)
			.setName('Hashtag replacement')
			.setDesc('Replace # in descriptions with this text. Leave empty to remove hashtags, or use `#` to keep them unchanged.')
			.addText(text => {
				text
					.setPlaceholder('Example: # or 🏷️')
					.setValue(this.plugin.settings.tagReplacement)
					.onChange(async (value) => {
						this.plugin.settings.tagReplacement = value;
						await this.plugin.saveSettings();
					});
			});
	}

	addMaxTitleLengthSetting(): void {
		new Setting(this.containerEl)
			.setName('Maximum title length')
			.setDesc('Set the maximum length for titles and filenames (10-105 characters)')
			.addSlider(slider => {
				slider
					.setLimits(10, 105, 5)
					.setValue(this.plugin.settings.maxTitleLength)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.maxTitleLength = value;
						await this.plugin.saveSettings();
					});
			})
			.addExtraButton(button => {
				button
					.setIcon('reset')
					.setTooltip('Reset to default (105)')
					.onClick(async () => {
						this.plugin.settings.maxTitleLength = 105;
						await this.plugin.saveSettings();
						this.display();
					});
			});
	}

	addEnableNoteLockingSetting(): void {
		new Setting(this.containerEl)
			.setName('Enable note locking')
			.setDesc('When enabled, adds a "lock" property to notes. Locked notes will be skipped during reimport.')
			.addToggle(toggle => {
				toggle
					.setValue(this.plugin.settings.enableNoteLocking)
					.onChange(async (value) => {
						this.plugin.settings.enableNoteLocking = value;
						await this.plugin.saveSettings();
					});
			});
	}

	addTemplateFileSetting(): void {
		new Setting(this.containerEl)
			.setName('Template file')
			.setDesc('Choose a markdown file to use as a template for new notes. Leave empty to use the default template.')
			.addSearch((cb) => {
				new FileSuggestor(this.app, cb.inputEl);
				cb.setPlaceholder("Example: templates/listy-template.md")
					.setValue(this.plugin.settings.templateFile)
					.onChange((newTemplate) => {
						this.plugin.settings.templateFile = newTemplate;
						this.plugin.saveSettings();
					});
			});
	}
}
