declare module 'binary-search-tree' {

	export class AVLTree<K, T> {

		/**
		 * Constructor
		 * @param {Object} options Optional
		 * @param {Boolean}  options.unique Whether to enforce a 'unique' constraint on the key or not
		 * @param {Key}      options.key Initialize this BST's key with key
		 * @param {Value}    options.value Initialize this BST's data with [value]
		 * @param {Function} options.compareKeys Initialize this BST's compareKeys
		 */
		constructor(options?: any);

		/**
		 * Get the descendant with max key
		 */
		getMaxKeyDescendant(): any;

		/**
		 * Get the maximum key
		 */
		getMaxKey(): any;

		/**
		 * Get the descendant with min key
		 */
		getMinKeyDescendant(): any;

		/**
		 * Get the minimum key
		 */
		getMinKey(): any;

		/**
		 * Check that all nodes (incl. leaves) fullfil condition given by fn
		 * test is a function passed every (key, data) and which throws if the condition is not met
		 */
		checkAllNodesFullfillCondition(test: Function): void;

		/**
		 * Check that the core BST properties on node ordering are verified
		 * Throw if they aren't
		 */
		checkNodeOrdering(): void;

		/**
		 * Check that all pointers are coherent in this tree
		 */
		checkInternalPointers(): void;

		/**
		 * Check that a tree is a BST as defined here (node ordering and pointer references)
		 */
		checkIsBST(): void;

		/**
		 * Get number of keys inserted
		 */
		getNumberOfKeys(): number;

		/**
		 * Create a BST similar (i.e. same options except for key and value) to the current one
		 * Use the same constructor (i.e. BinarySearchTree, AVLTree etc)
		 * @param {Object} options see constructor
		 */
		createSimilar(options?: any): AVLTree<K, T>;

		/**
		 * Create the left child of this BST and return it
		 */
		createLeftChild(options?: any): AVLTree<K, T>;

		/**
		 * Create the right child of this BST and return it
		 */
		createRightChild(options?: any): AVLTree<K, T>;

		/**
		 * Insert a new element
		 */
		insert(key: K, value: T): void;

		/**
		 * Search for all data corresponding to a key
		 */
		search(key: K): T[];

		/**
		 * Return a function that tells whether a given key matches a lower bound
		 */
		getLowerBoundMatcher(query): (key?: K) => boolean;

		/**
		 * Return a function that tells whether a given key matches an upper bound
		 */
		getUpperBoundMatcher(query): (key?: K) => boolean;

		/**
		 * Get all data for a key between bounds
		 * Return it in key order
		 * @param {Object} query Mongo-style query where keys are $lt, $lte, $gt or $gte (other keys are not considered)
		 * @param {Functions} lbm/ubm matching functions calculated at the first recursive step
		 */
		betweenBounds(query: any, lbm?: (key?: K) => boolean, ubm?: (key?: K) => boolean): T[];

		/**
		 * Delete the current node if it is a leaf
		 * Return true if it was deleted
		 */
		deleteIfLeaf(): boolean;

		/**
		 * Delete the current node if it has only one child
		 * Return true if it was deleted
		 */
		deleteIfOnlyOneChild(): boolean;

		/**
		 * Delete a key or just a value
		 * @param {Key} key
		 * @param {Value} value Optional. If not set, the whole key is deleted. If set, only this value is deleted
		 */
		delete(key: K, value?: T): void;

		/**
		 * Execute a function on every node of the tree, in key order
		 * @param {Function} fn Signature: node. Most useful will probably be node.key and node.data
		 */
		executeOnEveryNode(fn: Function): void;

		/**
		 * Pretty print a tree
		 * @param {Boolean} printData To print the nodes' data along with the key
		 */
		prettyPrint(printData?: boolean, spacing?: string);

	}

}
