/// <reference path="../../typings/browser.d.ts" />

export class NdxdbConnection {
	
	private db: IDBDatabase;
	private name: string;
	private version: number;
	
	upgrade: (db:IDBDatabase, oldVersion:number)=>void;
	blocked: ()=>void;
	
	constructor(name: string, version: number) {
		this.name = name;
		this.version = version;
	}
	
	private open() {
		if (this.db) return Promise.resolve(this);
		return new Promise((resolve, reject)=>{
			var req = indexedDB.open(this.name, this.version);
			// console.log('indexedDB open');
			req.onerror = (evt: Event)=>{
				// console.log('indexedDB onerror');
				reject(evt.srcElement['error']);
			};
			req.onblocked = (evt: Event)=>{
				// console.log('indexedDB onblocked');
				if (this.blocked) return this.blocked();
			};
			req.onsuccess = (evt: Event)=>{
				// console.log('indexedDB onsuccess');
				this.db = evt.target['result'];
				resolve(this.db);
			};
			req.onupgradeneeded = (evt: Event)=>{
				// console.log('indexedDB onupgradeneeded');
				this.db = evt.target['result'];
				if (this.upgrade) this.upgrade(this.db, evt['oldVersion']);
			};
		});
	}
	
	tx(store: string, mode: IDBTransactionMode='readwrite') {
		return this.open()
			.then(()=>{
				var tx = this.db.transaction([store], mode);
				return new NdxdbStore(tx.objectStore(store));
			});
	}
	
}

export class NdxdbStore {
	
	store: IDBObjectStore;
	
	constructor(store: IDBObjectStore) {
		this.store = store;
	}
	
	get(key: string): Promise<any> {
		return new Promise((resolve, reject)=>{
			var req = this.store.get(key);
			req.onerror = (evt)=>reject(evt.srcElement['error']);
			req.onsuccess = (evt)=>resolve(evt.target['result']);
		});
	}
	
	add(row: any): Promise<any> {
		return new Promise((resolve, reject)=>{
			var req = this.store.add(row);
			req.onerror = (evt)=>reject(evt.srcElement['error']);
			req.onsuccess = (evt)=>resolve(evt.target['result']);
		});
	}
	
	put(row: any): Promise<any> {
		return new Promise((resolve, reject)=>{
			var req = this.store.put(row);
			req.onerror = (evt)=>reject(evt.srcElement['error']);
			req.onsuccess = (evt)=>resolve(evt.target['result']);
		});
	}
	
	update(key: string, rowDiff: any): Promise<any> {
		var result = null;
		return this.get(key)
			.then((row: any)=>{
				result = $.extend(row, rowDiff);
				return this.put(row);
			})
			.then(()=>{
				return result;
			});
	}
	
	delete(key: string|number) {
		return new Promise((resolve, reject)=>{
			var req = this.store.delete(key);
			req.onerror = (evt)=>reject(evt.srcElement['error']);
			req.onsuccess = (evt)=>resolve(evt);
		});
	}
	
	each(callback?: (row:any)=>void) {
		var result = [];
		return new Promise((resolve, reject)=>{
			var req = this.store.openCursor();
			req.onsuccess = (evt)=>{
				var cursor = evt.target['result'];
				if (!cursor) {
					resolve(result);
					return;
				}
				callback && callback(cursor.value);
				result.push(cursor.value);
				cursor.continue();
			};
		});
	}
}
