import { App, normalizePath } from "obsidian";
import { v4 as uuidv4 } from 'uuid';
import { ListyData, ListyItem, ListyList } from "../types/ListyTypes";
import { ListyImporterSettings } from "../settings/Settings";
import { getTemplateContents, applyTemplateTransformations } from "../utils/templateUtils";

export const USER_COMMENT_PLACEHOLDER = `%% Here you can type whatever you want, it will not be overwritten by the plugin. %%`;

export interface ListyNoteItem {
    id: string;
    item: ListyItem;
    fullContent: string;
    noteContent: string;
}

export class ListyImportService {
    app: App;
    settings: ListyImporterSettings;

    constructor(app: App, settings: ListyImporterSettings) {
        this.app = app;
        this.settings = settings;
    }

    /**
     * Process the Listy JSON data and create notes
     */
    async processListyData(listyData: ListyData): Promise<number> {
        if (!listyData.lists || !Array.isArray(listyData.lists)) {
            throw new Error('Invalid Listy JSON format: missing lists array');
        }
        
        // Check output folder
        if (this.settings.outputFolder && this.settings.outputFolder.length > 0) {
            const folderExists = await this.app.vault.adapter.exists(this.settings.outputFolder);
            if (!folderExists) {
                await this.app.vault.createFolder(this.settings.outputFolder);
            }
        }
        
        // Process each list
        let totalNotesCreated = 0;
        for (const list of listyData.lists) {

			if (!list.items || list.items.length === 0) {
                continue;
            }
            
            const isToDoList = list.type === 'Tasks';
            const shouldConsolidate = isToDoList && this.settings.consolidateToDoLists;
            
            if (shouldConsolidate) {
                await this.createConsolidatedToDoList(list, this.settings.outputFolder);
                totalNotesCreated++;
                continue;
            }
            
            const sanitizedListTitle = this.sanitizeFileName(list.title);
            const listFolderPath = normalizePath(`${this.settings.outputFolder}/${sanitizedListTitle}`);
            
            // Create the folder if needed
            if (!(await this.app.vault.adapter.exists(listFolderPath))) {
                await this.app.vault.createFolder(listFolderPath);
            }
            
            // Process items if not consolidated
            for (const item of list.items) {
                const sanitizedItemTitle = this.sanitizeFileName(item.title);
                const notePath = normalizePath(`${listFolderPath}/${sanitizedItemTitle}.md`);
                
                let existingContent: string | null = null;
                try {
                    existingContent = await this.app.vault.adapter.read(notePath);
                    console.log(`Found existing note: ${sanitizedItemTitle}`);
                    
                    if (this.settings.enableNoteLocking && existingContent) {
                        const lockMatch = existingContent.match(/^lock:\s*true/m);
                        if (lockMatch) {
                            console.log(`Skipping locked note: ${sanitizedItemTitle}`);
                            continue;
                        }
                    }
                    
                    console.log(`Updating existing note: ${sanitizedItemTitle}`);
                } catch (error) {
                    console.log(`Creating new note: ${sanitizedItemTitle}`);
                    // File doesn't exist, create it
                }
                
                const noteContent = await this.generateNoteContent(item, list, existingContent);
                
                await this.app.vault.adapter.write(notePath, noteContent);
                totalNotesCreated++;
            }
        }
        
        return totalNotesCreated;
    }
    
    /**
     * Generate note content
     */
    private async generateNoteContent(item: ListyItem, list: ListyList, existingContent: string | null): Promise<string> {
        if (existingContent) {
            const itemId = this.extractItemId(existingContent);
            if (itemId) {
                // Update only the content part
                return this.updateExistingNote(item, list, existingContent, itemId);
            }
        }
        
        const itemId = uuidv4();
        
        const frontmatter = this.generateFrontmatter(item, list);
        
        // Generate the note content using template
        const noteContent = await this.generateItemContent(item, list);
        
        let result = frontmatter;
        result += `%%START-${itemId}%%\n\n`;
        result += `${USER_COMMENT_PLACEHOLDER}\n\n`;
        result += `%%START-EXTRACTED-CONTENT-${itemId}%%\n\n`;
        result += noteContent;
        result += `\n\n%%END-EXTRACTED-CONTENT-${itemId}%%\n\n`;
        result += `${USER_COMMENT_PLACEHOLDER}\n\n`;
        result += `%%END-${itemId}%%\n`;
        
        return result;
    }
    
    /**
     * Extract ID from an existing note
     */
    private extractItemId(content: string): string | null {
        const startMatch = content.match(/%%START-([0-9a-f-]+)%%/);
        if (startMatch && startMatch[1]) {
            return startMatch[1];
        }
        return null;
    }
    
