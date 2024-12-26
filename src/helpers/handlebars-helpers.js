import Handlebars from 'handlebars';

Handlebars.registerHelper('default', function(value, defaultValue) {
  // Если значение не задано, возвращаем значение по умолчанию
  return (value === undefined || value === null || value === '' || isNaN(value)) ? defaultValue : value;
});

export default Handlebars;
