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
import stringify from 'json-stringify-pretty-compact';

import Handlebars from './src/helpers/handlebars-helpers.js'; // Импортируем Handlebars с зарегистрированными хелперами


const { series, parallel, watch, src, dest } = gulp;
const browserSyncInstance = browserSync.create();

// Чтение данных из JSON
function getJsonData() {
  // return JSON.parse(fs.readFileSync('./src/data/data.json'));

  // Чтение данных из обоих файлов
  const dataJson = JSON.parse(fs.readFileSync('./src/data/data.json'));
  const stylesJson = JSON.parse(fs.readFileSync('./src/data/styles.json'));

  // Объединение данных из двух файлов в один объект
  return { 
    ...dataJson,
    ...stylesJson,  // Можно добавить данные styles в объект с ключом "styles"
  };
}

// Обработка изображений
function processImages() {
  return src('src/assets/images/*')
    .pipe(imagemin())
    .pipe(dest('dist/images'));
}

function extractSassVariables(filePath) {
  const scssContent = fs.readFileSync(filePath, 'utf-8');
  const variableRegex = /(\$[a-zA-Z0-9-_]+)\s*:\s*([^;]+)/g;
  const variables = {};
  
  let match;

  while ((match = variableRegex.exec(scssContent)) !== null) {
    const variableName = match[1].replace('$', '').trim();  // Убираем $ из имени переменной
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

// Компиляция шаблонов
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
    .pipe(rename('email-preview.html'))
    .pipe(htmlmin({ collapseWhitespace: true, removeComments: true }))
    .pipe(rename('index.html'))
    .pipe(dest('dist'))
    .pipe(browserSyncInstance.stream());
}

// Применение prettify только к файлам, которые идут в папку dist/preview
function prettifyPreview() {
  return src('dist/preview/email-preview.html')
    .pipe(prettify({ indent_size: 2 }))
    .pipe(dest('dist/preview'));
}

// Запуск сервера
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

// Слежение за изменениями
function watchFiles() {
  watch('src/templates/**/*.{hbs,mjml}', series(compileTemplates));  // Обрабатываем .hbs и .html файлы
  watch('dist/**/*.html').on('change', browserSyncInstance.reload);
  watch('src/images/*', series(processImages));
  watch('src/data/**/*.json').on('change', series(compileTemplates));
  watch('dist/preview/email-preview.html', series(prettifyPreview)); // Применяем prettify только к preview файлам
  watch('src/assets/styles/_variables.scss', series(convertScssVariablesToJson)); // Слежение за изменениями в SCSS
}

// Задача по умолчанию
const defaultTask = series(
  convertScssVariablesToJson,  // Добавляем задачу конвертации SCSS переменных в JSON
  compileTemplates,
  parallel(watchFiles, serve, processImages)
);

export {
  processImages,
  compileTemplates,
  prettifyPreview,
  serve,
  watchFiles,
  convertScssVariablesToJson,  // Экспортируем задачу
  defaultTask as default,
};
