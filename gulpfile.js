'use strict';

var gulp = require('gulp');
var gutil = require('gulp-util');
var rimraf = require('rimraf');
var webpack = require('webpack-stream');
var peg = require('gulp-peg');
var replace = require('gulp-replace');
var rename = require('gulp-rename');
var debug = require('gulp-debug');
var runSequence = require('run-sequence');
var fs = require('fs');
var path = require('path');
var yaml = require('js-yaml');
var yamlValidate = require('gulp-yaml-validate');



gulp.task('clean', function(done) {
	rimraf('./build', done);
});

gulp.task('lint:yaml', function(){
	return gulp.src(['./language/*.yml', './*.yml'])
		.pipe(yamlValidate());
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

gulp.task('build', gulp.series('build:snippet', 'build:peg', 'lint', function build_main(){
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
	return gulp.src(['./static/**'], {base:'static'})
		.pipe(gulp.dest('./build/'));
}));
gulp.task('copy:flmml', function(){
	return gulp.src(['./FlMMLonHTML5/flmmlworker.*'], {base:'FlMMLonHTML5'})
		.pipe(gulp.dest('./build/js/'));
});
gulp.task('copy:dpcm-worker', function(){
	return gulp.src(['./dpcm-worker/dist/dpcm-worker.*'], {base:'dpcm-worker/dist'})
		.pipe(gulp.dest('./build/js/'));
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
		.pipe(gulp.dest('./build/components/semantic-ui/'));
});
gulp.task('copy:libmp3lame', function(){
	return gulp.src(['./libmp3lame-js/dist/**'], {base:'libmp3lame-js/dist'})
		.pipe(gulp.dest('./build/components/libmp3lame-js/'));
});
gulp.task('copy', gulp.series('copy:static', 'copy:flmml', 'copy:dpcm-worker', 'copy:semantic-ui', /*'copy:toastr',*/ 'copy:libmp3lame'));

gulp.task('rebuild', gulp.series('clean', function rebuild_main(done){
	runSequence(
		['copy', 'build'],
		done
	);
}));

gulp.task('default', gulp.series('copy', 'build'));
