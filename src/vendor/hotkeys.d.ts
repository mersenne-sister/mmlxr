declare module hotkeys {

	class Keymap {
		_keycodes: any;
	}

	class Dispatcher {
		constructor(el?: Element, keymap?: Keymap);
		on(key: string, action: ()=>void): void;
		getKeymap(): Keymap;
	}

}

declare module 'hotkeys' {
	export = hotkeys;
}
