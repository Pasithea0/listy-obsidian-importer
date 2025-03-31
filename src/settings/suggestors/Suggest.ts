import { App, ISuggestOwner, Scope } from "obsidian";

const wrapAround = (value: number, size: number): number => {
	return ((value % size) + size) % size;
};

class Suggest<T> {
	private owner: ISuggestOwner<T>;
	private values: T[] = [];
	private suggestions: HTMLDivElement[] = [];
	private selectedItem: number | undefined;
	private containerEl: HTMLElement;

	constructor(
		owner: ISuggestOwner<T>,
		containerEl: HTMLElement,
		scope: Scope
	) {
		this.owner = owner;
		this.containerEl = containerEl;

		containerEl.on(
			"click",
			".suggestion-item",
			this.onSuggestionClick.bind(this)
		);
		containerEl.on(
			"mousemove",
			".suggestion-item",
			this.onSuggestionMouseover.bind(this)
		);

		scope.register([], "ArrowUp", (event) => {
			if (!event.isComposing && this.selectedItem !== undefined) {
				this.setSelectedItem(this.selectedItem - 1, true);
				return false;
			}
			return true;
		});

		scope.register([], "ArrowDown", (event) => {
			if (!event.isComposing && this.selectedItem !== undefined) {
				this.setSelectedItem(this.selectedItem + 1, true);
				return false;
			}
			return true;
		});

		scope.register([], "Enter", (event) => {
			if (!event.isComposing && this.selectedItem !== undefined) {
				this.useSelectedItem(event);
				return false;
			}
			return true;
		});
	}

	onSuggestionClick(event: MouseEvent, el: HTMLDivElement): void {
		event.preventDefault();

		const item = this.suggestions.indexOf(el);
		this.setSelectedItem(item, false);
		this.useSelectedItem(event);
	}

	onSuggestionMouseover(_event: MouseEvent, el: HTMLDivElement): void {
		const item = this.suggestions.indexOf(el);
		this.setSelectedItem(item, false);
	}

	setSuggestions(values: T[]) {
		this.containerEl.empty();
		const suggestionEls: HTMLDivElement[] = [];

		values.forEach((value) => {
			const suggestionEl = this.containerEl.createDiv("suggestion-item");
			this.owner.renderSuggestion(value, suggestionEl);
			suggestionEls.push(suggestionEl);
		});

		this.values = values;
		this.suggestions = suggestionEls;
		this.setSelectedItem(0, false);
	}

	useSelectedItem(event: MouseEvent | KeyboardEvent) {
		if (this.selectedItem === undefined) {
			return;
		}

		const currentValue = this.values[this.selectedItem];
		if (currentValue) {
			this.owner.selectSuggestion(currentValue, event);
		}
	}

	setSelectedItem(selectedIndex: number, scrollIntoView: boolean) {
		const normalizedIndex = wrapAround(
			selectedIndex,
			this.suggestions.length
		);

		if (this.selectedItem !== undefined) {
			this.suggestions[this.selectedItem]?.removeClass("is-selected");
		}

		const selectedSuggestion = this.suggestions[normalizedIndex];

		selectedSuggestion?.addClass("is-selected");

		this.selectedItem = normalizedIndex;

		if (scrollIntoView) {
			selectedSuggestion.scrollIntoView(false);
		}
	}
}

export abstract class TextInputSuggest<T> implements ISuggestOwner<T> {
	protected app: App;
	protected inputEl: HTMLInputElement | HTMLTextAreaElement;

	private popper: any; // PopperInstance
	private scope: Scope;
	private suggestEl: HTMLElement;
	private suggest: Suggest<T>;

	constructor(app: App, inputEl: HTMLInputElement | HTMLTextAreaElement) {
		this.app = app;
		this.inputEl = inputEl;
		this.scope = new Scope();

		this.suggestEl = createDiv("suggestion-container");
		const suggestion = this.suggestEl.createDiv("suggestion");
		this.suggest = new Suggest(this, suggestion, this.scope);

		this.scope.register([], "Escape", this.close.bind(this));

		this.inputEl.addEventListener("input", this.onInputChanged.bind(this));
		this.inputEl.addEventListener("focus", this.onInputChanged.bind(this));
		this.inputEl.addEventListener("blur", this.close.bind(this));
		this.suggestEl.on(
			"mousedown",
			".suggestion-container",
			(event: MouseEvent) => {
				event.preventDefault();
			}
		);
	}

	onInputChanged(): void {
		const inputStr = this.inputEl.value;
		const suggestions = this.getSuggestions(inputStr);

		if (!suggestions) {
			this.close();
			return;
		}

		if (suggestions.length > 0) {
			this.suggest.setSuggestions(suggestions);
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			this.open((<any>this.app).dom.appContainerEl, this.inputEl);
		} else {
			this.close();
		}
	}

	open(container: HTMLElement, inputEl: HTMLElement): void {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(<any>this.app).keymap.pushScope(this.scope);

		container.appendChild(this.suggestEl);

		// Position the suggestor element
		this.suggestEl.addClass('listy-suggestor');
		const rect = inputEl.getBoundingClientRect();
		this.suggestEl.style.left = `${rect.left}px`;
		this.suggestEl.style.top = `${rect.bottom}px`;
	}

	close(): void {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(<any>this.app).keymap.popScope(this.scope);

		this.suggest.setSuggestions([]);
		this.suggestEl.detach();
	}

	abstract getSuggestions(inputStr: string): T[];
	abstract renderSuggestion(item: T, el: HTMLElement): void;
	abstract selectSuggestion(item: T, evt: MouseEvent | KeyboardEvent): void;
}
