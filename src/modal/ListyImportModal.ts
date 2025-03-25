import { App, Modal, Notice } from "obsidian";
import { ListyImporterSettings } from "../settings/Settings";	
import { ListyData } from "../models/ListyTypes";
import { ListyImportService } from "../services/ListyImportService";

export class ListyImportModal extends Modal {
    goButtonEl!: HTMLButtonElement;
    inputFileEl!: HTMLInputElement;
    settings: ListyImporterSettings;
    fileContent: any | null;
    importService: ListyImportService;

    constructor(app: App, settings: ListyImporterSettings) {
        super(app);
        this.settings = settings;
        this.fileContent = null;
        this.importService = new ListyImportService(app, settings);
    }

    private async processJsonData() {
        if (!this.fileContent) {
            throw new Error('No JSON file content available');
        }

        try {
            // Parse the JSON content as ListyData
            const listyData = this.fileContent as ListyData;
            
            // Process the data using the service
            const count = await this.importService.processListyData(listyData);
            return count;
        } catch (error) {
            console.error("Error processing JSON data:", error);
            throw error;
        }
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
