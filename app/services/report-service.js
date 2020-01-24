const rp = require('request-promise');
const fs = require('fs')
const Fhir = require('fhir').Fhir;
const FhirVersions = require('fhir').Versions;
const ParseConformance = require('fhir').ParseConformance;

const newValueSets = JSON.parse(fs.readFileSync('app/assets/files/valuesets.json').toString());
const newTypes = JSON.parse(fs.readFileSync('app/assets/files/profiles-types.json').toString());
const newResources = JSON.parse(fs.readFileSync('app/assets/files/profiles-resources.json').toString());
const parser = new ParseConformance(false, FhirVersions.STU3);
parser.parseBundle(newValueSets);
parser.parseBundle(newTypes);
parser.parseBundle(newResources);

const fhir = new Fhir(parser);

function getReport(id, origin) {
    const args = [
        ['_id', id],
        ['_revinclude', 'ReferralRequest:context'],
        ['_revinclude', 'Composition:encounter'],
        ['_include', 'Encounter:subject'],
    ].map(a => a.join('=')).join('&');
    const emsRevIncludeSearch = `${origin}Encounter?${args}`;
    const result = rp.get(emsRevIncludeSearch)
        .then(function (response) {
            var bundleObj = fhir.xmlToObj(response);
            return bundleObj;
        })
        .catch(function (error) {
            return error;
        });
    return result;
};

exports.getReport = getReport;