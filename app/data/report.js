const rp = require('request-promise');
const fhir = require('../services/fhir-service');

function getId(resource) {
  return `${resource.resourceType}/${resource.id}`;
}

class Report {
  constructor(baseUrl, bundle) {
    this.baseUrl = baseUrl;
    this.bundle = bundle;
    this.resolved = {};
  }

  async resolve(reference, parent) {
    let id = reference.reference;
    let resolvedElement = this.resolved[id];
    if (resolvedElement) {
      return resolvedElement;
    }

    // TODO resolve external references relative to the parent bundle entry, not the bundle base URL
    console.log("Resolve", reference);
    resolvedElement =
        this.findContained(id, parent) ||
        this.findBundled(id) ||
        await this.fetch(id);

    this.resolved[id] = resolvedElement;
    return resolvedElement;
  }

  // Resolve contained resources
  findContained(reference, parent) {
    if (reference.startsWith('#') && parent.contained) {
      return parent.contained
      .map(entry => entry.resource)
      .find(resource => resource.id === reference.substr(1));
    }

    return null;
  }

  // Resolve bundled resources
  findBundled(reference) {
    const entry = this.bundle.entry
    .find(entry => {
      // TODO check fullUrl of bundle entry
      return getId(entry.resource) === reference;
    });

    return entry && entry.resource;
  }

  async fetch(reference) {
    let url = new URL(reference, this.baseUrl);
    console.log(`  Fetching from ${url}`);
    const response = await rp.get(url.href);
    return fhir.xmlToObj(response);
  }

  async patient() {
    let encounter = this.encounter();
    return await this.resolve(encounter.subject, encounter);
  }

  async gp() {
    let patient = await this.patient();
    return patient.generalPractitioner && patient.generalPractitioner[0] &&
        this.resolve(patient.generalPractitioner[0], patient);
  }

  encounter() {
    return this._encounter || (this._encounter = this.bundle.entry
    .map(e => e.resource)
    .find(r => r.resourceType === 'Encounter'));
  }

  referralRequest() {
    return this._referralRequest || (this._referralRequest = this.bundle.entry
    .map(e => e.resource)
    .filter(r => r.resourceType === 'ReferralRequest')
    .sort((a, b) => a.id - b.id)[0]);
  }

  handoverMessage() {
    return this.referralRequest();
  }

}

module.exports = Report;