    /**
     * Update an existing note while preserving user comments
     */
    private async updateExistingNote(item: ListyItem, list: ListyList, existingContent: string, itemId: string): Promise<string> {
        const startBlockMarker = `%%START-${itemId}%%`;
        const endBlockMarker = `%%END-${itemId}%%`;
        const startContentMarker = `%%START-EXTRACTED-CONTENT-${itemId}%%`;
        const endContentMarker = `%%END-EXTRACTED-CONTENT-${itemId}%%`;
        
        if (!existingContent.includes(startBlockMarker) || 
            !existingContent.includes(endBlockMarker) || 
            !existingContent.includes(startContentMarker) || 
            !existingContent.includes(endContentMarker)) {
            console.log("Markers not found or incomplete, regenerating note");
            return this.generateNoteContent(item, list, null);
        }
        
        const frontmatter = this.generateFrontmatter(item, list);
        const newItemContent = await this.generateItemContent(item, list);
        
        const startContentIndex = existingContent.indexOf(startContentMarker);
        const endContentIndex = existingContent.indexOf(endContentMarker);
        
        if (startContentIndex === -1 || endContentIndex === -1) {
            console.log("Content markers not found, regenerating note");
            return this.generateNoteContent(item, list, null);
        }
        
        // Extract the user content sections
        let beforeContent = '';
        let afterContent = '';
        
        const blockStartIndex = existingContent.indexOf(startBlockMarker);
        const blockEndIndex = existingContent.indexOf(endBlockMarker) + endBlockMarker.length;
        
        beforeContent = existingContent.substring(
            blockStartIndex + startBlockMarker.length,
            startContentIndex
        );
        
        afterContent = existingContent.substring(
            endContentIndex + endContentMarker.length,
            blockEndIndex - endBlockMarker.length
        );
        
        // Reconstruct the note
        let result = frontmatter;
        result += startBlockMarker + beforeContent + startContentMarker + '\n\n';
        result += newItemContent;
        result += '\n\n' + endContentMarker + afterContent + endBlockMarker + '\n';
        
        return result;
    }
    
