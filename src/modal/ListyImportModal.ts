import { App, Modal, Notice, normalizePath } from "obsidian";
import { MyPluginSettings } from "../settings/Settings";
import { ListyData, ListyItem, ListyList } from "../models/ListyTypes";
import { sanitize } from "sanitize-filename-ts";

export class ListyImportModal extends Modal {
    goButtonEl!: HTMLButtonElement;
    inputFileEl!: HTMLInputElement;
    settings: MyPluginSettings;
    fileContent: any | null;

    constructor(app: App, settings: MyPluginSettings) {
        super(app);
        this.settings = settings;
        this.fileContent = null;
    }

    private async processJsonData() {
        if (!this.fileContent) {
            throw new Error('No JSON file content available');
        }

        try {
            // Parse
            const listyData = this.fileContent as ListyData;
            if (!listyData.lists || !Array.isArray(listyData.lists)) {
                throw new Error('Invalid Listy JSON format: missing lists array');
            }
            
            // Ouput to defined folder, or create it
            if (this.settings.outputFolder && this.settings.outputFolder.length > 0) {
                const folderExists = await this.app.vault.adapter.exists(this.settings.outputFolder);
                if (!folderExists) {
                    await this.app.vault.createFolder(this.settings.outputFolder);
                }
            }
            
            // Process each list
            let totalNotesCreated = 0;
            for (const list of listyData.lists) {
                // Create a folder for each list inside the output folder
                const sanitizedListTitle = this.sanitizeFileName(list.title);
                const listFolderPath = normalizePath(`${this.settings.outputFolder}/${sanitizedListTitle}`);
                if (!(await this.app.vault.adapter.exists(listFolderPath))) {
                    await this.app.vault.createFolder(listFolderPath);
                }
                
                // Process each item in the list
                for (const item of list.items) {
                    const sanitizedItemTitle = this.sanitizeFileName(item.title);
                    const notePath = normalizePath(`${listFolderPath}/${sanitizedItemTitle}.md`);
                    const noteContent = this.generateNoteContent(item, list);
                    
                    // Check if note already exists and handle accordingly
                    // For now, we'll overwrite existing notes
                    await this.app.vault.adapter.write(notePath, noteContent);
                    totalNotesCreated++;
                }
            }
            
            return totalNotesCreated;
        } catch (error) {
            console.error("Error processing JSON data:", error);
            throw error;
        }
    }
    
    private generateNoteContent(item: ListyItem, list: ListyList): string {
        let markdown = `---\n`;
        markdown += `source: listy\n`;
        markdown += `list: "${this.escapeYamlString(list.title)}"\n`;
        markdown += `dateAdded: ${item.dateAdded}\n`;
        
        if (item.url) {
            markdown += `url: "${this.escapeYamlString(item.url)}"\n`;
        }
        
        markdown += `marked: ${item.marked}\n`;
        
		// Process attributes as individaul properties
        if (item.attributes && item.attributes.length > 0) {
            const attributesMap = new Map<string, string>();
            
            for (const attr of item.attributes) {
                attributesMap.set(attr.key.toLowerCase(), attr.value);
            }

            if (attributesMap.has('author')) {
                markdown += `author: "${this.escapeYamlString(attributesMap.get('author') || '')}"\n`;
                attributesMap.delete('author');
            }
            
            if (attributesMap.has('description')) {
                const desc = attributesMap.get('description') || '';
                markdown += `description: |\n  ${desc.replace(/\n/g, '\n  ')}\n`;
                attributesMap.delete('description');
            }
            
            if (attributesMap.has('cover')) {
                markdown += `cover: "${this.escapeYamlString(attributesMap.get('cover') || '')}"\n`;
                attributesMap.delete('cover');
            }
            
            if (attributesMap.has('icon')) {
                markdown += `icon: "${this.escapeYamlString(attributesMap.get('icon') || '')}"\n`;
                attributesMap.delete('icon');
            }
            
            // Add remaining attributes
            for (const [key, value] of attributesMap.entries()) {
                if (value.includes('\n') || value.length > 80) {
                    markdown += `${key}: |\n  ${value.replace(/\n/g, '\n  ')}\n`;
                } else {
                    // Use quoted string for simple values
                    markdown += `${key}: "${this.escapeYamlString(value)}"\n`;
                }
            }
        }
        
        markdown += `---\n\n`;
        
        // Add the title as the main heading
        markdown += `# ${item.title}\n\n`;
        
        // Add URL as a link if it exists
        if (item.url) {
            markdown += `[Visit Original](${item.url})\n\n`;
        }
        
        // If there's a description attribute, add it to the content
        if (item.attributes) {
            const description = item.attributes.find(attr => attr.key === 'DESCRIPTION');
            if (description) {
                markdown += `## Description\n\n${description.value}\n\n`;
            }
            
            // Add cover image if available
            const cover = item.attributes.find(attr => attr.key === 'COVER');
            if (cover) {
                markdown += `![](${cover.value})\n\n`;
            }
        }
        
        // Add a section for notes
        markdown += `## Notes\n\n`;
        
        return markdown;
    }

