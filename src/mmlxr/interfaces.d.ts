interface IAutosaveEntry {
	id?: string;
	updatedAt: number;
	mml: string;
	history: string[];
	rescue: boolean;
	isProtected: boolean;
}
