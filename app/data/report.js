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

    this._encounter = null;
    this._referralRequest = null;
    this._appointment = null;
    this._selectedService = null;
    this._selectedServiceLocation = null;
    this._conditions = null;
    this._observations = null;
    this._carePlans = null;
  }

  async resolve(reference, parent) {
    let id = reference.reference;
    let resolvedElement = this.resolved[id];
    if (resolvedElement) {
      return resolvedElement;
    }

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

  appointment() {
    return this._appointment || (this._appointment = this.bundle.entry
    .map(e => e.resource)
    .find(r => r.resourceType.endsWith('Appointment')));
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

  async selectedService() {
    if (!this._selectedService) {
      let referralRequest = this.referralRequest();
      if (!referralRequest
          || !referralRequest.recipient
          || referralRequest.recipient.length === 0) {
        return null;
      }

      this._selectedService =
          await this.resolve(referralRequest.recipient[0], referralRequest);
    }
    return this._selectedService;
  }

  async selectedServiceLocation() {
    if (!this._selectedServiceLocation) {
      let selectedService = await this.selectedService();
      if (!selectedService
          || !selectedService.location
          || selectedService.location.length === 0) {
        return null;
      }

      this._selectedServiceLocation
          = await this.resolve(selectedService.location[0], selectedService);
    }
    return this._selectedServiceLocation;
  }

  observations() {
    return this._observations || (this._observations = this.bundle.entry
    .map(e => e.resource)
    .filter(r => r.resourceType === 'Observation'));
  }

  conditions() {
    return this._conditions || (this._conditions = this.bundle.entry
    .map(e => e.resource)
    .filter(r => r.resourceType === 'Condition'));
  }

  carePlans() {
    return this._carePlans || (this._carePlans = this.bundle.entry
    .map(e => e.resource)
    .filter(r => r.resourceType === 'CarePlan'));
  }

}

module.exports = Report;