const moment = require('moment');

module.exports = function (env) {
  var filters = {}

  filters.formatDate = function(date) {
    if (date) {
      return moment(date).format('DD/MM/YYYY');
    }
  }

  filters.formatTime = function(time) {
    if (time) {
      return moment(time).format('HH:mm:ss');
    }
  }

  return filters
}
