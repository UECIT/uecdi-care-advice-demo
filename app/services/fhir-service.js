const fs = require('fs');
const FhirService = require('fhir').Fhir;
const FhirVersions = require('fhir').Versions;
const ParseConformance = require('fhir').ParseConformance;
const newValueSets = JSON.parse(
    fs.readFileSync('app/assets/files/valuesets.json').toString());
const newTypes = JSON.parse(
    fs.readFileSync('app/assets/files/profiles-types.json').toString());
const newResources = JSON.parse(
    fs.readFileSync('app/assets/files/profiles-resources.json').toString());
const parser = new ParseConformance(false, FhirVersions.STU3);
parser.parseBundle(newValueSets);
parser.parseBundle(newTypes);
parser.parseBundle(newResources);

const fhir = new FhirService(parser);
module.exports = fhir;