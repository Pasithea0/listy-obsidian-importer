import { App, normalizePath, Notice } from "obsidian";
import { ListyItem, ListyList } from "../types/ListyTypes";

export const DEFAULT_TEMPLATE = `# {{Title}}

[Visit Original Source]({{URL}})

## Description

{{Description}}

![Cover Image]({{Cover}})

## Notes

{{UserNote}}`;

export async function getTemplateContents(
  app: App,
  templatePath: string | undefined
): Promise<string> {
  if (!templatePath || templatePath.trim() === "") {
    return DEFAULT_TEMPLATE;
  }

  const normalizedTemplatePath = normalizePath(templatePath);
  
  try {
    const templateFile = app.metadataCache.getFirstLinkpathDest(normalizedTemplatePath, "");
    return templateFile ? await app.vault.cachedRead(templateFile) : DEFAULT_TEMPLATE;
  } catch (err) {
    console.error(`Failed to read the Listy template '${normalizedTemplatePath}'`, err);
    new Notice("Failed to read the Listy template file");
    return DEFAULT_TEMPLATE;
  }
}

export function applyTemplateTransformations(
  rawTemplate: string,
  item: ListyItem,
  list: ListyList
): string {
  let result = rawTemplate
    .replace(/{{Title}}/gi, item.title)
    .replace(/{{URL}}/gi, item.url || "")
    .replace(/{{Type}}/gi, item.type)
    .replace(/{{DateAdded}}/gi, item.dateAdded)
    .replace(/{{ListTitle}}/gi, list.title)
    .replace(/{{ListType}}/gi, list.type)
    .replace(/{{Create}}/gi, list.create)
    .replace(/{{Update}}/gi, list.update);
  
  // Process attributes
  if (item.attributes && item.attributes.length > 0) {
    const description = item.attributes.find(attr => attr.key.toUpperCase() === "DESCRIPTION");
    result = result.replace(/{{Description}}/gi, description ? description.value : "");
    
    const cover = item.attributes.find(attr => attr.key.toUpperCase() === "COVER");
    result = result.replace(/{{Cover}}/gi, cover ? cover.value : "");
    
    const userNote = item.attributes.find(attr => attr.key.toUpperCase() === "USER_NOTE");
    result = result.replace(/{{UserNote}}/gi, userNote ? userNote.value : "");
    
    const author = item.attributes.find(attr => attr.key.toUpperCase() === "AUTHOR");
    result = result.replace(/{{Author}}/gi, author ? author.value : "");
    
    const genre = item.attributes.find(attr => attr.key.toUpperCase() === "GENRE");
    result = result.replace(/{{Genre}}/gi, genre ? genre.value : "");
    
    const rating = item.attributes.find(attr => attr.key.toUpperCase() === "RATING");
    result = result.replace(/{{Rating}}/gi, rating ? rating.value : "");
    
    const date = item.attributes.find(attr => attr.key.toUpperCase() === "DATE");
    result = result.replace(/{{Date}}/gi, date ? date.value : "");
    
    const price = item.attributes.find(attr => attr.key.toUpperCase() === "PRICE");
    result = result.replace(/{{Price}}/gi, price ? price.value : "");
    
    // Generic attribute handling - any {{ATTR:key}} format
    const attrRegex = /{{ATTR:([\w_]+)}}/gi;
    let match;
    while ((match = attrRegex.exec(result)) !== null) {
      const attrKey = match[1].toUpperCase();
      const attr = item.attributes.find(a => a.key.toUpperCase() === attrKey);
      result = result.replace(
        new RegExp(`{{ATTR:${match[1]}}}`, 'gi'), 
        attr ? attr.value : ""
      );
    }
  } else {
    result = result
      .replace(/{{Description}}/gi, "")
      .replace(/{{Cover}}/gi, "")
      .replace(/{{UserNote}}/gi, "")
      .replace(/{{Author}}/gi, "")
      .replace(/{{Genre}}/gi, "")
      .replace(/{{Rating}}/gi, "")
      .replace(/{{Date}}/gi, "")
      .replace(/{{Price}}/gi, "");
    
    result = result.replace(/{{ATTR:[\w_]+}}/gi, "");
  }
  
  return result.trim();
} 
