const rp = require('request-promise');
const fhir = require('./fhir-service');
const Report = require('../data/report');

async function getReport(id, origin) {
  const encounterReportUrl = `${origin}Encounter?_id=${id}&_include=*&_revinclude=*`;
  let options = {
    uri: encounterReportUrl,
    headers: {
      'Accept': 'application/xml'
    }
  }
  const response = await rp.get(options);
  const bundleObj = fhir.xmlToObj(response);
  return new Report(origin, bundleObj);
}

exports.getReport = getReport;