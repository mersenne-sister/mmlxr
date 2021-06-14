'use strict';

const gulp = require('gulp');
const gutil = require('gulp-util');
const rimraf = require('rimraf');
const webpack = require('webpack-stream');
const peg = require('gulp-pegjs');
const pug = require('gulp-pug');
const stylus = require('gulp-stylus');
const nib = require('nib');
const replace = require('gulp-replace');
const rename = require('gulp-rename');
const debug = require('gulp-debug');
const fs = require('fs');
const path = require('path');
const child_process = require('child_process');
const yaml = require('js-yaml');
const yamlLint = require('gulp-yaml-lint');



const language = { en:{} };
fs.readdirSync('src/language').forEach(function(file){
	if (!file.match(/\.yml$/i)) return;
	var l = yaml.safeLoad(fs.readFileSync('src/language/'+file, 'utf8'));
	language[file.replace(/\.yml$/i, '')] = l;
});

const pugLocals = {
	config: yaml.safeLoad(fs.readFileSync('config.yml', 'utf8')),
	language: language,
	licenses: {
		brace              : 'node_modules/brace/LICENSE',
		FlMMLonHTML5       : 'FlMMLonHTML5/LICENSE',
		googleMaterialColor: 'node_modules/google-material-color/LICENSE',
		gulp               : 'node_modules/gulp/LICENSE',
		pug                : 'node_modules/pug/LICENSE',
		jquery             : 'node_modules/jquery/LICENSE.txt',
		moment             : 'node_modules/moment/LICENSE',
		stylus             : 'node_modules/stylus/LICENSE',
		typescript         : 'node_modules/typescript/LICENSE.txt',
		webpack            : 'node_modules/webpack/LICENSE'
	}
};
for (var k of Object.keys(pugLocals.licenses)) {
	var p = pugLocals.licenses[k].split(/\//);
	p.unshift(__dirname);
	pugLocals.licenses[k] = fs.readFileSync(path.resolve.apply(path, p), 'utf8');
}

gulp.task('clean', function(done) {
	rimraf('./docs', done);
});

gulp.task('lint:yaml', function(){
	return gulp.src(['./language/*.yml', './*.yml'])
		.pipe(yamlLint());
});

gulp.task('lint', gulp.series('lint:yaml'));

gulp.task('build:snippet', function(done){
	var p = path.join(__dirname, 'src', 'js', 'ace', 'snippets-flmml.yml');
	var data = yaml.safeLoad(fs.readFileSync(p, 'utf8'));
	var snippetSrc = data.map(function(s){
		return 'snippet ' + s.caption + "\n" + s.content.replace(/^/mg, "\t") + "\n";
	}).join('');
	
	var docSrc = {};
	data.forEach(function(s){ docSrc[s.caption] = s.doc; });
	
	return gulp.src(['./src/js/ace/snippets-flmml.txt'])
		// .pipe(debug())
		.pipe(replace(/'<SNIPPET>'/, JSON.stringify(snippetSrc)))
		.pipe(replace(/'<DOCHTML>'/, JSON.stringify(docSrc)))
		.pipe(rename({extname: '.js'}))
		.pipe(gulp.dest('./src/js/ace/'));
});

gulp.task('build:peg', function(){
	return gulp.src('src/peg/*.pegjs')
		.pipe(peg().on('error', gutil.log))
		.pipe(gulp.dest('./src/peg/'));
});

gulp.task('build:pug', function(){
	return gulp.src(['src/views/index.pug', 'src/views/manual.pug'])
		.pipe(pug({basedir: "./src/views", locals: pugLocals}).on('error', gutil.log))
		.pipe(gulp.dest('./docs'));
});

gulp.task('build:stylus',  () => {
	return gulp.src(['src/style/index.styl', 'src/style/manual.styl'])
		.pipe(stylus({use: [nib()]}))
		.pipe(gulp.dest('./docs'));
});

gulp.task('build', gulp.series('build:snippet', 'build:peg', 'build:pug', 'build:stylus', 'lint', function build_main(){
	var config = require('./webpack.config.js');
	return gulp.src('src/mmlxr/index.ts')
		.pipe(webpack(config))
		.pipe(gulp.dest('./'));
}));

gulp.task('watch', function(){
	var config = require('./webpack.config.js');
	config.watch = true;
	return gulp.src('src/mmlxr/index.ts')
		.pipe(webpack(config))
		.on('error', function(){ this.emit('end'); })
		.pipe(gulp.dest('./'));
});

gulp.task('copy:static', gulp.series('build:snippet', function copy_static_main(){
	return gulp.src(['./src/static/**'], {base:'src/static'})
		.pipe(gulp.dest('./docs/'));
}));
gulp.task('copy:flmml', function(){
	return gulp.src(['./FlMMLonHTML5/flmmlworker.*'], {base:'FlMMLonHTML5'})
		.pipe(gulp.dest('./docs/js/'));
});
gulp.task('copy:jquery', function(){
	return gulp.src(['./node_modules/jquery/dist/jquery.min.*'], {base:'node_modules/jquery/dist'})
		.pipe(gulp.dest('./docs/components/jquery/'));
});
gulp.task('copy:dpcm-worker', function(){
	return gulp.src(['./dpcm-worker/dist/dpcm-worker.*'], {base:'dpcm-worker/dist'})
		.pipe(gulp.dest('./docs/js/'));
});
gulp.task('copy:semantic-ui', function(){
	return gulp.src(
		[
			'./Semantic-UI/dist/semantic.min.css',
			'./Semantic-UI/dist/semantic.min.js',
			'./Semantic-UI/dist/themes/default/assets/**'
		],
		{ base:'Semantic-UI/dist' }
	)
		.pipe(gulp.dest('./docs/components/semantic-ui/'));
});
gulp.task('copy:libmp3lame', function(){
	return gulp.src(['./libmp3lame-js/dist/**'], {base:'libmp3lame-js/dist'})
		.pipe(gulp.dest('./docs/components/libmp3lame-js/'));
});
gulp.task('copy', gulp.series('copy:static', 'copy:flmml', 'copy:jquery', 'copy:dpcm-worker', 'copy:semantic-ui', /*'copy:toastr',*/ 'copy:libmp3lame'));

gulp.task('rebuild', gulp.series('clean', 'copy', 'build'));

gulp.task('default', gulp.series('copy', 'build'));