    /**
     * Process a description text to replace hashtags if needed
     */
    private processDescription(description: string): string {
        if (this.settings.tagReplacement !== undefined) {
            // Replace all # characters with the specified replacement
            return description.replace(/#/g, this.settings.tagReplacement);
        }
        return description;
    }
    
    /**
     * Generate properties
     */
    private generateFrontmatter(item: ListyItem, list: ListyList): string {
        let frontmatter = `---\n`;
        frontmatter += `source: listy\n`;
        frontmatter += `list: "${this.escapeYamlString(list.title)}"\n`;
        frontmatter += `dateAdded: ${item.dateAdded}\n`;
        
        if (item.url) {
            frontmatter += `url: "${this.escapeYamlString(item.url)}"\n`;
        }
        
        frontmatter += `type: ${item.type.toLowerCase()}\n`;
        
        // Process attributes as individual properties
        if (item.attributes && item.attributes.length > 0) {
            const attributesMap = new Map<string, string>();
            
            for (const attr of item.attributes) {
                const key = attr.key.toLowerCase();
                attributesMap.set(key, attr.value);
            }
            
            if (attributesMap.has('description')) {
                const processedDesc = this.processDescription(attributesMap.get('description') || '');
                frontmatter += `description: |\n  ${processedDesc.replace(/\n/g, '\n  ')}\n`;
                attributesMap.delete('description');
            }
            
            if (attributesMap.has('author')) {
                frontmatter += `author: "${this.escapeYamlString(attributesMap.get('author') || '')}"\n`;
                attributesMap.delete('author');
            }
            
            if (attributesMap.has('cover')) {
                frontmatter += `cover: "${this.escapeYamlString(attributesMap.get('cover') || '')}"\n`;
                attributesMap.delete('cover');
            }
            
            if (attributesMap.has('tags')) {
                // Only process tags if the includeTags setting is enabled
                if (this.settings.includeTags) {
                    const tagsString = attributesMap.get('tags') || '';
                    
                    const tags = tagsString.split(',')
                        .map(tag => tag.trim())
                        .map(tag => {
                            return tag.replace(/\s+/g, '-');
                        })
                        .filter(tag => tag.length > 0);
                    
                    if (tags.length > 0) {
                        frontmatter += `tags:\n`;
                        for (const tag of tags) {
                            frontmatter += `  - "${this.escapeYamlString(tag)}"\n`;
                        }
                    }
                }
                
                // Always store the original tags as a custom property
                frontmatter += `original_tags: "${this.escapeYamlString(attributesMap.get('tags') || '')}"\n`;
                attributesMap.delete('tags');
            }
            
            if (attributesMap.has('icon')) {
                frontmatter += `icon: "${this.escapeYamlString(attributesMap.get('icon') || '')}"\n`;
                attributesMap.delete('icon');
            }
            
            // Add remaining attributes
            for (const [key, value] of attributesMap.entries()) {
                if (value.includes('\n') || value.length > 80) {
                    frontmatter += `${key}: |\n  ${value.replace(/\n/g, '\n  ')}\n`;
                } else {
                    // Use quoted string for simple values
                    frontmatter += `${key}: "${this.escapeYamlString(value)}"\n`;
                }
            }
        }

		frontmatter += `marked: ${item.marked}\n`;

		if (this.settings.enableNoteLocking) {
			frontmatter += `lock: false\n`;
		}
        
        frontmatter += `---\n\n`;
        return frontmatter;
    }
    
    /**
     * Generate the actual content for a note (without markers)
     */
    private async generateItemContent(item: ListyItem, list: ListyList): Promise<string> {
        const templateContent = await getTemplateContents(this.app, this.settings.templateFile);
        
        // Create a sanitized copy of the item
        const sanitizedItem = { ...item };
        const maxLength = this.settings.maxTitleLength;
        sanitizedItem.title = this.sanitizeFileName(item.title).substring(0, maxLength);
        if (sanitizedItem.title.length === maxLength) {
            sanitizedItem.title = sanitizedItem.title.substring(0, maxLength - 3) + '...';
        }
        
        // Process description in the item if it exists
        if (sanitizedItem.attributes) {
            for (const attr of sanitizedItem.attributes) {
                if (attr.key.toLowerCase() === 'description') {
                    attr.value = this.processDescription(attr.value);
                }
            }
        }
        
        return applyTemplateTransformations(templateContent, sanitizedItem, list);
    }

    /**
     * Helper function to escape YAML strings properly
     */
    private escapeYamlString(str: string): string {
        return str
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t');
    }

    /**
     * Custom sanitize function for file names
     */
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
			.replace(/#/g, '')
            .trim();
        
        if (sanitized.startsWith('.')) {
            sanitized = '_' + sanitized;
        }
        
        // Use the configurable max length
        const maxLength = this.settings.maxTitleLength;
        if (sanitized.length > maxLength) {
            sanitized = sanitized.substring(0, maxLength - 3) + '...';
        }
        
        return sanitized;
    }

    /**
     * Consolidated To Do list note
     */
    private async createConsolidatedToDoList(list: ListyList, folderPath: string): Promise<void> {
        const listPath = normalizePath(`${folderPath}/${this.sanitizeFileName(list.title)}.md`);
        
        let existingContent: string | null = null;
        let existingTasks: Map<string, boolean> = new Map();
        
        try {
            existingContent = await this.app.vault.adapter.read(listPath);
            
            if (this.settings.enableNoteLocking && existingContent) {
                const lockMatch = existingContent.match(/^lock:\s*true/m);
                if (lockMatch) {
                    console.log(`Skipping locked To Do list: ${list.title}`);
                    return;
                }
            }
            
            const taskRegex = /- \[([ x])\] (.*?)$/gm;
            let match;
            while ((match = taskRegex.exec(existingContent)) !== null) {
                const isChecked = match[1] === 'x';
                const taskName = match[2];
                existingTasks.set(taskName, isChecked);
            }
            
            console.log(`Updating existing To Do list: ${list.title}`);
        } catch (error) {
            console.log(`Creating new To Do list: ${list.title}`);
        }
        
        let content = `---\n`;
        content += `source: listy\n`;
        content += `type: todo\n`;
        content += `list: "${this.escapeYamlString(list.title)}"\n`;
        content += `create: ${list.create}\n`;
        content += `update: ${list.update}\n`;
        content += `---\n\n`;
        
        content += `# ${list.title}\n\n`;
        
        const listId = existingContent ? this.extractItemId(existingContent) : uuidv4();
        
        content += `%%START-${listId}%%\n\n`;
        content += `${USER_COMMENT_PLACEHOLDER}\n\n`;
        content += `%%START-EXTRACTED-CONTENT-${listId}%%\n\n`;
        
        // Add each task as a checklist item
        for (const item of list.items) {
            const isCompleted = item.marked || (existingTasks.has(item.title) && existingTasks.get(item.title));
            content += `- [${isCompleted ? 'x' : ' '}] ${item.title}\n`;
        }
        
        content += `\n%%END-EXTRACTED-CONTENT-${listId}%%\n\n`;
        content += `${USER_COMMENT_PLACEHOLDER}\n\n`;
        content += `%%END-${listId}%%\n`;
        
        await this.app.vault.adapter.write(listPath, content);
    }
} 
