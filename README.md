# Listy Importer for Obsidian

Listy Importer is a plugin for [Obsidian](https://obsidian.md) that allows you to import your [Listy](https://apps.apple.com/us/app/listy-lists-of-collections/id1496035097) lists and items into Obsidian notes.

This plugin is heavily inspired and based on code from https://github.com/OGKevin/obsidian-kobo-highlights-import

## Features

- **Import Listy Data**: Import all your Listy lists and items from a JSON export file
- **Template Support**: Customize the formatting of imported notes using templates
- **Flexible Configuration**:
  - Choose where to save your imported notes
  - Consolidate To Do lists into single notes
  - Handle tags from Listy items
  - Lock notes to prevent overwriting during reimport
- **Preserves User Comments**: When reimporting, user comments in notes are preserved

## How to Use

1. Export your data from Listy as a JSON file
2. Open Obsidian and click the Listy icon in the left ribbon, or use the command "Import Listy Lists"
3. Select your JSON export file
4. Click "Import" and wait for the process to complete

## Installation

### Using BRAT (Beta Releases and Testing)

1. Open Obsidian Settings
2. Go to Community plugins
3. Disable Safe mode if necessary
4. Click "Browse" and search for "BRAT"
5. Install the plugin and enable it
6. Enter BRAT settings and add a beta plugin by entering this URL: `https://github.com/Pasithea0/listy-obsidian-importer`
7. Refresh the plugin list

<!-- ### NOT YET From Obsidian Community Plugins NOT YET

1. Open Obsidian Settings
2. Go to Community plugins
3. Disable Safe mode if necessary
4. Click "Browse" and search for "Listy Importer"
5. Install the plugin and enable it -->

### Manual Installation

1. Download the latest release files (`main.js`, `manifest.json`, `styles.css`)
2. Create a folder named `listy-obsidian-importer` in your vault's `.obsidian/plugins/` directory
3. Place the downloaded files in this folder
4. Enable the plugin in Obsidian's settings

## Configuration

The plugin can be configured through its settings tab:

- **Output Folder**: Where to save your imported notes (default: "Listy")
- **Consolidate To Do Lists**: Create a single note for To Do lists instead of individual notes for each item
- **Include Tags**: Convert Listy tags to Obsidian tags in the frontmatter
- **Escape Hashtags in Descriptions**: Prevent hashtags in descriptions from becoming Obsidian tags
- **Enable Note Locking**: Add a "lock" property to notes that can be set to prevent reimporting
- **Template File**: Choose a custom markdown file to use as a template for imported notes

## Templates

You can use a template file to customize how your Listy items are formatted when imported. 

Default template:

```
# {{Title}}

[Visit Original Source]({{URL}})

## Description

{{Description}}

![Cover Image]({{Cover}})

## Notes

{{UserNote}}
```

The template can include placeholders that will be replaced with data from your Listy items:

- `{{Title}}` - Item title
- `{{URL}}` - Item URL
- `{{Description}}` - Item description
- `{{Cover}}` - Cover image URL
- `{{UserNote}}` - User notes from the item
- `{{Author}}` - Author information
- `{{Genre}}` - Genre information
- `{{Rating}}` - Rating information
- `{{Date}}` - Date information
- `{{Price}}` - Price information
- `{{ListTitle}}` - Title of the parent list
- `{{ATTR:key}}` - Any custom attribute by key name

## Development

### Building from Source

1. Clone this repository
2. Install dependencies with `pnpm install`
3. Build the plugin with `pnpm run build` or `pnpm run dev` for active development
4. Copy `main.js`, `manifest.json`, and `styles.css` to your Obsidian plugins folder

## Support

If you encounter any issues or have feature requests, please open an issue on the GitHub repository.

## License

This project is licensed under OBSD License