    // Helper function to escape YAML strings properly
    private escapeYamlString(str: string): string {
        // Replace backslashes, quotes, and control characters
        return str
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t');
    }

    // Custom sanitize function
    private sanitizeFileName(fileName: string): string {
        let sanitized = fileName
            .replace(/\//g, '-')
            .replace(/\\/g, '-')
            .replace(/:/g, '-')
            .replace(/\*/g, '-')
            .replace(/\?/g, '-')
            .replace(/"/g, "'")
            .replace(/</g, '-')
            .replace(/>/g, '-')
            .replace(/\|/g, '-')
            .replace(/=/g, '-')
            .replace(/\0/g, '')
            .trim();
        
        if (sanitized.startsWith('.')) {
            sanitized = '_' + sanitized;
        }
        
        // macOS has a max file name length of around 255 bytes
        // To be safe, limit to 200 characters
        if (sanitized.length > 200) {
            sanitized = sanitized.substring(0, 197) + '...';
        }
        
        return sanitized;
    }

    onOpen() {
        const { contentEl } = this;

        const heading = contentEl.createEl('h2');
        heading.textContent = 'Import Listy Lists';

        const description = contentEl.createEl('p');
        description.innerHTML = 'Please select your <em>Listy export JSON file</em>';

        this.inputFileEl = contentEl.createEl('input');
        this.inputFileEl.type = 'file';
        this.inputFileEl.accept = '.json';
        this.inputFileEl.addEventListener("change", (ev) => {
            const file = (ev.target as HTMLInputElement)?.files?.[0];
            if (!file) {
                console.error("No file selected");
                return;
            }
          
            // Read the JSON file
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    this.fileContent = JSON.parse(reader.result as string);
                    this.goButtonEl.disabled = false;
                    this.goButtonEl.setAttr("style", "background-color: green; color: black");
                    new Notice("Ready to import!");
                } catch (e) {
                    console.error("Error parsing JSON:", e);
                    new Notice("Error parsing JSON file");
                }
            };
          
            reader.onerror = (error) => {
                console.error("FileReader error:", error);
                new Notice("Error reading file");
            };
          
            reader.readAsText(file);
        });
        
        this.goButtonEl = contentEl.createEl('button');
        this.goButtonEl.textContent = 'Import';
        this.goButtonEl.disabled = true;
        this.goButtonEl.setAttr('style', 'background-color: red; color: white; margin-top: 15px;');
        this.goButtonEl.addEventListener('click', () => {
            new Notice('Importing lists...');
            this.processJsonData()
                .then((count) => {
                    new Notice(`Successfully imported ${count} notes from Listy!`);
                    this.close();
                }).catch(e => {
                    console.error(e);
                    new Notice('Something went wrong... Check console for more details.');
                });
        });

        contentEl.appendChild(heading);
        contentEl.appendChild(description);
        contentEl.appendChild(this.inputFileEl);
        contentEl.appendChild(this.goButtonEl);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
} 
