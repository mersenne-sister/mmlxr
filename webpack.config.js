var path = require('path');
var fs = require('fs');
var webpack = require('webpack');

var isDebug = true;

var opts = {
	entry: {
		app :'./src/mmlxr/index.ts'
	},
	output: {
		filename: 'build/mmlxr.bundle.js'
	},
	resolve: {
		modules: [
			path.resolve(__dirname, 'src'),
			path.resolve(__dirname, 'node_modules')
		],
		alias: {
			// 'js-cookie': path.join(__dirname, 'node_modules', 'js-cookie', 'src', 'js.cookie.js'),
			// 'jquery-tablesort': path.join(__dirname, 'node_modules', 'jquery-tablesort', 'jquery.tablesort.js'),
			'semantic-ui'       : path.join(__dirname, 'Semantic-UI', 'dist', 'semantic.js'),
			// 'semantic-ui-css'   : path.join(__dirname, 'Semantic-UI', 'dist', 'semantic.css'),
			// 'toastr-css'        : path.join(__dirname, 'node_modules', 'toastr', 'build', 'toastr.css'),
			'jquery-splitter'   : path.join(__dirname, 'src', 'js', 'jquery.splitter.js'),
			'flmml-parser'      : path.join(__dirname, 'src', 'peg', 'flmml-parser.js'),
			'ace/theme/flmml'   : path.join(__dirname, 'src', 'js', 'ace', 'theme-flmml'),
			'ace/mode/flmml'    : path.join(__dirname, 'src', 'js', 'ace', 'mode-flmml'),
			'ace/snippets/flmml': path.join(__dirname, 'src', 'js', 'ace', 'snippets-flmml.js')
		},
		extensions: ['.ts', '.js']
	},
	node: {
		fs: 'empty',
		child_process: 'empty'
	},
	module: {
		loaders: [
			{ test: /\.ts$/, loader: 'ts-loader' },
			// {
			// 	test: /language_tools\.js$/,
			// 	loader: 'string-replace-loader',
			// 	query: {
			// 		search: 'ace\\.define\\("ace/autocomplete/util",[\\s\\S]+?ace\\.define\\("ace/autocomplete",',
			// 		replace: fs.readFileSync(path.join(__dirname, 'src', 'js', 'ace', 'autocomplete-util-flmml.js')) + 'ace.define("ace/autocomplete",',
			// 		flags: ''
			// 	}
			// },
			// {
			// 	test: /keybinding_menu\.js$/,
			// 	loader: 'string-replace-loader',
			// 	query: {
			// 		search: 'dom.importCssString',
			// 		replace: '//'
			// 	}
			// },
			// { test: /\.css$/, loader: 'style-loader!css-loader' },
			// { test: /\.png$/, loader: 'url-loader?limit=100000' },
			// { test: /\.jpg$/, loader: 'file-loader' },
			// { test: /Semantic-UI\/.*\.(ttf|eot|svg|woff2?|otf|png|jpg)(\?[a-z0-9]+)?$/, loader: 'file-loader?name=build/components/semantic-ui/[name].[ext]' },
			
			// Below is for debug
			{ test: require.resolve('js-cookie'), loader: 'expose-loader?Cookies'  },
			{ test: require.resolve('moment'), loader: 'expose-loader?moment'   },
			{ test: require.resolve('fraction.js'), loader: 'expose-loader?Fraction' },
			{ test: require.resolve('toastr'), loader: 'expose-loader?toastr' }
		]
	},
	plugins: []
};

if (isDebug) {
	opts.devtool = 'source-map';
	opts.plugins.push(
		new webpack.LoaderOptionsPlugin({
			debug: true
		})
	);
}
else {
	opts.plugins.push(
		new webpack.optimize.UglifyJsPlugin({
			output: { comments: require('uglify-save-license') }
		})
	);
}

module.exports = opts;
