import gulp from 'gulp';
import mjml from 'gulp-mjml';
import handlebars from 'gulp-compile-handlebars';
import data from 'gulp-data';
import rename from 'gulp-rename';
import fs from 'fs';
import htmlmin from 'gulp-htmlmin';
import prettify from 'gulp-prettify';
import browserSync from 'browser-sync';
import imagemin from 'gulp-imagemin';
import imageminMozjpeg from 'imagemin-mozjpeg';
import imageminPngquant from 'imagemin-pngquant';
import stringify from 'json-stringify-pretty-compact';
import zip from 'gulp-zip';

import Handlebars from './src/helpers/handlebars-helpers.js';

const { series, parallel, watch, src, dest } = gulp;
const browserSyncInstance = browserSync.create();

function getJsonData() {
  const dataJson = JSON.parse(fs.readFileSync('./src/data/data.json'));
  const stylesJson = JSON.parse(fs.readFileSync('./src/data/styles.json'));

  return { 
    ...dataJson,
    ...stylesJson,
  };
}

function processImages() {
  return src('src/assets/images/*', { encoding: false }) 
    .pipe(imagemin([
      imageminMozjpeg({ quality: 85, progressive: true }),
      imageminPngquant({ quality: [0.7, 0.9] })
    ]))
    .pipe(dest('dist/images'));
}

function extractSassVariables(filePath) {
  const scssContent = fs.readFileSync(filePath, 'utf-8');
  const variableRegex = /(\$[a-zA-Z0-9-_]+)\s*:\s*([^;]+)/g;
  const variables = {};
  
  let match;

  while ((match = variableRegex.exec(scssContent)) !== null) {
    const variableName = match[1].replace('$', '').trim(); 
    const variableValue = match[2].replace('$', '').trim();
    variables[variableName] = variableValue;
  }

  return variables;
}

// Преобразование SCSS переменных в JSON
async function convertScssVariablesToJson() {  
  const variables = extractSassVariables('src/assets/styles/_variables.scss'); 
  const variablesObject = variables

  for (const variableObject in variablesObject) { 
    if (variablesObject[variablesObject[variableObject]]) {
      variablesObject[variableObject] = variablesObject[variablesObject[variableObject]]
    }
  }

  fs.writeFileSync('src/data/styles.json', stringify(variablesObject), null, 2);

  return true
}

function compileTemplates() {
  const templateName = getJsonData().templateName;

  return src(`src/templates/${templateName}`)
    .pipe(data(getJsonData))
    .pipe(handlebars({}, {
      batch: ['src/templates/partials', 'src/templates/styles'],
      helpers: Handlebars.helpers 
    }))
    .on('error', console.error.bind(console))
    .pipe(mjml())
    .pipe(rename((path) => {
      path.basename += '-preview'; 
      path.extname = '.html'; 
    }))
    .pipe(prettify({ indent_size: 2 }))
    .pipe(dest('dist/preview')) 
    .pipe(htmlmin({ collapseWhitespace: true, removeComments: true }))
    .pipe(rename((path) => {
      path.basename = path.basename.replace('-preview', '')
      path.extname = '.html';
    }))
    .pipe(dest('dist'))
    .pipe(browserSyncInstance.stream());
}

function compileAllTemplates() {
  return src('src/templates/*.hbs')
    .pipe(data(getJsonData))
    .pipe(handlebars({}, {
      batch: ['src/templates/partials', 'src/templates/styles'],
      helpers: Handlebars.helpers
    }))
    .on('error', console.error.bind(console))
    .pipe(mjml())
    .pipe(rename((path) => {
      path.basename += '-preview';
      path.extname = '.html';
    }))
    .pipe(prettify({ indent_size: 2 }))
    .pipe(dest('dist/preview'))
    .pipe(htmlmin({ collapseWhitespace: true, removeComments: true }))
    .pipe(rename((path) => {
      path.basename = path.basename.replace('-preview', '')
      path.extname = '.html';
    }))
    .pipe(dest('dist'))
    .pipe(browserSyncInstance.stream());
}

function prettifyFiles() {
  return prettify({ indent_size: 2 });
}

function serve() {
  browserSyncInstance.init({
    server: {
      baseDir: 'dist',
    },
    port: 3000,
    open: true,
    notify: true,
  });
}

function zipFiles() {
  return src('dist/**/*') 
    .pipe(zip('email-templates-zipped.zip')) 
    .pipe(dest('zipped')); 
}

function watchFiles() {
  watch('src/templates/**/*.{hbs,mjml}', series(compileTemplates)); 
  watch('dist/**/*.html').on('change', browserSyncInstance.reload);
  watch('src/images/*', series(processImages));
  watch('src/data/**/*.json').on('change', series(compileTemplates));
  watch('src/assets/styles/_variables.scss', series(convertScssVariablesToJson)); 
}

const defaultTask = series(
  convertScssVariablesToJson, 
  compileTemplates,
  parallel(watchFiles, serve, processImages)
);

export {
  processImages,
  compileTemplates,
  compileAllTemplates,
  prettifyFiles,
  serve,
  watchFiles,
  convertScssVariablesToJson,
  zipFiles,
  defaultTask as default,
};
