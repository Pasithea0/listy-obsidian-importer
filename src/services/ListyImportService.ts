import { App, normalizePath, Notice } from "obsidian";
import { v4 as uuidv4 } from 'uuid';
import { ListyData, ListyItem, ListyList } from "../models/ListyTypes";
import { MyPluginSettings } from "../settings/Settings";

export const USER_COMMENT_PLACEHOLDER = `%% Here you can type whatever you want, it will not be overwritten by the plugin. %%`;

export interface ListyNoteItem {
    id: string;
    item: ListyItem;
    fullContent: string;
    noteContent: string;
}

export class ListyImportService {
    app: App;
    settings: MyPluginSettings;

    constructor(app: App, settings: MyPluginSettings) {
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
        
        // Make sure output folder exists
        if (this.settings.outputFolder && this.settings.outputFolder.length > 0) {
            const folderExists = await this.app.vault.adapter.exists(this.settings.outputFolder);
            if (!folderExists) {
                await this.app.vault.createFolder(this.settings.outputFolder);
            }
        }
        
        // Process each list
        let totalNotesCreated = 0;
        for (const list of listyData.lists) {
            // Skip lists with no items
            if (!list.items || list.items.length === 0) {
                continue;
            }
            
			// Handle To Do lists that should be consolidated
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
            
            // Process each item in the list as individual notes
            for (const item of list.items) {
                const sanitizedItemTitle = this.sanitizeFileName(item.title);
                const notePath = normalizePath(`${listFolderPath}/${sanitizedItemTitle}.md`);
                
                // Check if the note already exists
                let existingContent: string | null = null;
                try {
                    existingContent = await this.app.vault.adapter.read(notePath);
                    console.log(`Updating existing note: ${sanitizedItemTitle}`);
                } catch (error) {
                    console.log(`Creating new note: ${sanitizedItemTitle}`);
                    // File doesn't exist, create it
                }
                
                // Generate the note content, preserving comments if the note exists
                const noteContent = this.generateNoteContent(item, list, existingContent);
                
                // Write the file
                await this.app.vault.adapter.write(notePath, noteContent);
                totalNotesCreated++;
            }
        }
        
        return totalNotesCreated;
    }
    
    /**
     * Generate note content for a Listy item
     */
    private generateNoteContent(item: ListyItem, list: ListyList, existingContent: string | null): string {
        // Check if the note already exists and contains our markers
        if (existingContent) {
            const itemId = this.extractItemId(existingContent);
            if (itemId) {
                // The note exists and has our markers, so update only the content part
                return this.updateExistingNote(item, list, existingContent, itemId);
            }
        }
        
        // Generate a new ID for this item
        const itemId = uuidv4();
        
        // Create frontmatter
        const frontmatter = this.generateFrontmatter(item, list);
        
        // Generate the note content
        const noteContent = this.generateItemContent(item);
        
        // Structure with comment preservation markers
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
     * Extract the ID from an existing note
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
    private updateExistingNote(item: ListyItem, list: ListyList, existingContent: string, itemId: string): string {
        // Find the content markers in the existing content
        const startBlockMarker = `%%START-${itemId}%%`;
        const endBlockMarker = `%%END-${itemId}%%`;
        const startContentMarker = `%%START-EXTRACTED-CONTENT-${itemId}%%`;
        const endContentMarker = `%%END-EXTRACTED-CONTENT-${itemId}%%`;
        
        // Check if all markers exist
        if (!existingContent.includes(startBlockMarker) || 
            !existingContent.includes(endBlockMarker) || 
            !existingContent.includes(startContentMarker) || 
            !existingContent.includes(endContentMarker)) {
            console.log("Markers not found or incomplete, regenerating note");
            return this.generateNoteContent(item, list, null);
        }
        
        // Generate new frontmatter and content
        const frontmatter = this.generateFrontmatter(item, list);
        const newItemContent = this.generateItemContent(item);
        
        // Split the content into sections
        const startContentIndex = existingContent.indexOf(startContentMarker);
        const endContentIndex = existingContent.indexOf(endContentMarker);
        
        if (startContentIndex === -1 || endContentIndex === -1) {
            console.log("Content markers not found, regenerating note");
            return this.generateNoteContent(item, list, null);
        }
        
        // Extract sections while preserving user comments
        const contentStart = startContentIndex + startContentMarker.length;
        const contentEnd = endContentIndex;
        
        // Find the frontmatter section
        const frontmatterStart = existingContent.indexOf('---');
        const frontmatterEnd = existingContent.indexOf('---', frontmatterStart + 3) + 3;
        
        // Extract the user content sections
        let beforeBlock = '';
        let afterBlock = '';
        let beforeContent = '';
        let afterContent = '';
        
        const blockStartIndex = existingContent.indexOf(startBlockMarker);
        const blockEndIndex = existingContent.indexOf(endBlockMarker) + endBlockMarker.length;
        
        // Everything before the start block marker should be removed (old frontmatter)
        
        // Extract the user comment before the content
        beforeContent = existingContent.substring(
            blockStartIndex + startBlockMarker.length,
            startContentIndex
        );
        
        // Extract the user comment after the content
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
                frontmatter += `description: |\n  ${attributesMap.get('description')?.replace(/\n/g, '\n  ')}\n`;
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
        
        frontmatter += `---\n\n`;
        return frontmatter;
    }
    
    /**
     * Generate the actual content for a note (without markers)
     */
    private generateItemContent(item: ListyItem): string {
        let content = `# ${item.title}\n\n`;
        
        // Add URL as a link if it exists
        if (item.url) {
            content += `[Visit Original](${item.url})\n\n`;
        }
        
        // If there's a description attribute, add it to the content
        if (item.attributes) {
            const description = item.attributes.find(attr => attr.key === 'DESCRIPTION');
            if (description) {
                content += `## Description\n\n${description.value}\n\n`;
            }
            
            // Add cover image if available
            const cover = item.attributes.find(attr => attr.key === 'COVER');
            if (cover) {
                content += `![](${cover.value})\n\n`;
            }
        }
        
        // Add a section for notes
        content += `## Notes\n\n`;
        
        return content;
    }

    /**
     * Helper function to escape YAML strings properly
     */
    private escapeYamlString(str: string): string {
        // Replace backslashes, quotes, and control characters
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

    /**
     * Create a consolidated To Do list note
     */
    private async createConsolidatedToDoList(list: ListyList, folderPath: string): Promise<void> {
        const listPath = normalizePath(`${folderPath}/${this.sanitizeFileName(list.title)}.md`);
        
        // Check if the note already exists
        let existingContent: string | null = null;
        let existingTasks: Map<string, boolean> = new Map();
        
        try {
            existingContent = await this.app.vault.adapter.read(listPath);
            
            // Parse existing tasks
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
            // File doesn't exist, create it
        }
        
        // Generate the note content
        let content = `---\n`;
        content += `source: listy\n`;
        content += `type: todo\n`;
        content += `list: "${this.escapeYamlString(list.title)}"\n`;
        content += `create: ${list.create}\n`;
        content += `update: ${list.update}\n`;
        content += `---\n\n`;
        
        content += `# ${list.title}\n\n`;
        
        // Generate unique ID for the list
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
